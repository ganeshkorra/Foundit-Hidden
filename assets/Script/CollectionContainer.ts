// FILE: CollectionContainer.ts (Final version with UI Panel Animation)

import { _decorator, Component, Node, Label, ProgressBar, director, Vec3, tween, Sprite, SpriteFrame, AudioSource, UITransform, UIOpacity, Prefab, instantiate, ParticleSystem2D } from 'cc';
import { CollectibleCoin, COLLECT_COIN_EVENT } from './CollectibleCoin';

const { ccclass, property } = _decorator;

export const CONTAINER_COMPLETE_EVENT = 'container-complete';

@ccclass('CollectionContainer')
export class CollectionContainer extends Component {

    // --- All properties are the same ---
    @property(Sprite)
    public itemIcon: Sprite | null = null;
    @property(ProgressBar)
    public progressBar: ProgressBar | null = null;
    @property(Label)
    public progressLabel: Label | null = null;
    @property({ type: Node })
    public collectibleItems: Node[] = [];
    @property({ type: SpriteFrame })
    public highlightSpriteFrame: SpriteFrame | null = null;
    @property({ type: SpriteFrame })
    public ringSpriteFrame: SpriteFrame | null = null;
    @property({ type: Prefab })
    public confettiPrefab: Prefab | null = null;
    @property({ type: AudioSource })
    public itemCollectSound: AudioSource | null = null;
    @property({ type: AudioSource })
    public containerCompleteSound: AudioSource | null = null;

    private totalItems: number = 0;
    private collectedItems: number = 0;
    private isComplete: boolean = false;
    private originalScale: Vec3 = new Vec3(1, 1, 1);

    onLoad() {
        this.totalItems = this.collectibleItems.length;
        this.updateUI();
        director.on(COLLECT_COIN_EVENT, this.onItemClicked, this);
        this.originalScale.set(this.node.scale); // Store the panel's original scale
    }

    onDestroy() {
        director.off(COLLECT_COIN_EVENT, this.onItemClicked, this);
    }

    private onItemClicked(itemNode: Node, spriteFrame: SpriteFrame, worldPos: Vec3) {
        if (this.isComplete || this.collectibleItems.indexOf(itemNode) === -1) {
            return;
        }
        itemNode.getComponent(CollectibleCoin)?.onCollectionStart();
        this.playCollectionEffects(spriteFrame, worldPos);
    }

    private playCollectionEffects(flyingSpriteFrame: SpriteFrame, startWorldPos: Vec3) {
        if (!this.itemIcon) { console.error("Item Icon target is not set!"); return; }
        const canvas = this.node.scene.getChildByName('Canvas');
        if (!canvas) { console.error("Canvas node not found!"); return; }

        const startLocalPos = canvas.getComponent(UITransform)!.convertToNodeSpaceAR(startWorldPos);
        const targetWorldPos = this.itemIcon.node.worldPosition;
        const targetLocalPos = canvas.getComponent(UITransform)!.convertToNodeSpaceAR(targetWorldPos);
        
        const flightDelay = 0.2;
        const flightDuration = 0.5;
        const totalTravelTime = flightDelay + flightDuration;

        // In-Place Click Effect (Unchanged)
        if (this.highlightSpriteFrame && this.ringSpriteFrame) {
             const effectNode = new Node("ClickEffect");
             canvas.addChild(effectNode);
             const effectSprite = effectNode.addComponent(Sprite);
             effectNode.addComponent(UIOpacity);
             effectSprite.spriteFrame = this.highlightSpriteFrame;
             effectNode.setPosition(startLocalPos);
             effectNode.setScale(0.2, 0.2, 1);
             const effectOpacity = effectNode.getComponent(UIOpacity)!;
             tween(effectNode).to(0.15, { scale: new Vec3(0.1, 0.1, 1) }).call(() => { effectSprite.spriteFrame = this.ringSpriteFrame; }).to(0.3, { scale: new Vec3(0.1, 0.1, 1) }).to(0.3, {}, { onUpdate: (target, ratio) => { effectOpacity.opacity = Math.round(255 * (1 - ratio)); } }).call(() => { effectNode.destroy(); }).start();
        }

        // Flying Coin Animation (Unchanged)
        const animatedItem = new Node("AnimatedItem");
        canvas.addChild(animatedItem);
        const sprite = animatedItem.addComponent(Sprite);
        sprite.spriteFrame = flyingSpriteFrame;
        animatedItem.setPosition(startLocalPos);
        animatedItem.setScale(0.2, 0.2, 1);
        tween(animatedItem).delay(flightDelay).to(flightDuration, { position: targetLocalPos, scale: new Vec3(0.2, 0.2, 1) }, { easing: 'cubicIn' }).call(() => { animatedItem.destroy(); }).start();

        // Synchronized Effects Timer
        tween(this.node)
            .delay(totalTravelTime)
            .call(() => {
                // --- NEW: Animate the UI panel itself ---
                this.playCollectionBounce();

                // Play particle effect
                if (this.confettiPrefab && this.itemIcon) {
                    const particleNode = instantiate(this.confettiPrefab);
                    this.itemIcon.node.addChild(particleNode);
                    particleNode.setPosition(0, 0);
                    const particleSystem = particleNode.getComponent(ParticleSystem2D);
                    if (particleSystem) particleSystem.resetSystem();
                    this.scheduleOnce(() => { particleNode.destroy(); }, 2);
                }

                // Update game state and sound
                this.collectedItems++;
                this.updateUI();
                if (this.itemCollectSound) this.itemCollectSound.play();
                if (this.collectedItems >= this.totalItems) this.onContainerComplete();
            })
            .start();
    }
    
    // --- NEW: A dedicated function for the UI panel's animation ---
    private playCollectionBounce() {
        // Stop any previous animations on this node to prevent conflicts
        tween(this.node).stop();
        // Reset scale instantly in case a previous animation was interrupted
        this.node.setScale(this.originalScale);

        tween(this.node)
            // 1. Quickly scale up to give a 'punch' effect
            .to(0.1, { scale: new Vec3(this.originalScale.x * 1.15, this.originalScale.y * 1.15, this.originalScale.z) }, { easing: 'quadOut' })
            // 2. Return to the original scale with a nice bouncy feel
            .to(0.4, { scale: new Vec3(this.originalScale.x, this.originalScale.y, this.originalScale.z) }, { easing: 'elasticOut' })
            .start();
    }
    // ---

    private updateUI() {
        if (this.progressBar) {
            this.progressBar.progress = this.totalItems > 0 ? this.collectedItems / this.totalItems : 0;
        }
       if (this.progressLabel) { // This check is 'false' because progressLabel is null!
        // This line is NEVER RUNNING for the Apple container
        this.progressLabel.string = `${this.collectedItems}/${this.totalItems}`;
    }
    }

    private onContainerComplete() {
        this.isComplete = true;
        console.log(`Container ${this.name} is complete!`);
        if (this.containerCompleteSound) this.containerCompleteSound.play();

        // A bigger animation for when the whole container is complete
        tween(this.node).stop(); // Stop other animations
        tween(this.node)
            .to(0.15, { scale: new Vec3(this.originalScale.x * 1.2, this.originalScale.y * 1.2, this.originalScale.z) }, { easing: 'quadOut' })
            .to(0.4, { scale: new Vec3(this.originalScale.x, this.originalScale.y, this.originalScale.z) }, { easing: 'backOut' })
            .start();
            
        director.emit(CONTAINER_COMPLETE_EVENT, this.node);
    }

    public resetContainer() {
        this.collectedItems = 0;
        this.isComplete = false;
        this.updateUI();
    }
}

// FILE: CollectionContainer.ts

import { _decorator, Component, Node, Label, ProgressBar, director, Vec3, tween, Sprite, SpriteFrame, AudioSource, UITransform, UIOpacity, Prefab, instantiate, ParticleSystem2D } from 'cc';
import { CollectibleCoin, COLLECT_COIN_EVENT, ITEM_TAPPED_EVENT } from './CollectibleCoin';

const { ccclass, property } = _decorator;

export const CONTAINER_COMPLETE_EVENT = 'container-complete';

@ccclass('CollectionContainer')
export class CollectionContainer extends Component {
    private static activeSelectedItem: CollectibleCoin | null = null;
    private static activeSelectedContainer: CollectionContainer | null = null;
    private static isWrongPairFeedbackActive: boolean = false;

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
    private selectedItem: CollectibleCoin | null = null;
    private collectedPairIds: Set<string> = new Set();

    onLoad() {
        this.totalItems = this.getCollectionGoalCount();
        this.updateUI();
        director.on(ITEM_TAPPED_EVENT, this.onItemTapped, this);
        this.originalScale.set(this.node.scale); // Store the panel's original scale
    }

    onDestroy() {
        director.off(ITEM_TAPPED_EVENT, this.onItemTapped, this);
        if (CollectionContainer.activeSelectedContainer === this) {
            CollectionContainer.activeSelectedContainer = null;
            CollectionContainer.activeSelectedItem = null;
        }
    }

    private onItemTapped(item: CollectibleCoin) {
        if (CollectionContainer.isWrongPairFeedbackActive) {
            return;
        }

        const itemNode = item.node;
        const ownsItem = this.collectibleItems.indexOf(itemNode) !== -1;

        if (!ownsItem) {
            return;
        }

        if (this.isComplete || item.isAlreadyCollected()) {
            return;
        }

        if (!this.itemIcon) {
            return;
        }

        const pairId = item.getPairId();
        if (!pairId) {
            this.collectSingleItem(item);
            return;
        }

        if (this.collectedPairIds.has(pairId)) {
            return;
        }

        const activeItem = CollectionContainer.activeSelectedItem;
        const activeContainer = CollectionContainer.activeSelectedContainer;
        if (activeItem && activeItem !== item) {
            if (!activeItem.node?.isValid || activeItem.isAlreadyCollected()) {
                CollectionContainer.activeSelectedItem = null;
                CollectionContainer.activeSelectedContainer = null;
            } else {
                const activePairId = activeItem.getPairId();
                if (activePairId === pairId) {
                    activeContainer?.playPairMerge(activeItem, item);
                    if (activeContainer) {
                        activeContainer.selectedItem = null;
                    }
                    CollectionContainer.activeSelectedItem = null;
                    CollectionContainer.activeSelectedContainer = null;
                    return;
                }

                this.playWrongPairFeedback(activeItem, item);
                return;
            }
        }

        if (!this.selectedItem) {
            this.selectedItem = item;
            CollectionContainer.activeSelectedItem = item;
            CollectionContainer.activeSelectedContainer = this;
            item.selectForMerge();
            return;
        }

        if (this.selectedItem === item) {
            return;
        }

        if (this.selectedItem.getPairId() === pairId) {
            this.playPairMerge(this.selectedItem, item);
            this.selectedItem = null;
            CollectionContainer.activeSelectedItem = null;
            CollectionContainer.activeSelectedContainer = null;
            return;
        }

        this.playWrongPairFeedback(this.selectedItem, item);
    }

    private playWrongPairFeedback(previousItem: CollectibleCoin, tappedItem: CollectibleCoin) {
        CollectionContainer.isWrongPairFeedbackActive = true;
        const previousContainer = CollectionContainer.activeSelectedContainer;

        if (previousContainer) {
            previousContainer.selectedItem = null;
        }
        this.selectedItem = null;
        CollectionContainer.activeSelectedItem = null;
        CollectionContainer.activeSelectedContainer = null;

        previousItem.stopSelectionPulse();
        tappedItem.stopSelectionPulse();
        previousItem.playWrongPairJerk();
        tappedItem.playWrongPairJerk();

        this.scheduleOnce(() => {
            CollectionContainer.isWrongPairFeedbackActive = false;
        }, 0.4);
    }

    private collectSingleItem(item: CollectibleCoin) {
        const spriteFrame = item.getSpriteFrame();
        if (!spriteFrame) return;

        const startWorldPos = item.node.worldPosition.clone();
        const sourceNodes = [item.node];
        item.onCollectionStart();
        this.playCollectionEffects(spriteFrame, startWorldPos, sourceNodes);
    }

    private playPairMerge(firstItem: CollectibleCoin, secondItem: CollectibleCoin) {
        const pairId = firstItem.getPairId();
        if (!pairId || pairId !== secondItem.getPairId() || !this.itemIcon) return;

        const canvas = this.node.scene.getChildByName('Canvas');
        if (!canvas) { console.error("Canvas node not found!"); return; }

        const canvasTransform = canvas.getComponent(UITransform);
        if (!canvasTransform) { console.error("Canvas UITransform not found!"); return; }

        const firstSpriteFrame = firstItem.getSpriteFrame();
        const secondSpriteFrame = secondItem.getSpriteFrame();
        const finalSpriteFrame = this.getFinalSpriteFrame(firstItem, secondItem) ?? secondSpriteFrame ?? firstSpriteFrame;
        if (!firstSpriteFrame || !secondSpriteFrame || !finalSpriteFrame) return;

        const firstWorldPos = firstItem.node.worldPosition.clone();
        const secondWorldPos = secondItem.node.worldPosition.clone();
        const centerLocalPos = new Vec3(0, 0, 0);
        const firstStartLocal = canvasTransform.convertToNodeSpaceAR(firstWorldPos);
        const secondStartLocal = canvasTransform.convertToNodeSpaceAR(secondWorldPos);
        const firstScale = firstItem.node.scale.clone();
        const secondScale = secondItem.node.scale.clone();
        const sourceNodes = [firstItem.node, secondItem.node];

        secondItem.selectForMerge();
        firstItem.onCollectionStart();
        secondItem.onCollectionStart();
        this.collectedPairIds.add(pairId);

        const firstMergeNode = this.createFlyingSpriteNode(canvas, firstSpriteFrame, firstStartLocal, firstScale);
        const secondMergeNode = this.createFlyingSpriteNode(canvas, secondSpriteFrame, secondStartLocal, secondScale);
        const mergeDuration = 0.45;

        tween(firstMergeNode)
            .to(mergeDuration, { position: centerLocalPos, scale: new Vec3(firstScale.x * 1.12, firstScale.y * 1.12, firstScale.z) }, { easing: 'cubicOut' })
            .call(() => { firstMergeNode.destroy(); })
            .start();

        tween(secondMergeNode)
            .to(mergeDuration, { position: centerLocalPos, scale: new Vec3(secondScale.x * 1.12, secondScale.y * 1.12, secondScale.z) }, { easing: 'cubicOut' })
            .call(() => { secondMergeNode.destroy(); })
            .start();

        tween(this.node)
            .delay(mergeDuration)
            .call(() => {
                const finalNode = this.createFinalItemDisplayNode(canvas, firstItem, secondItem, finalSpriteFrame, centerLocalPos);
                const finalScale = finalNode.scale.clone();
                finalNode.setScale(0.05, 0.05, finalScale.z);

                tween(finalNode)
                    .to(0.18, { scale: new Vec3(finalScale.x * 1.18, finalScale.y * 1.18, finalScale.z) }, { easing: 'backOut' })
                    .to(0.14, { scale: finalScale }, { easing: 'sineOut' })
                    .delay(0.25)
                    .call(() => {
                        const finalWorldPos = finalNode.worldPosition.clone();
                        finalNode.destroy();
                        this.playCollectionEffects(finalSpriteFrame, finalWorldPos, sourceNodes);
                    })
                    .start();
            })
            .start();
    }

    private playCollectionEffects(flyingSpriteFrame: SpriteFrame, startWorldPos: Vec3, sourceNodes: Node[]) {
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
                director.emit(COLLECT_COIN_EVENT, sourceNodes[0], flyingSpriteFrame, targetWorldPos, sourceNodes);
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
        this.progressLabel.string = `${this.collectedItems}`;
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
        this.collectedPairIds.clear();
        this.clearSelectedItem();
        this.totalItems = this.getCollectionGoalCount();
        this.updateUI();
    }

    public getCollectionGoalCount() {
        const pairIds = new Set<string>();
        let unpairedItems = 0;

        this.collectibleItems.forEach(itemNode => {
            const collectible = itemNode.getComponent(CollectibleCoin);
            const pairId = collectible?.getPairId() ?? '';
            if (pairId) {
                pairIds.add(pairId);
            } else {
                unpairedItems++;
            }
        });

        return pairIds.size + unpairedItems;
    }

    private clearSelectedItem() {
        if (this.selectedItem && this.selectedItem.node?.isValid) {
            this.selectedItem.clearSelection();
        }
        if (CollectionContainer.activeSelectedContainer === this) {
            CollectionContainer.activeSelectedItem = null;
            CollectionContainer.activeSelectedContainer = null;
        }
        this.selectedItem = null;
    }

    private createFlyingSpriteNode(parent: Node, spriteFrame: SpriteFrame, position: Vec3, scale: Vec3) {
        const node = new Node("MergeItem");
        parent.addChild(node);
        const sprite = node.addComponent(Sprite);
        sprite.spriteFrame = spriteFrame;
        node.setPosition(position);
        node.setScale(scale);
        return node;
    }

    private createFinalItemDisplayNode(parent: Node, firstItem: CollectibleCoin, secondItem: CollectibleCoin, fallbackFrame: SpriteFrame, position: Vec3) {
        const finalTemplate = firstItem.finalItemNode ?? secondItem.finalItemNode;
        let finalNode: Node;

        if (finalTemplate) {
            finalNode = instantiate(finalTemplate);
        } else {
            finalNode = new Node("FinalMergedItem");
            const sprite = finalNode.addComponent(Sprite);
            sprite.spriteFrame = fallbackFrame;
            finalNode.setScale(0.35, 0.35, 1);
        }

        parent.addChild(finalNode);
        finalNode.active = true;
        finalNode.setPosition(position);
        return finalNode;
    }

    private getFinalSpriteFrame(firstItem: CollectibleCoin, secondItem: CollectibleCoin) {
        const firstFinalSprite = firstItem.finalItemNode?.getComponent(Sprite);
        const secondFinalSprite = secondItem.finalItemNode?.getComponent(Sprite);
        return firstFinalSprite?.spriteFrame ?? secondFinalSprite?.spriteFrame ?? null;
    }
}

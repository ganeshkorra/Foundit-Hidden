// FILE: CollectibleCoin.ts

import { _decorator, Component, Node, Sprite, Button, director, Vec3, AudioSource, tween, Color, UIOpacity } from 'cc';

const { ccclass, property } = _decorator;

export const ITEM_TAPPED_EVENT = 'item-tapped';
export const COLLECT_COIN_EVENT = 'collect-coin';

@ccclass('CollectibleCoin')
export class CollectibleCoin extends Component {

    @property({ tooltip: "Items with the same Pair ID can merge together." })
    public pairId: string = '';

    @property({ type: Node, tooltip: "The merged/full image to show after this item's pair is found." })
    public finalItemNode: Node | null = null;

    @property({ type: AudioSource })
    public collectSound: AudioSource | null = null;

    private isCollected: boolean = false;
    private isSelected: boolean = false;
    private spriteComponent: Sprite | null = null;
    private buttonComponent: Button | null = null;
    private selectionGlow: Node | null = null;
    private originalScale: Vec3 = new Vec3();
    private selectionTweenId: number = 0;

    protected onLoad() {
        this.spriteComponent = this.getComponent(Sprite);
        this.buttonComponent = this.getComponent(Button);
        this.originalScale.set(this.node.scale);

        if (this.buttonComponent) {
            this.buttonComponent.node.on(Button.EventType.CLICK, this.onCoinClicked, this);
        }
    }

    private onCoinClicked() {
        if (this.isCollected) return;

        if (this.collectSound) {
            this.collectSound.play();
        }

        director.emit(ITEM_TAPPED_EVENT, this);
    }

    public selectForMerge() {
        if (this.isCollected) return;

        this.isSelected = true;
        const currentTweenId = ++this.selectionTweenId;
        if (this.buttonComponent) {
            this.buttonComponent.interactable = false;
        }

        // this.ensureSelectionGlow(); // Disabled - no glow effect on item selection
        tween(this.node).stop();
        const selectedScale = new Vec3(this.originalScale.x * 1.5, this.originalScale.y * 1.5, this.originalScale.z);
        const pulseScale = new Vec3(this.originalScale.x * 1.22, this.originalScale.y * 1.22, this.originalScale.z);
        this.node.setScale(this.originalScale);
        if (this.selectionGlow) {
            tween(this.selectionGlow).stop();
            this.selectionGlow.setScale(this.originalScale);
        }
        tween(this.node)
            .to(0.12, { scale: new Vec3(this.originalScale.x * 1.18, this.originalScale.y * 1.18, this.originalScale.z) }, { easing: 'backOut' })
            .to(0.18, { scale: selectedScale }, { easing: 'sineOut' })
            .call(() => {
                if (!this.isSelected || currentTweenId !== this.selectionTweenId) return;
                tween(this.node)
                    .to(0.65, { scale: pulseScale }, { easing: 'sineInOut' })
                    .to(0.65, { scale: selectedScale }, { easing: 'sineInOut' })
                    .union()
                    .repeatForever()
                    .start();
            })
            .start();
        if (this.selectionGlow) {
            tween(this.selectionGlow)
                .to(0.12, { scale: new Vec3(this.originalScale.x * 1.18, this.originalScale.y * 1.18, this.originalScale.z) }, { easing: 'backOut' })
                .to(0.18, { scale: selectedScale }, { easing: 'sineOut' })
                .call(() => {
                    if (!this.isSelected || currentTweenId !== this.selectionTweenId) return;
                    if (!this.selectionGlow) return;
                    tween(this.selectionGlow)
                        .to(0.65, { scale: pulseScale }, { easing: 'sineInOut' })
                        .to(0.65, { scale: selectedScale }, { easing: 'sineInOut' })
                        .union()
                        .repeatForever()
                        .start();
                })
                .start();
        }
    }

    public clearSelection(allowTapAgain: boolean = true) {
        this.isSelected = false;
        this.selectionTweenId++;
        tween(this.node).stop();
        this.node.setScale(this.originalScale);

        if (this.selectionGlow) {
            tween(this.selectionGlow).stop();
            this.selectionGlow.destroy();
            this.selectionGlow = null;
        }

        if (allowTapAgain && !this.isCollected && this.buttonComponent) {
            this.buttonComponent.interactable = true;
        }
    }

    public stopSelectionPulse(allowTapAgain: boolean = true) {
        this.isSelected = false;
        this.selectionTweenId++;
        tween(this.node).stop();
        this.node.setScale(this.originalScale);

        if (this.selectionGlow) {
            tween(this.selectionGlow).stop();
            this.selectionGlow.destroy();
            this.selectionGlow = null;
        }

        if (allowTapAgain && !this.isCollected && this.buttonComponent) {
            this.buttonComponent.interactable = true;
        }
    }

    public playWrongPairJerk() {
        if (this.isCollected) return;

        const startPos = this.node.position.clone();
        this.isSelected = false;
        this.selectionTweenId++;
        tween(this.node).stop();
        this.node.setScale(this.originalScale);
        this.node.setPosition(startPos);
        this.playJerkTween(this.node, startPos, () => {
            this.node.setPosition(startPos);
            this.node.setScale(this.originalScale);
        });

        if (this.selectionGlow) {
            const glowStartPos = this.selectionGlow.position.clone();
            tween(this.selectionGlow).stop();
            this.selectionGlow.setScale(this.originalScale);
            this.playJerkTween(this.selectionGlow, glowStartPos);
        }
    }

    private playJerkTween(targetNode: Node, startPos: Vec3, onComplete?: () => void) {
        targetNode.setPosition(startPos);
        tween(targetNode)
            .to(0.05, { position: new Vec3(startPos.x - 18, startPos.y, startPos.z) }, { easing: 'quadOut' })
            .to(0.05, { position: new Vec3(startPos.x + 18, startPos.y, startPos.z) }, { easing: 'quadOut' })
            .to(0.05, { position: new Vec3(startPos.x - 14, startPos.y, startPos.z) }, { easing: 'quadOut' })
            .to(0.05, { position: new Vec3(startPos.x + 14, startPos.y, startPos.z) }, { easing: 'quadOut' })
            .to(0.05, { position: new Vec3(startPos.x - 9, startPos.y, startPos.z) }, { easing: 'quadOut' })
            .to(0.05, { position: new Vec3(startPos.x + 9, startPos.y, startPos.z) }, { easing: 'quadOut' })
            .to(0.08, { position: startPos }, { easing: 'sineOut' })
            .call(() => {
                if (onComplete) onComplete();
            })
            .start();
    }
    
    public onCollectionStart() {
        this.isCollected = true;
        this.clearSelection(false);
        this.node.active = false;
    }

    public resetCoin() {
        this.isCollected = false;
        this.clearSelection(false);
        this.node.active = true;
        this.node.setScale(this.originalScale);
        if (this.buttonComponent) {
            this.buttonComponent.interactable = true;
        }
    }

    public getSpriteFrame() {
        return this.spriteComponent?.spriteFrame ?? null;
    }

    public getPairId() {
        return this.pairId.trim();
    }

    public isAlreadyCollected() {
        return this.isCollected;
    }

    public isWaitingForPair() {
        return this.isSelected;
    }

    private ensureSelectionGlow() {
        if (this.selectionGlow || !this.spriteComponent?.spriteFrame) return;
        const parent = this.node.parent;
        if (!parent) return;

        const strokeRoot = new Node('SelectionEdgeStroke');
        parent.insertChild(strokeRoot, this.node.getSiblingIndex());
        strokeRoot.setPosition(this.node.position);
        strokeRoot.setRotation(this.node.rotation);
        strokeRoot.setScale(this.node.scale);
        strokeRoot.layer = this.node.layer;

        const strokeOpacity = strokeRoot.addComponent(UIOpacity);
        strokeOpacity.opacity = 255;

        const strokeColor = new Color(255, 235, 0, 255);
        const offsets = [
            new Vec3(-8, 0, 0),
            new Vec3(8, 0, 0),
            new Vec3(0, -8, 0),
            new Vec3(0, 8, 0),
            new Vec3(-6, -6, 0),
            new Vec3(-6, 6, 0),
            new Vec3(6, -6, 0),
            new Vec3(6, 6, 0),
            new Vec3(-4, 0, 0),
            new Vec3(4, 0, 0),
            new Vec3(0, -4, 0),
            new Vec3(0, 4, 0),
        ];

        offsets.forEach((offset, index) => {
            const strokeNode = new Node(`EdgeStroke-${index}`);
            strokeRoot.addChild(strokeNode);
            strokeNode.setPosition(offset);

            const strokeSprite = strokeNode.addComponent(Sprite);
            strokeSprite.spriteFrame = this.spriteComponent!.spriteFrame;
            strokeSprite.color = strokeColor;
        });

        tween(strokeOpacity)
            .to(0.55, { opacity: 255 }, { easing: 'sineInOut' })
            .to(0.55, { opacity: 235 }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();

        this.selectionGlow = strokeRoot;
    }
}

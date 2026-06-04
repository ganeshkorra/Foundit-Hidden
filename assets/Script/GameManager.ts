// FILE: GameManager.ts (Final Version with 3-Second Hold)

import { _decorator, Component, Node, director, ProgressBar, Label, Button, tween, Vec3, UIOpacity, SpriteFrame, Sprite, UITransform, v3, Tween, AudioSource, Graphics, Color, EventTouch } from 'cc';
import { CollectibleCoin, COLLECT_COIN_EVENT, ITEM_TAPPED_EVENT } from './CollectibleCoin';
import { CollectionContainer, CONTAINER_COMPLETE_EVENT } from './CollectionContainer';

declare const mraid: any;
const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    // ... (All properties remain the same)
    @property({ type: [CollectionContainer] })
    public collectionContainers: CollectionContainer[] = [];
    @property({ type: ProgressBar })
    public mainProgressBar: ProgressBar | null = null;
    @property({ type: Node })
    public instructionText: Node | null = null;
    @property({ type: Label })
    public timerLabel: Label | null = null;
    @property({ type: Node })
    public allCollectibleItems: Node[] = [];
    @property({ type: Node })
    public endScreenPanel: Node | null = null;
    @property({ type: Button })
    public ctaButton: Button | null = null;
    @property({ type: Node })
    public endScreenIcon: Node | null = null;
    @property({ type: Node })
    public handNode: Node | null = null;
    @property({ type: SpriteFrame })
    public idleHandSprite: SpriteFrame | null = null;
    @property({ type: SpriteFrame })
    public clickHandSprite: SpriteFrame | null = null;
    @property({ type: Node })
    public tutorialTargetCoin: Node | null = null;
    @property({ type: Number })
    public tutorialHandScale: number = 3.0;
    @property({ type: Vec3 })
    public tutorialHandOffset: Vec3 = v3(-20, 30, 0);
    @property({ type: AudioSource, tooltip: "The background music." })
    public backgroundMusic: AudioSource | null = null;
    @property({ type: AudioSource, tooltip: "The sound for tapping a collectible." })
    public tapSound: AudioSource | null = null;
    @property({ type: Number })
    public gameDuration: number = 60.0;
    @property({ type: Number })
    public hintInterval: number = 5.0;
    
    @property({ type: Node, tooltip: "The simple full-screen dark overlay node." })
    public highlightOverlay: Node | null = null;
    @property({ type: Node, tooltip: "The sprite node that glows behind the hint coin." })
    public tutorialHintGlow: Node | null = null;
    @property({ type: Node, tooltip: "The duplicate coin sprite that appears on top of the overlay." })
    public tutorialHintCoin: Node | null = null;
    
    @property({ type: Node, tooltip: "The parent node for the luck level UI." })
    public luckLevelPanel: Node | null = null;
    @property({ type: Label, tooltip: "The label that displays the luck percentage." })
    public luckLevelLabel: Label | null = null;
    @property({ type: ProgressBar, tooltip: "The progress bar for the luck level." })
    public luckLevelProgressBar: ProgressBar | null = null;
    @property({ type: Node, tooltip: "Fake node placed between the mother's eyes for crying tears." })
    public parentCryAnchor: Node | null = null;
    @property({ type: Node, tooltip: "Fake node placed between the child's eyes for crying tears." })
    public childCryAnchor: Node | null = null;
    @property({ type: Node, tooltip: "The actual mother sprite node to shake while crying." })
    public motherCryNode: Node | null = null;
    @property({ type: Node, tooltip: "Happy mother/lady sprite shown briefly after each successful collection." })
    public happyLadyNode: Node | null = null;
    @property({ type: Node, tooltip: "The actual child sprite node to shake while crying." })
    public childCryNode: Node | null = null;
    @property({ type: Node, tooltip: "Large gameplay node that can be dragged to reveal off-screen collectibles. Defaults to Canvas/BG." })
    public panRoot: Node | null = null;
    @property({ type: Boolean, tooltip: "Allow player to drag the gameplay area." })
    public enableScreenPan: boolean = true;
    @property({ type: Number, tooltip: "Extra pan space beyond the calculated content bounds." })
    public panPadding: number = 40;
    @property({ type: Number, tooltip: "Lower values make drag panning slower." })
    public panDragSensitivity: number = 0.45;
    @property({ type: Number, tooltip: "Higher values make the pan catch up faster." })
    public panFollowSpeed: number = 3;
    @property({ type: Number, tooltip: "Delay after opening pair pan settles before showing the hand." })
    public openingPairHandDelay: number = 0.01;
    @property({ type: Number, tooltip: "Show the first pair hand when pan is within this distance of the target." })
    public openingPairHandPanThreshold: number = 45;
    @property({ type: Boolean, tooltip: "Print idle hint state changes to the console." })
    public enableHintDebugLogs: boolean = true;


    private isGameStarted: boolean = false;
    private isGameOver: boolean = false;
    private currentTime: number = 0;
    private idleTimer: number = 0;
    private uncollectedCoins: Node[] = [];
    private completedContainers: number = 0; 
    private totalContainers: number = 0; 
    private handTween: Tween<Node> | null = null;
    private coinTween: Tween<Node> | null = null;
    private glowTween: Tween<Node> | null = null;
    private pairPulseTween: Tween<Node> | null = null;
    private pairPulseTarget: CollectibleCoin | null = null;
    private pairPulseBaseScale: Vec3 | null = null;
    private isHintActive: boolean = false;
    private isHintPending: boolean = false;
    private totalCoinsCollected: number = 0;
    private isHintInstructionVisible: boolean = false;
    private totalCollectibleCount: number = 0;
    private currentCollectibleCount: number = 0;
    private panStartPosition: Vec3 = new Vec3();
    private panTargetPosition: Vec3 = new Vec3();
    private openingPairTutorialId: number = 0;
    private nextHintPairIndex: number = 0;
    private lastIdleDebugKey: string = '';
    private lastIdleDebugSecond: number = -1;
    private happyLadyBaseScale: Vec3 | null = null;
    private happyLadyReactionId: number = 0;
    private sadReactionEffectsRoot: Node | null = null;
    private keepHappyLadyVisible: boolean = false;
    
    onLoad() { this.setupPanRoot(); this.setupEventListeners(); this.createSadReactionEffects(); this.resetGame(); }
    onDestroy() { this.cleanupEventListeners(); }
    update(deltaTime: number) { this.updateSmoothPan(deltaTime); if (!this.isGameStarted || this.isGameOver) return; this.updateGameTimer(deltaTime); this.updateIdleTimer(deltaTime); }
    private setupEventListeners() {
        director.on(ITEM_TAPPED_EVENT, this.onAnyItemTapped, this);
        director.on(COLLECT_COIN_EVENT, this.onAnyItemCollected, this);
        this.panRoot?.on(Node.EventType.TOUCH_MOVE, this.onPanTouchMove, this);
    }

    private cleanupEventListeners() {
        director.off(ITEM_TAPPED_EVENT, this.onAnyItemTapped, this);
        director.off(COLLECT_COIN_EVENT, this.onAnyItemCollected, this);
        this.panRoot?.off(Node.EventType.TOUCH_MOVE, this.onPanTouchMove, this);
    }

    private onAnyItemTapped(item?: CollectibleCoin) {
        if (this.isGameOver) return; 
        if (this.tapSound) { this.tapSound.play(); } 
        if (!this.isGameStarted) {
            this.startGame(item);
        } else {
            this.stopTutorial();
            this.scheduleOnce(() => this.updatePairPulseForSelection(item), 0);
        }
        
        this.idleTimer = 0; 
    }

    private onAnyItemCollected(coinNode: Node, _spriteFrame: SpriteFrame, _worldPos: Vec3, sourceNodes: Node[] = []) { 
        if (this.isGameOver) return; 

        const collectedNodes = sourceNodes.length > 0 ? sourceNodes : [coinNode];
        collectedNodes.forEach(node => {
            const index = this.uncollectedCoins.indexOf(node); 
            if (index > -1) { 
                this.uncollectedCoins.splice(index, 1); 
            }
        });
        
        this.currentCollectibleCount++;
        this.updateMainProgressBar();
        this.totalCoinsCollected++; 
        this.playHappyLadyReaction();

        // Simplified win condition
        if (this.totalCoinsCollected >= this.totalCollectibleCount && this.totalCollectibleCount > 0) {
             this.endGame(true); 
        } 
    }
    
    private onContainerCompleted() {
         if (this.isGameOver) return;
         this.completedContainers++; 
    }
    
    private startGame(firstTappedItem?: CollectibleCoin) {
        this.isGameStarted = true;
        const shouldGuidePair = this.tryShowPairTutorial(firstTappedItem);
        if (!shouldGuidePair) {
            this.stopTutorial();
        }
        this.hideInstructionText();
        if (this.backgroundMusic) {
            this.backgroundMusic.play();
        }
    }

    private endGame(didWin: boolean) {
        if (this.isGameOver) return;
        this.isGameOver = true;
    
        if (this.backgroundMusic) { this.backgroundMusic.stop(); }
        this.stopTutorial();
        this.allCollectibleItems.forEach(itemNode => { 
            const button = itemNode.getComponent(Button);
            if(button) button.interactable = false; 
        });

        if (didWin) {
            this.showFinalHappyLadyState();
            this.showLuckLevelSequence();
        } else {
            tween(this.node).delay(0.5).call(() => this.showEndScreen()).start();
        }
    }

    // --- MODIFIED FUNCTION WITH NEW TIMING ---
    private showLuckLevelSequence() {
        if (!this.luckLevelPanel || !this.luckLevelLabel || !this.luckLevelProgressBar) {
            console.error("Luck Level UI not assigned in the Inspector! Skipping sequence.");
            this.showEndScreen();
            return;
        }

        // 1. Prepare UI
        const luckPercent = Math.floor(Math.random() * 21) + 80; // Random % from 80 to 100
        this.luckLevelLabel.string = `${luckPercent}%`;
        this.luckLevelProgressBar.progress = 0;
        
        const panelOpacity = this.luckLevelPanel.getComponent(UIOpacity)!;
        panelOpacity.opacity = 0;
        this.luckLevelPanel.setScale(v3(0.7, 0.7, 1));
        this.luckLevelPanel.active = true;

        // 2. Animate the sequence
        const barFillDuration = 1.5; // How long it takes for the progress bar to fill
        const holdDuration = 2.0;    // How long to show the panel after animation

        tween(this.node)
            // Animate the panel popping onto the screen
            .call(() => {
                tween(panelOpacity).to(0.4, { opacity: 255 }).start();
                tween(this.luckLevelPanel!).to(0.5, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
            })
            .delay(0.7) // Short delay for a nice rhythm
            
            // Animate the progress bar filling up
            .call(() => {
                tween(this.luckLevelProgressBar!)
                    .to(barFillDuration, { progress: luckPercent / 100 }, { easing: 'cubicOut' })
                    .start();
            })
            .delay(barFillDuration) // IMPORTANT: Wait for the bar fill animation to complete

            // NOW, hold for the specified duration
            .delay(holdDuration)

            // Fade out the entire panel
            .call(() => {
                tween(panelOpacity)
                    .to(0.4, { opacity: 0 }, { easing: 'cubicIn' })
                    .call(() => { 
                        if (this.luckLevelPanel) this.luckLevelPanel.active = false; 
                    })
                    .start();
            })
            .delay(0.4) // Wait for fade-out to complete

            // Finally, show the real end screen
            .call(() => {
                this.showEndScreen();
            })
            .start();
    }

    private showEndScreen() {
        if (this.endScreenPanel) {
            this.endScreenPanel.active = true;
            
            const panelOpacity = this.endScreenPanel.getComponent(UIOpacity);
            const elementsToAnimate = [this.endScreenIcon, this.ctaButton?.node];

            if (panelOpacity) panelOpacity.opacity = 0;
            
            elementsToAnimate.forEach(el => { 
                if (el) { 
                    el.setScale(new Vec3(0.7, 0.7, 1)); 
                    const opacity = el.getComponent(UIOpacity); 
                    if (opacity) opacity.opacity = 0; 
                    el.active = true; 
                } 
            });

            if (panelOpacity) { 
                tween(panelOpacity).to(0.3, { opacity: 200 }).start(); 
            }

            if (this.endScreenIcon) { 
                const opacity = this.endScreenIcon.getComponent(UIOpacity); 
                if(opacity) tween(opacity).delay(0.2).to(0.5, { opacity: 255 }, { easing: 'cubicOut' }).start(); 
                tween(this.endScreenIcon).delay(0.2).to(0.5, { scale: Vec3.ONE }, { easing: 'backOut' }).start(); 
            }

            if (this.ctaButton) { 
                const opacity = this.ctaButton.node.getComponent(UIOpacity); 
                if(opacity) tween(opacity).delay(0.5).to(0.5, { opacity: 255 }, { easing: 'cubicOut' }).start(); 
                tween(this.ctaButton.node).delay(0.5).to(0.6, { scale: Vec3.ONE }, { easing: 'backOut' }).start(); 
            }
        }
    }

    public resetGame() {
        if (this.backgroundMusic) { this.backgroundMusic.stop(); }
        if (this.endScreenPanel) { this.endScreenPanel.active = false; }
        if (this.highlightOverlay) { this.highlightOverlay.active = false; }
        if (this.tutorialHintGlow) { this.tutorialHintGlow.active = false; } 
        if (this.tutorialHintCoin) { this.tutorialHintCoin.active = false; }
        if (this.luckLevelPanel) { this.luckLevelPanel.active = false; }
        this.keepHappyLadyVisible = false;
        this.resetHappyLadyReaction();
        if (this.panRoot) {
            tween(this.panRoot).stop();
            this.panRoot.setPosition(this.panStartPosition);
            this.panTargetPosition.set(this.panStartPosition);
        }
        
        this.isGameStarted = false; this.isGameOver = false; this.isHintActive = false; this.isHintPending = false;
        this.totalCoinsCollected = 0; this.currentTime = this.gameDuration; 
        
        this.completedContainers = 0; 
        this.totalContainers = this.collectionContainers.length;

        if (this.timerLabel) this.timerLabel.node.active = true;
        if (this.ctaButton) this.ctaButton.interactable = true;
        
        this.updateGameTimer(0);
        this.collectionContainers.forEach(container => container.resetContainer());
        this.allCollectibleItems.forEach(itemNode => {
            itemNode.getComponent(CollectibleCoin)?.resetCoin();
            const button = itemNode.getComponent(Button);
            if (button) button.interactable = true;
        });

        this.totalCollectibleCount = this.getTotalCollectionGoalCount();
        this.currentCollectibleCount = 0;
        this.updateMainProgressBar();
        
        this.idleTimer = 0; 
        this.nextHintPairIndex = 0;
        this.lastIdleDebugKey = '';
        this.lastIdleDebugSecond = -1;
        this.uncollectedCoins = [...this.allCollectibleItems];
        this.stopTutorial(); 
        this.scheduleOnce(() => { this.triggerTutorial(); }, 0);
    }
    private updateGameTimer(deltaTime: number) { if (this.isGameStarted) { this.currentTime -= deltaTime; } if (this.timerLabel) { const totalSeconds = Math.max(0, Math.ceil(this.currentTime)); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; const formattedMinutes = minutes < 10 ? '0' + minutes : minutes.toString(); const formattedSeconds = seconds < 10 ? '0' + seconds : seconds.toString(); this.timerLabel.string = `${formattedMinutes}:${formattedSeconds}`; } if (this.currentTime <= 0 && this.isGameStarted) { this.endGame(false); } }
    private updateIdleTimer(deltaTime: number) {
        if (this.isHintActive) {
            this.logIdleStateOnce('blocked-active', { handActive: this.handNode?.active ?? false, idleTimer: this.idleTimer.toFixed(2) });
            return;
        }

        if (this.isHintPending) {
            this.logIdleStateOnce('blocked-pending', { idleTimer: this.idleTimer.toFixed(2) });
            return;
        }

        if (this.uncollectedCoins.length === 0) {
            this.logIdleStateOnce('blocked-empty', { idleTimer: this.idleTimer.toFixed(2) });
            return;
        }

        this.idleTimer += deltaTime;
        this.logIdleProgress();

        if (this.idleTimer >= this.hintInterval) {
            this.logHintDebug('trigger idle hint', {
                idleTimer: this.idleTimer.toFixed(2),
                hintInterval: this.hintInterval,
                uncollected: this.uncollectedCoins.length,
            });
            this.triggerHint();
            this.idleTimer = 0;
            this.lastIdleDebugSecond = -1;
        }
    }
    
    private triggerHint() { 
        if (this.uncollectedCoins.length === 0) {
            this.logHintDebug('trigger skipped: no uncollected coins');
            return;
        }

        const hintCoinNode = this.getSmartHintTarget();
        if (hintCoinNode && hintCoinNode.isValid) { 
            this.isHintPending = true;
            this.logHintDebug('hint target selected', {
                target: hintCoinNode.name,
                targetPairId: hintCoinNode.getComponent(CollectibleCoin)?.getPairId() ?? '',
                visible: this.isNodeOnCurrentScreen(hintCoinNode),
            });
            this.showIdleHintOnCurrentScreen(hintCoinNode);
            return;
        }

        this.logHintDebug('trigger skipped: no valid smart target', {
            liveItems: this.getLiveCollectibleItems().length,
            visibleItems: this.getVisibleCollectibleItems(this.getLiveCollectibleItems()).length,
            uncollected: this.uncollectedCoins.length,
        });
    }

    private getSmartHintTarget() {
        const liveItems = this.getLiveCollectibleItems();
        if (liveItems.length === 0) return null;

        const visibleItems = this.getVisibleCollectibleItems(liveItems);
        if (visibleItems.length === 0) {
            this.logHintDebug('no visible items for idle hint', { liveItems: liveItems.length });
            return null;
        }

        const selectedItem = visibleItems.find(item => item.isWaitingForPair());
        if (selectedItem) {
            const pairItem = this.findPairItem(selectedItem);
            if (pairItem?.node?.isValid && this.isNodeOnCurrentScreen(pairItem.node)) {
                return pairItem.node;
            }
        }

        const availablePairs = this.getAvailableHintPairs(visibleItems);
        if (availablePairs.length > 0) {
            const pairIndex = this.nextHintPairIndex % availablePairs.length;
            this.nextHintPairIndex++;
            const pair = availablePairs[pairIndex];
            return pair[0].node;
        }

        return visibleItems[0]?.node ?? null;
    }

    private getLiveCollectibleItems() {
        return this.uncollectedCoins
            .filter(itemNode => itemNode?.isValid)
            .map(itemNode => itemNode.getComponent(CollectibleCoin))
            .filter((item): item is CollectibleCoin => !!item && !item.isAlreadyCollected());
    }

    private getVisibleCollectibleItems(items: CollectibleCoin[]) {
        return items.filter(item => this.isNodeOnCurrentScreen(item.node));
    }

    private isNodeOnCurrentScreen(targetNode: Node | null) {
        if (!targetNode?.isValid) return false;

        const canvas = this.node.scene?.getChildByName('Canvas');
        const canvasTransform = canvas?.getComponent(UITransform);
        if (!canvasTransform) return true;

        const targetTransform = targetNode.getComponent(UITransform);
        if (!targetTransform) return false;

        const canvasPosition = canvasTransform.convertToNodeSpaceAR(targetTransform.convertToWorldSpaceAR(v3(0, 0, 0)));
        const halfWidth = canvasTransform.contentSize.width * 0.5;
        const halfHeight = canvasTransform.contentSize.height * 0.5;
        const margin = 35;

        return canvasPosition.x >= -halfWidth + margin
            && canvasPosition.x <= halfWidth - margin
            && canvasPosition.y >= -halfHeight + margin
            && canvasPosition.y <= halfHeight - margin;
    }

    private getAvailableHintPairs(items: CollectibleCoin[]) {
        const pairs: CollectibleCoin[][] = [];
        const itemsByPairId = new Map<string, CollectibleCoin[]>();

        items.forEach(item => {
            const pairId = item.getPairId();
            if (!pairId) return;

            const pairItems = itemsByPairId.get(pairId) ?? [];
            pairItems.push(item);
            itemsByPairId.set(pairId, pairItems);
        });

        itemsByPairId.forEach(pairItems => {
            if (pairItems.length >= 2) {
                pairs.push([pairItems[0], pairItems[1]]);
            }
        });

        return pairs;
    }

    private logIdleStateOnce(key: string, data?: Record<string, unknown>) {
        if (this.lastIdleDebugKey === key) return;
        this.lastIdleDebugKey = key;
        this.logHintDebug(`idle ${key}`, data);
    }

    private logIdleProgress() {
        this.lastIdleDebugKey = 'counting';
        if (!this.enableHintDebugLogs) return;

        const wholeSecond = Math.floor(this.idleTimer);
        if (wholeSecond === this.lastIdleDebugSecond || wholeSecond % 5 !== 0) return;

        this.lastIdleDebugSecond = wholeSecond;
        console.log('[HintDebug] idle counting', {
            idleTimer: this.idleTimer.toFixed(2),
            hintInterval: this.hintInterval,
            uncollected: this.uncollectedCoins.length,
        });
    }

    private logHintDebug(message: string, data?: Record<string, unknown>) {
        if (!this.enableHintDebugLogs) return;
        if (data) {
            console.log(`[HintDebug] ${message}`, data);
        } else {
            console.log(`[HintDebug] ${message}`);
        }
    }

    private hideInstructionText() { if (!this.instructionText) return; tween(this.instructionText).stop(); const opacityComp = this.instructionText.getComponent(UIOpacity); if (opacityComp) { tween(opacityComp).to(0.3, { opacity: 0 }, { easing: 'backIn' }).start(); } tween(this.instructionText).to(0.3, { scale: Vec3.ZERO }, { easing: 'backIn' }).call(() => { if (this.instructionText) this.instructionText.active = false; }).start(); }
    private updateMainProgressBar() {
        if (this.mainProgressBar) {
            this.mainProgressBar.progress = this.totalCollectibleCount > 0 ? this.currentCollectibleCount / this.totalCollectibleCount : 0;
        }
    }
    
    private triggerTutorial() { 
        if (this.isGameStarted) return; 
        if (this.tutorialTargetCoin && this.tutorialTargetCoin.isValid) {
            this.playTapTutorial(this.tutorialTargetCoin, true); 
        } 
    }

    private tryShowPairTutorial(firstTappedItem?: CollectibleCoin) {
        if (!firstTappedItem || firstTappedItem.node !== this.tutorialTargetCoin) {
            return false;
        }

        const pairItem = this.findPairItem(firstTappedItem);
        if (!pairItem) {
            return false;
        }

        this.stopTutorial();
        this.focusPanOnPair(firstTappedItem.node, pairItem.node);
        this.playPairPulse(pairItem);
        this.showOpeningPairHandAfterPan(firstTappedItem, pairItem.getPairId());
        return true;
    }

    private findPairItem(item: CollectibleCoin) {
        const pairId = item.getPairId();
        if (!pairId) return null;

        return this.findPairItemById(pairId, item.node);
    }

    private findPairItemById(pairId: string, excludeNode?: Node | null) {
        const pairNode = this.allCollectibleItems.find(itemNode => {
            if (!itemNode?.isValid || itemNode === excludeNode) return false;
            const collectible = itemNode.getComponent(CollectibleCoin);
            return !!collectible && !collectible.isAlreadyCollected() && collectible.getPairId() === pairId;
        }) ?? null;

        return pairNode?.getComponent(CollectibleCoin) ?? null;
    }

    private createSadReactionEffects() {
        const canvas = this.node.scene?.getChildByName('Canvas');
        const bgNode = canvas?.getChildByName('BG');
        if (!bgNode) return;

        const existingEffectsRoot = bgNode.getChildByName('SadReactionEffects');
        if (existingEffectsRoot) {
            this.sadReactionEffectsRoot = existingEffectsRoot;
            return;
        }

        const effectsRoot = new Node('SadReactionEffects');
        bgNode.addChild(effectsRoot);
        effectsRoot.setPosition(Vec3.ZERO);
        this.sadReactionEffectsRoot = effectsRoot;

        const parentCenter = this.getEffectPosition(this.parentCryAnchor, effectsRoot, new Vec3(1960 - 1920, 1080 - 582, 0));
        const childCenter = this.getEffectPosition(this.childCryAnchor, effectsRoot, new Vec3(1444 - 1920, 1080 - 704, 0));

        this.createParentCryingEffect(effectsRoot, parentCenter);
        this.createChildSprinkleCryingEffect(effectsRoot, childCenter);
        this.createChildIrritationMark(effectsRoot, new Vec3(childCenter.x + 70, childCenter.y + 120, 0));
        this.startCryingShake(this.motherCryNode ?? bgNode.getChildByName('Mother'), 7, 1.5, 0);
        this.startCryingShake(this.childCryNode ?? bgNode.getChildByName('Child'), 10, 2.2, 0.12);
    }

    private playHappyLadyReaction() {
        const happyNode = this.getHappyLadyNode();
        if (!happyNode?.isValid) return;

        const reactionId = ++this.happyLadyReactionId;
        this.setSadMotherVisible(false);

        tween(happyNode).stop();
        const happyOpacity = happyNode.getComponent(UIOpacity) ?? happyNode.addComponent(UIOpacity);
        tween(happyOpacity).stop();

        if (!this.happyLadyBaseScale) {
            this.happyLadyBaseScale = happyNode.scale.clone();
        }

        const baseScale = this.happyLadyBaseScale;
        const introScale = new Vec3(baseScale.x * 0.8, baseScale.y * 0.8, baseScale.z);
        const popScale = new Vec3(baseScale.x * 1.08, baseScale.y * 1.08, baseScale.z);
        const settleScale = new Vec3(baseScale.x, baseScale.y, baseScale.z);
        const pulseScale = new Vec3(baseScale.x * 1.05, baseScale.y * 1.05, baseScale.z);
        const outroScale = new Vec3(baseScale.x * 0.88, baseScale.y * 0.88, baseScale.z);

        happyNode.active = true;
        happyOpacity.opacity = 0;
        happyNode.setScale(introScale);

        tween(happyOpacity)
            .to(0.12, { opacity: 255 }, { easing: 'quadOut' })
            .delay(1.0)
            .to(0.2, { opacity: 0 }, { easing: 'quadIn' })
            .call(() => {
                if (reactionId !== this.happyLadyReactionId) return;
                if (happyNode.isValid) {
                    happyNode.active = this.keepHappyLadyVisible;
                }
                if (!this.isGameOver && !this.keepHappyLadyVisible) {
                    this.setSadMotherVisible(true);
                }
            })
            .start();

        tween(happyNode)
            .to(0.2, { scale: popScale }, { easing: 'backOut' })
            .to(0.18, { scale: settleScale }, { easing: 'sineInOut' })
            .to(0.18, { scale: pulseScale }, { easing: 'sineInOut' })
            .delay(0.55)
            .to(0.2, { scale: outroScale }, { easing: 'quadIn' })
            .start();

        this.createHappySparkles(happyNode);
    }

    private resetHappyLadyReaction() {
        this.happyLadyReactionId++;
        const happyNode = this.getHappyLadyNode();
        if (happyNode?.isValid) {
            tween(happyNode).stop();
            const opacity = happyNode.getComponent(UIOpacity);
            if (opacity) {
                tween(opacity).stop();
                opacity.opacity = 0;
            }
            if (this.happyLadyBaseScale) {
                happyNode.setScale(this.happyLadyBaseScale);
            }
            happyNode.active = false;
        }

        this.setSadMotherVisible(true);
    }

    private showFinalHappyLadyState() {
        const happyNode = this.getHappyLadyNode();
        if (!happyNode?.isValid) return;

        this.keepHappyLadyVisible = true;
        this.happyLadyReactionId++;
        this.setSadMotherVisible(false);

        tween(happyNode).stop();
        const happyOpacity = happyNode.getComponent(UIOpacity) ?? happyNode.addComponent(UIOpacity);
        tween(happyOpacity).stop();

        if (!this.happyLadyBaseScale) {
            this.happyLadyBaseScale = happyNode.scale.clone();
        }

        const baseScale = this.happyLadyBaseScale;
        happyNode.active = true;
        happyOpacity.opacity = 255;
        happyNode.setScale(baseScale);

        tween(happyNode)
            .to(0.35, {
                scale: new Vec3(baseScale.x * 1.05, baseScale.y * 1.05, baseScale.z)
            }, { easing: 'sineInOut' })
            .to(0.35, { scale: baseScale }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();

        this.createHappySparkles(happyNode);
    }

    private getHappyLadyNode() {
        if (this.happyLadyNode?.isValid) return this.happyLadyNode;
        return this.node.scene?.getChildByName('Canvas')?.getChildByName('BG')?.getChildByName('happy lady') ?? null;
    }

    private getSadMotherNode() {
        if (this.motherCryNode?.isValid) return this.motherCryNode;
        return this.node.scene?.getChildByName('Canvas')?.getChildByName('BG')?.getChildByName('Mother') ?? null;
    }

    private getSadReactionEffectsRoot() {
        if (this.sadReactionEffectsRoot?.isValid) return this.sadReactionEffectsRoot;
        this.sadReactionEffectsRoot = this.node.scene?.getChildByName('Canvas')?.getChildByName('BG')?.getChildByName('SadReactionEffects') ?? null;
        return this.sadReactionEffectsRoot;
    }

    private setSadMotherVisible(isVisible: boolean) {
        const sadMotherNode = this.getSadMotherNode();
        if (sadMotherNode?.isValid) {
            sadMotherNode.active = isVisible;
        }

        const effectsRoot = this.getSadReactionEffectsRoot();
        if (effectsRoot?.isValid) {
            effectsRoot.active = isVisible;
        }
    }

    private createHappySparkles(parent: Node) {
        const sparkleRoot = new Node('HappyLadySparkles');
        parent.addChild(sparkleRoot);
        sparkleRoot.setPosition(Vec3.ZERO);

        const sparklePositions = [
            new Vec3(-145, 210, 0),
            new Vec3(120, 235, 0),
            new Vec3(-120, -10, 0),
            new Vec3(155, 40, 0),
        ];

        sparklePositions.forEach((position, index) => {
            const sparkle = new Node(`HappySparkle-${index}`);
            sparkleRoot.addChild(sparkle);
            sparkle.setPosition(position);
            sparkle.setScale(new Vec3(0.2, 0.2, 1));
            sparkle.addComponent(UITransform).setContentSize(70, 70);

            const opacity = sparkle.addComponent(UIOpacity);
            opacity.opacity = 0;

            const graphics = sparkle.addComponent(Graphics);
            graphics.strokeColor = new Color(255, 235, 75, 255);
            graphics.lineWidth = 7;
            graphics.moveTo(0, 32);
            graphics.lineTo(0, -32);
            graphics.moveTo(-32, 0);
            graphics.lineTo(32, 0);
            graphics.moveTo(-22, 22);
            graphics.lineTo(22, -22);
            graphics.moveTo(22, 22);
            graphics.lineTo(-22, -22);
            graphics.stroke();

            tween(opacity)
                .delay(index * 0.06)
                .to(0.16, { opacity: 255 }, { easing: 'quadOut' })
                .to(0.36, { opacity: 0 }, { easing: 'quadIn' })
                .start();

            tween(sparkle)
                .delay(index * 0.06)
                .to(0.38, { scale: Vec3.ONE, eulerAngles: new Vec3(0, 0, 35) }, { easing: 'backOut' })
                .to(0.18, { scale: new Vec3(0.55, 0.55, 1), eulerAngles: new Vec3(0, 0, 55) }, { easing: 'quadIn' })
                .start();
        });

        this.scheduleOnce(() => {
            if (sparkleRoot.isValid) {
                sparkleRoot.destroy();
            }
        }, 0.9);
    }

    private getEffectPosition(anchorNode: Node | null, targetParent: Node, fallbackPosition: Vec3) {
        if (!anchorNode?.isValid) return fallbackPosition;

        const parentTransform = targetParent.getComponent(UITransform) ?? targetParent.addComponent(UITransform);
        if (!parentTransform) return fallbackPosition;

        return parentTransform.convertToNodeSpaceAR(anchorNode.worldPosition);
    }

    private createParentCryingEffect(parent: Node, centerPosition: Vec3) {
        const leftEye = new Vec3(centerPosition.x - 40, centerPosition.y + 5, 0);
        const rightEye = new Vec3(centerPosition.x + 40, centerPosition.y + 3, 0);
        const groundY = centerPosition.y - 390;
        this.createCryingEffect(parent, leftEye, rightEye, groundY, 0);
    }

    private createCryingEffect(parent: Node, leftEyePosition: Vec3, rightEyePosition: Vec3, groundY: number, delay: number) {
        // this.createFaceTear(parent, leftEyePosition, delay, 1.15);
        // this.createFaceTear(parent, rightEyePosition, delay + 1, 1.15);
        this.createTearStream(parent, leftEyePosition , groundY, delay, 1);
        this.createTearStream(parent, rightEyePosition, groundY, delay + 1, 1);
    }

    // private createFaceTear(parent: Node, eyePosition: Vec3, delay: number, sizeMultiplier: number = 1) {
    //     const tearNode = new Node('FaceTearStream');
    //     parent.addChild(tearNode);
    //     tearNode.setPosition(eyePosition);
    //     tearNode.addComponent(UITransform).setContentSize(40, 90);

    //     const opacity = tearNode.addComponent(UIOpacity);
    //     opacity.opacity = 210;

    //     const graphics = tearNode.addComponent(Graphics);
    //     graphics.fillColor = new Color(40, 180, 255, 230);
    //     graphics.strokeColor = new Color(10, 110, 210, 235);
    //     graphics.lineWidth = 3;
    //     graphics.roundRect(-8 * sizeMultiplier, -58 * sizeMultiplier, 16 * sizeMultiplier, 62 * sizeMultiplier, 8 * sizeMultiplier);
    //     graphics.fill();
    //     graphics.stroke();

    //     graphics.fillColor = new Color(175, 235, 255, 210);
    //     graphics.roundRect(-3 * sizeMultiplier, -52 * sizeMultiplier, 4 * sizeMultiplier, 46 * sizeMultiplier, 2 * sizeMultiplier);
    //     graphics.fill();

    //     tween(tearNode)
    //         .delay(delay)
    //         .to(0.45, { scale: new Vec3(1, 1.18, 1) }, { easing: 'sineInOut' })
    //         .to(0.45, { scale: Vec3.ONE }, { easing: 'sineInOut' })
    //         .union()
    //         .repeatForever()
    //         .start();

    //     tween(opacity)
    //         .delay(delay)
    //         .to(0.45, { opacity: 255 }, { easing: 'sineInOut' })
    //         .to(0.45, { opacity: 175 }, { easing: 'sineInOut' })
    //         .union()
    //         .repeatForever()
    //         .start();
    // }

    private createTearStream(parent: Node, startPosition: Vec3, groundY: number, delay: number, sizeMultiplier: number = 1) {
        for (let i = 0; i < 4; i++) {
            const tearNode = new Node('FallingTearDrop');
            parent.addChild(tearNode);
            tearNode.setPosition(startPosition);
            tearNode.addComponent(UITransform).setContentSize(60, 80);

            const opacity = tearNode.addComponent(UIOpacity);
            opacity.opacity = 0;

            const graphics = tearNode.addComponent(Graphics);
            graphics.fillColor = new Color(45, 180, 255, 245);
            graphics.strokeColor = new Color(12, 100, 205, 230);
            graphics.lineWidth = 4;
            graphics.moveTo(0, 22 * sizeMultiplier);
            graphics.bezierCurveTo(20 * sizeMultiplier, 4 * sizeMultiplier, 17 * sizeMultiplier, -24 * sizeMultiplier, 0, -28 * sizeMultiplier);
            graphics.bezierCurveTo(-17 * sizeMultiplier, -24 * sizeMultiplier, -20 * sizeMultiplier, 4 * sizeMultiplier, 0, 22 * sizeMultiplier);
            graphics.fill();
            graphics.stroke();

            graphics.fillColor = new Color(210, 245, 255, 220);
            graphics.ellipse(-5 * sizeMultiplier, 5 * sizeMultiplier, 4 * sizeMultiplier, 10 * sizeMultiplier);
            graphics.fill();

            const streamDelay = delay + i * 0.24;
            const driftX = i % 2 === 0 ? -18 : 16;
            tween(tearNode)
                .delay(streamDelay)
                .call(() => {
                    tearNode.setPosition(startPosition);
                    tearNode.setScale(new Vec3(0.45, 0.45, 1));
                    opacity.opacity = 0;
                })
                .call(() => {
                    tween(opacity)
                        .to(0.12, { opacity: 255 })
                        .delay(0.52)
                        .to(0.18, { opacity: 0 })
                        .start();
                })
                .to(0.82, {
                    position: new Vec3(startPosition.x + driftX, groundY, 0),
                    scale: new Vec3(0.9, 0.9, 1)
                }, { easing: 'quadIn' })
                .call(() => {
                    opacity.opacity = 0;
                })
                .delay(0.1)
                .union()
                .repeatForever()
                .start();
        }
    }

    private createChildSprinkleCryingEffect(parent: Node, centerPosition: Vec3) {
        const leftEye = new Vec3(centerPosition.x - 36, centerPosition.y + 4, 0);
        const rightEye = new Vec3(centerPosition.x + 36, centerPosition.y + 4, 0);

        // this.createFaceTear(parent, leftEye, 0.1, 0.8);
        // this.createFaceTear(parent, rightEye, 0.35, 0.8);
        this.createSideSprinkleTears(parent, leftEye, -1, 0);
        this.createSideSprinkleTears(parent, rightEye, 1, 0.2);
    }

    private createSideSprinkleTears(parent: Node, eyePosition: Vec3, direction: number, delay: number) {
        for (let i = 0; i < 5; i++) {
            const dropNode = new Node('ChildSprinkleTear');
            parent.addChild(dropNode);
            dropNode.setPosition(eyePosition);
            dropNode.addComponent(UITransform).setContentSize(44, 32);

            const opacity = dropNode.addComponent(UIOpacity);
            opacity.opacity = 0;

            const graphics = dropNode.addComponent(Graphics);
            graphics.fillColor = new Color(75, 195, 255, 245);
            graphics.strokeColor = new Color(20, 120, 210, 220);
            graphics.lineWidth = 3;
            graphics.ellipse(0, 0, 15, 7);
            graphics.fill();
            graphics.stroke();

            const splashDelay = delay + i * 0.12;
            const endX = eyePosition.x + direction * (90 + i * 12);
            const endY = eyePosition.y + 32 - i * 14;

            tween(dropNode)
                .delay(splashDelay)
                .call(() => {
                    dropNode.setPosition(eyePosition);
                    dropNode.setScale(new Vec3(0.35, 0.35, 1));
                    opacity.opacity = 255;
                })
                .to(0.34, {
                    position: new Vec3(endX, endY, 0),
                    scale: new Vec3(0.9, 0.9, 1)
                }, { easing: 'quadOut' })
                .call(() => {
                    opacity.opacity = 0;
                })
                .delay(0.35)
                .union()
                .repeatForever()
                .start();
        }
    }

    private createChildIrritationMark(parent: Node, position: Vec3) {
        const markNode = new Node('ChildIrritationMark');
        parent.addChild(markNode);
        markNode.setPosition(position);
        markNode.addComponent(UITransform).setContentSize(100, 90);

        const graphics = markNode.addComponent(Graphics);
        graphics.strokeColor = new Color(230, 35, 35, 255);
        graphics.lineWidth = 9;
        graphics.moveTo(-30, 12);
        graphics.lineTo(-58, 36);
        graphics.lineTo(-25, 31);
        graphics.moveTo(4, 24);
        graphics.lineTo(10, 58);
        graphics.lineTo(26, 28);
        graphics.moveTo(28, 6);
        graphics.lineTo(62, 18);
        graphics.lineTo(38, -4);
        graphics.stroke();

        tween(markNode)
            .to(0.28, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'sineOut' })
            .to(0.28, { scale: Vec3.ONE }, { easing: 'sineIn' })
            .union()
            .repeatForever()
            .start();
    }

    private startCryingShake(targetNode: Node | null, moveAmount: number, rotationAmount: number, delay: number) {
        if (!targetNode?.isValid) return;

        const basePosition = targetNode.position.clone();
        const baseRotation = targetNode.eulerAngles.clone();
        tween(targetNode).stop();
        targetNode.setPosition(basePosition);
        targetNode.setRotationFromEuler(baseRotation);

        tween(targetNode)
            .delay(delay)
            .to(0.08, {
                position: new Vec3(basePosition.x - moveAmount, basePosition.y, basePosition.z),
                eulerAngles: new Vec3(baseRotation.x, baseRotation.y, baseRotation.z - rotationAmount)
            }, { easing: 'sineOut' })
            .to(0.08, {
                position: new Vec3(basePosition.x + moveAmount, basePosition.y, basePosition.z),
                eulerAngles: new Vec3(baseRotation.x, baseRotation.y, baseRotation.z + rotationAmount)
            }, { easing: 'sineInOut' })
            .to(0.08, {
                position: new Vec3(basePosition.x - moveAmount * 0.55, basePosition.y, basePosition.z),
                eulerAngles: new Vec3(baseRotation.x, baseRotation.y, baseRotation.z - rotationAmount * 0.6)
            }, { easing: 'sineInOut' })
            .to(0.08, {
                position: basePosition,
                eulerAngles: baseRotation
            }, { easing: 'sineOut' })
            .delay(0.18)
            .union()
            .repeatForever()
            .start();
    }
    
    private playTapTutorial(targetNode: Node, showInstruction: boolean) {
        if (!this.highlightOverlay || !this.tutorialHintGlow || !this.tutorialHintCoin || !targetNode?.isValid) { return; }
        if (this.handTween) { this.handTween.stop(); this.handTween = null; }
        if (this.coinTween) { this.coinTween.stop(); this.coinTween = null; }
        if (this.glowTween) { this.glowTween.stop(); this.glowTween = null; }
        
        this.highlightOverlay.active = true;
        const overlayOpacity = this.highlightOverlay.getComponent(UIOpacity);
        if (overlayOpacity) {
            tween(overlayOpacity).stop();
            overlayOpacity.opacity = 0;
            tween(overlayOpacity).to(0.4, { opacity: 200 }).start();
        }

        if (showInstruction) {
            this.playHintInstructionAnimation();
        }
        
        const worldPos = targetNode.getComponent(UITransform)!.convertToWorldSpaceAR(v3(0,0,0));
        const localPos = this.tutorialHintCoin.parent!.getComponent(UITransform)!.convertToNodeSpaceAR(worldPos);
        this.tutorialHintCoin.setPosition(localPos);
        this.tutorialHintGlow.setPosition(localPos);

        const targetSprite = targetNode.getComponent(Sprite);
        const hintSprite = this.tutorialHintCoin.getComponent(Sprite);
        if(targetSprite && hintSprite) {
            hintSprite.spriteFrame = targetSprite.spriteFrame;
        }
        this.tutorialHintCoin.setScale(targetNode.getScale());
        this.tutorialHintCoin.active = true;
        this.tutorialHintGlow.active = true;

        if (this.coinTween) { this.coinTween.stop(); }
        this.coinTween = tween(this.tutorialHintCoin)
            .to(0, { scale: new Vec3(0.55, 0.55, 1) },)
            .union().repeatForever().start();

        if (this.glowTween) { this.glowTween.stop(); }
        const glowBaseScale = 1.5;
        this.tutorialHintGlow.setScale(new Vec3(glowBaseScale, glowBaseScale, 1));
        this.glowTween = tween(this.tutorialHintGlow)
            .to(1.0, { scale: new Vec3(glowBaseScale * 1.2, glowBaseScale * 1.2, 1) }, { easing: 'sineInOut' })
            .to(1.0, { scale: new Vec3(glowBaseScale, glowBaseScale, 1) }, { easing: 'sineInOut' })
            .union().repeatForever().start();
        
        if (this.handNode) { this.handNode.active = true; }
        this.runTapAnimationLoop(targetNode);
    }

    // --- MODIFIED FUNCTION ---
    private playHintInstructionAnimation() {
        if (!this.instructionText) return;
    
        this.isHintInstructionVisible = true;
    
        // Make sure to stop any previous animations on the node
        tween(this.instructionText).stop();
        this.instructionText.active = true;
        
        const opacityComp = this.instructionText.getComponent(UIOpacity);
        
        // Reset state before animating
        if (opacityComp) opacityComp.opacity = 0;
        this.instructionText.setScale(Vec3.ZERO);
    
        // Animate opacity separately for clarity
        if (opacityComp) {
            tween(opacityComp).to(0.4, { opacity: 255 }).start();
        }

        // Chain the animations: Pop-up first, then start the continuous pulse
        tween(this.instructionText)
            // 1. The Pop-up Animation
            .to(0.5, { scale: Vec3.ONE }, { easing: 'backOut' })
            
            // 2. This .call() starts the next animation after the pop-up is complete
            .call(() => {
                // Safety check in case the node is destroyed mid-animation
                if (!this.instructionText || !this.instructionText.isValid) return;

                // 3. The Continuous Pulse Animation (repeats forever)
                tween(this.instructionText)
                    .to(1.5, { scale: new Vec3(0.95, 0.95, 1) }, { easing: 'sineInOut' })
                    .to(1.5, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
                    .union()
                    .repeatForever()
                    .start();
            })
            .start();
    }
    
    private stopTutorial() {
        this.openingPairTutorialId++;
        this.isHintActive = false;
        this.isHintPending = false;
        if (this.handTween) { this.handTween.stop(); this.handTween = null; }
        if (this.coinTween) { this.coinTween.stop(); this.coinTween = null; }
        if (this.glowTween) { this.glowTween.stop(); this.glowTween = null; }
        this.stopPairPulse();

        if (this.handNode) { this.handNode.active = false; }
        if (this.tutorialHintCoin) { this.tutorialHintCoin.active = false; }
        if (this.tutorialHintGlow) { this.tutorialHintGlow.active = false; }
        
        if (this.isHintInstructionVisible) {
            this.hideInstructionText();
            this.isHintInstructionVisible = false;
        }        
        if (this.highlightOverlay && this.highlightOverlay.active) {
            const overlayOpacity = this.highlightOverlay.getComponent(UIOpacity);
            if (overlayOpacity) {
                tween(overlayOpacity).to(0.3, { opacity: 0 }).call(() => { if (this.highlightOverlay) this.highlightOverlay.active = false; }).start();
            } else { this.highlightOverlay.active = false; }
        }
    }
    
    private runTapAnimationLoop(targetNode: Node) {
        if (!this.handNode || !this.idleHandSprite || !this.clickHandSprite || !targetNode.isValid) { this.stopTutorial(); return; }
        const handSprite = this.handNode.getComponent(Sprite)!;
        const targetPosition = this.getUIPosition(targetNode);
        if (!targetPosition) { this.stopTutorial(); return; }
        const finalHandPosition = new Vec3(); Vec3.add(finalHandPosition, targetPosition, this.tutorialHandOffset);
        handSprite.spriteFrame = this.idleHandSprite;
        this.handNode.setPosition(finalHandPosition);
        const baseScale = new Vec3(this.tutorialHandScale, this.tutorialHandScale, 1);
        const pressedScale = new Vec3(this.tutorialHandScale * 0.9, this.tutorialHandScale * 0.9, 1);
        this.handNode.setScale(baseScale);
        this.handTween = tween(this.handNode)
            .delay(0.6)
            .call(() => { handSprite.spriteFrame = this.clickHandSprite!; })
            .to(0.25, { scale: pressedScale }, { easing: 'sineOut' })
            .delay(0.15)
            .call(() => { handSprite.spriteFrame = this.idleHandSprite!; })
            .to(0.4, { scale: baseScale }, { easing: 'sineIn' })
            .delay(0.3)
            .union().repeatForever().start();
    }
    
    private getUIPosition(targetNode: Node): Vec3 | null { const referenceNode = this.handNode?.parent; if (!referenceNode || !targetNode.isValid) return null; const refUIT = referenceNode.getComponent(UITransform); if (!refUIT) return null; const worldPos = targetNode.getComponent(UITransform)!.convertToWorldSpaceAR(v3(0, 0, 0)); return refUIT.convertToNodeSpaceAR(worldPos); }

    private playHandOnlyTutorial(targetNode: Node) {
        if (!this.handNode || !targetNode?.isValid) return;

        if (this.handTween) { this.handTween.stop(); this.handTween = null; }
        if (this.coinTween) { this.coinTween.stop(); this.coinTween = null; }
        if (this.glowTween) { this.glowTween.stop(); this.glowTween = null; }

        if (this.highlightOverlay) {
            this.highlightOverlay.active = true;
            const overlayOpacity = this.highlightOverlay.getComponent(UIOpacity);
            if (overlayOpacity) {
                tween(overlayOpacity).stop();
                overlayOpacity.opacity = 0;
                tween(overlayOpacity).to(0.25, { opacity: 200 }).start();
            }
        }
        if (this.tutorialHintCoin) { this.tutorialHintCoin.active = false; }
        if (this.tutorialHintGlow) { this.tutorialHintGlow.active = false; }

        this.handNode.active = true;
        this.runTapAnimationLoop(targetNode);
    }

    private setupPanRoot() {
        if (!this.panRoot) {
            this.panRoot = this.node.scene?.getChildByName('Canvas')?.getChildByName('BG') ?? null;
        }

        if (this.panRoot) {
            this.panStartPosition.set(this.panRoot.position);
            this.panTargetPosition.set(this.panRoot.position);
        }
    }

    private onPanTouchMove(event: EventTouch) {
        if (!this.enableScreenPan || this.isGameOver || !this.panRoot) return;

        const delta = event.getUIDelta();
        const nextPosition = this.panTargetPosition.clone();
        nextPosition.x += delta.x * this.panDragSensitivity;
        nextPosition.y += delta.y * this.panDragSensitivity;
        this.panTargetPosition.set(this.getClampedPanPosition(nextPosition));
    }

    private updateSmoothPan(deltaTime: number) {
        if (!this.panRoot) return;
        const followAmount = this.clamp(deltaTime * this.panFollowSpeed, 0, 1);
        const nextPosition = new Vec3();
        Vec3.lerp(nextPosition, this.panRoot.position, this.panTargetPosition, followAmount);
        this.panRoot.setPosition(this.getClampedPanPosition(nextPosition));
    }

    private showIdleHintOnCurrentScreen(targetNode: Node) {
        const tutorialId = ++this.openingPairTutorialId;
        if (tutorialId !== this.openingPairTutorialId || this.isGameOver || !targetNode?.isValid || !this.isNodeOnCurrentScreen(targetNode)) {
            this.isHintPending = false;
            this.isHintActive = false;
            this.logHintDebug('idle hand canceled: target not visible', {
                target: targetNode?.name ?? '',
                targetValid: targetNode?.isValid ?? false,
                visible: this.isNodeOnCurrentScreen(targetNode),
            });
            return;
        }

        this.isHintPending = false;
        this.isHintActive = true;
        this.logHintDebug('show idle hand', {
            target: targetNode.name,
            visible: true,
        });
        this.playTapTutorial(targetNode, false);
    }

    private showOpeningPairHandAfterPan(firstItem: CollectibleCoin, pairId: string) {
        const tutorialId = ++this.openingPairTutorialId;
        const waitForPan = () => {
            if (tutorialId !== this.openingPairTutorialId || this.isGameOver || !this.panRoot || !firstItem.node?.isValid || firstItem.isAlreadyCollected()) {
                return;
            }

            const remainingDistance = Vec3.distance(this.panRoot.position, this.panTargetPosition);
            if (remainingDistance > this.openingPairHandPanThreshold) {
                this.scheduleOnce(waitForPan, 0.01);
                return;
            }

            this.scheduleOnce(() => {
                const pairItem = this.findPairItemById(pairId, firstItem.node);
                if (tutorialId === this.openingPairTutorialId && !this.isGameOver && pairItem?.node?.isValid && !pairItem.isAlreadyCollected()) {
                    this.idleTimer = 0;
                    this.playHandOnlyTutorial(pairItem.node);
                }
            }, this.openingPairHandDelay);
        };

        waitForPan();
    }

    private focusPanOnPair(firstNode: Node, secondNode: Node, immediate: boolean = false) {
        if (!this.enableScreenPan || !this.panRoot || !firstNode?.isValid || !secondNode?.isValid) return;

        const firstPosition = this.getNodePositionInPanParent(firstNode);
        const secondPosition = this.getNodePositionInPanParent(secondNode);
        if (!firstPosition || !secondPosition) return;

        const midpoint = new Vec3(
            (firstPosition.x + secondPosition.x) * 0.5,
            (firstPosition.y + secondPosition.y) * 0.5,
            0
        );
        const desiredPosition = this.panRoot.position.clone();
        desiredPosition.x -= midpoint.x;
        desiredPosition.y -= midpoint.y;

        this.panTargetPosition.set(this.getClampedPanPosition(desiredPosition));
        if (immediate) {
            tween(this.panRoot).stop();
            this.panRoot.setPosition(this.panTargetPosition);
        }
    }

    private getNodePositionInPanParent(targetNode: Node) {
        if (!this.panRoot?.parent || !targetNode?.isValid) return null;
        const canvas = this.node.scene?.getChildByName('Canvas');
        const canvasTransform = canvas?.getComponent(UITransform);
        if (!canvasTransform || !this.panRoot.parent) return;

        const targetCanvasPosition = canvasTransform.convertToNodeSpaceAR(targetNode.worldPosition);
        const panRootParentCanvasPosition = canvasTransform.convertToNodeSpaceAR(this.panRoot.parent!.worldPosition);
        return new Vec3(
            targetCanvasPosition.x - panRootParentCanvasPosition.x,
            targetCanvasPosition.y - panRootParentCanvasPosition.y,
            0
        );
    }

    private getClampedPanPosition(position: Vec3) {
        if (!this.panRoot) return position;

        const canvas = this.node.scene?.getChildByName('Canvas');
        const canvasTransform = canvas?.getComponent(UITransform);
        const panTransform = this.panRoot.getComponent(UITransform);
        if (!canvasTransform || !panTransform) return position;

        const scaledWidth = panTransform.contentSize.width * Math.abs(this.panRoot.scale.x);
        const scaledHeight = panTransform.contentSize.height * Math.abs(this.panRoot.scale.y);
        const viewWidth = canvasTransform.contentSize.width;
        const viewHeight = canvasTransform.contentSize.height;
        const maxX = Math.max(0, (scaledWidth - viewWidth) * 0.5 + this.panPadding);
        const maxY = Math.max(0, (scaledHeight - viewHeight) * 0.5 + this.panPadding);

        return new Vec3(
            this.clamp(position.x, this.panStartPosition.x - maxX, this.panStartPosition.x + maxX),
            this.clamp(position.y, this.panStartPosition.y - maxY, this.panStartPosition.y + maxY),
            position.z
        );
    }

    private playPairPulse(pairItem: CollectibleCoin) {
        this.stopPairPulse();
        if (!pairItem.node?.isValid || pairItem.isAlreadyCollected()) return;

        this.pairPulseTarget = pairItem;
        const baseScale = pairItem.node.scale.clone();
        this.pairPulseBaseScale = baseScale;
        const pulseScale = new Vec3(baseScale.x * 1.08, baseScale.y * 1.08, baseScale.z);
        this.pairPulseTween = tween(pairItem.node)
            .to(0.45, { scale: pulseScale }, { easing: 'sineInOut' })
            .to(0.45, { scale: baseScale }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    private stopPairPulse() {
        if (this.pairPulseTween) {
            this.pairPulseTween.stop();
            this.pairPulseTween = null;
        }

        if (this.pairPulseTarget?.node?.isValid && !this.pairPulseTarget.isAlreadyCollected() && this.pairPulseBaseScale) {
            this.pairPulseTarget.node.setScale(this.pairPulseBaseScale);
        }
        this.pairPulseTarget = null;
        this.pairPulseBaseScale = null;
    }

    private updatePairPulseForSelection(tappedItem?: CollectibleCoin) {
        if (!tappedItem?.node?.isValid || tappedItem.isAlreadyCollected()) {
            this.stopPairPulse();
            return;
        }

        if (!tappedItem.isWaitingForPair()) {
            this.stopPairPulse();
            return;
        }

        const pairItem = this.findPairItem(tappedItem);
        if (!pairItem) {
            this.stopPairPulse();
            return;
        }

        this.focusPanOnPair(tappedItem.node, pairItem.node);
        this.playPairPulse(pairItem);
    }

    private clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, value));
    }

    private getTotalCollectionGoalCount() {
        const containerTotal = this.collectionContainers.reduce((total, container) => total + container.getCollectionGoalCount(), 0);
        if (containerTotal > 0) {
            return containerTotal;
        }

        const pairIds = new Set<string>();
        let unpairedItems = 0;

        this.allCollectibleItems.forEach(itemNode => {
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
}

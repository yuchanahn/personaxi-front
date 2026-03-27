// StateManager.ts - VRM Character State Machine
// Author: Senior Graphics R&D Engineer
// Purpose: FSM-based behavior management with pose/expression blending
// -----------------------------------------------------------------------------

import * as THREE from 'three/webgpu';
import { VRM } from '@pixiv/three-vrm';
import { Model } from '../core/model';
import { ANIMATION_POOLS, type AnimationPoolConfig, type WeightedAnimation } from '../animation/vrmAnimationCatalog';

// StateManager.ts - 가중치 기반 랜덤 애니메이션 시스템 추가
// Author: Senior Graphics R&D Engineer  
// -----------------------------------------------------------------------------

//------------------------------------------------------------------
// Animation Pool Configuration
//------------------------------------------------------------------

//------------------------------------------------------------------
// Animation Pool Manager
//------------------------------------------------------------------

class AnimationPoolManager {
    private model: Model;
    private currentPoolName: string = '';
    private currentClipName: string = '';
    private clipTimer: number = 0;
    private nextChangeTime: number = 0;
    private isBlending: boolean = false;
    private blendTimer: number = 0;
    private currentTransitionTime: number = 0;

    // Gesture Tracking
    private isGesturePlaying: boolean = false;
    private currentGestureAction: THREE.AnimationAction | null = null;
    private isGesturePending: boolean = false;
    private queuedGestureCountHint: number = 0;
    private gestureElapsed: number = 0;
    private gestureDuration: number = 0;
    private gestureOverlapTime: number = 0;
    private gestureFadeStarted: boolean = false;
    private retiringActions: Array<{ action: THREE.AnimationAction; remaining: number }> = [];
    private transientGestureClips = new Map<THREE.AnimationAction, THREE.AnimationClip>();

    private gestureMixer: THREE.AnimationMixer;
    private backgroundRequestToken = 0;
    private gestureRequestToken = 0;

    constructor(model: Model) {
        this.model = model;
        this.gestureMixer = new THREE.AnimationMixer(model.vrm?.scene!);
    }

    public setPool(poolName: string): void {
        if (this.currentPoolName === poolName) return;

        console.log(`[AnimPool] Switching to pool: ${poolName}`);
        this.currentPoolName = poolName;
        this.clipTimer = 0;

        // 제스처 재생 중이면 강제 변경 하지 않음
        // (State는 변경되었으므로, 제스처 끝나면 resumeBackgroundAnimation에서 새 pool의 클립이 선택됨)
        if (!this.isGesturePlaying) {
            this.selectAndPlayNextClip(true);
        }
    }

    public triggerGesture(clipName: string, transitionTime: number = 0.3): void {
        if (!this.canStartGesture()) return;

        this.isGesturePending = true;
        const requestToken = ++this.gestureRequestToken;
        void this.triggerGestureAsync(clipName, transitionTime, requestToken);
    }

    public canStartGesture(): boolean {
        return !this.isGesturePending && !this.isGesturePlaying;
    }

    public isGestureActive(): boolean {
        return this.isGesturePending || this.isGesturePlaying;
    }

    public setQueuedGestureCountHint(count: number): void {
        this.queuedGestureCountHint = Math.max(0, count);
    }

    private getKnownActions(): THREE.AnimationAction[] {
        const persistentActions = Object.values(this.model.actions);
        const transientActions = Array.from(this.transientGestureClips.keys());
        return [...new Set([...persistentActions, ...transientActions])];
    }

    private getDominantAction(exclude?: THREE.AnimationAction | null): THREE.AnimationAction | null {
        const actions = this.getKnownActions();
        let bestAction: THREE.AnimationAction | null = null;
        let bestWeight = 0.0001;

        for (const action of actions) {
            if (!action || action === exclude) continue;

            let weight = 0;
            try {
                weight = action.enabled ? action.getEffectiveWeight() : 0;
            } catch {
                weight = 0;
            }

            const isUsable = weight > 0.0001;
            if (!isUsable) continue;

            if (weight > bestWeight) {
                bestWeight = weight;
                bestAction = action;
            }
        }

        return bestAction;
    }

    private getActiveActions(exclude?: THREE.AnimationAction | null): THREE.AnimationAction[] {
        return this.getKnownActions().filter((action) => {
            if (!action || action === exclude) return false;

            try {
                return action.enabled && action.getEffectiveWeight() > 0.0001;
            } catch {
                return false;
            }
        });
    }

    private createTransientGestureAction(baseAction: THREE.AnimationAction): THREE.AnimationAction | null {
        const mixer = this.model.mixer;
        if (!mixer) return null;

        const transientClip = baseAction.getClip().clone();
        const transientAction = mixer.clipAction(transientClip);
        this.transientGestureClips.set(transientAction, transientClip);
        return transientAction;
    }

    private disposeTransientGestureAction(action: THREE.AnimationAction): void {
        const transientClip = this.transientGestureClips.get(action);
        if (!transientClip) return;

        this.transientGestureClips.delete(action);

        try {
            action.stop();
            action.reset();
        } catch { }

        try {
            this.model.mixer?.uncacheAction(transientClip, this.model.vrm?.scene);
        } catch { }

        try {
            this.model.mixer?.uncacheClip(transientClip);
        } catch { }
    }

    private fadeOutConflictingActions(
        keep: Array<THREE.AnimationAction | null>,
        fadeTime: number,
    ): void {
        const keepSet = new Set(keep.filter(Boolean) as THREE.AnimationAction[]);
        for (const action of this.getActiveActions()) {
            if (keepSet.has(action)) continue;

            try {
                action.fadeOut(fadeTime);
            } catch { }
            this.enqueueRetiringAction(action, fadeTime + 0.05);
        }
    }

    private enqueueRetiringAction(action: THREE.AnimationAction, remaining: number): void {
        if (remaining <= 0) {
            try {
                action.stop();
                action.reset();
            } catch { }
            return;
        }

        const existing = this.retiringActions.find((entry) => entry.action === action);
        if (existing) {
            existing.remaining = Math.max(existing.remaining, remaining);
            return;
        }

        this.retiringActions.push({ action, remaining });
    }

    private cancelRetiringAction(action: THREE.AnimationAction | null | undefined): void {
        if (!action) return;
        this.retiringActions = this.retiringActions.filter((entry) => entry.action !== action);
    }

    private updateRetiringActions(dt: number): void {
        if (this.retiringActions.length === 0) return;

        this.retiringActions = this.retiringActions.filter((entry) => {
            entry.remaining -= dt;
            if (entry.remaining > 0) return true;

            try {
                entry.action.stop();
                entry.action.reset();
            } catch { }
            this.disposeTransientGestureAction(entry.action);
            return false;
        });
    }

    private async triggerGestureAsync(
        clipName: string,
        transitionTime: number,
        requestToken: number,
    ): Promise<void> {
        const baseAction = await this.model.ensureAnimationLoaded(clipName);
        if (!baseAction || requestToken !== this.gestureRequestToken) {
            this.isGesturePending = false;
            return;
        }
        let action = baseAction;
        if (this.currentGestureAction === baseAction) {
            action = this.createTransientGestureAction(baseAction) ?? baseAction;
        }
        action.clampWhenFinished = false;
        action.enabled = true;

        console.log(`[AnimPool] Triggering gesture: ${clipName}`);

        const previousGestureAction = this.currentGestureAction;
        const fromAction = this.getDominantAction(action);

        this.cancelRetiringAction(action);
        action.reset();
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.enabled = true;
        action.play();

        if (fromAction) {
            action.crossFadeFrom(fromAction, transitionTime, false);
            if (previousGestureAction && previousGestureAction !== action) {
                this.enqueueRetiringAction(previousGestureAction, transitionTime + 0.05);
            }
        } else {
            action.fadeIn(transitionTime);
            if (previousGestureAction && previousGestureAction !== action) {
                try {
                    previousGestureAction.fadeOut(transitionTime);
                } catch { }
                this.enqueueRetiringAction(previousGestureAction, transitionTime + 0.05);
            }
        }
        this.fadeOutConflictingActions([action, fromAction], transitionTime);

        this.isGesturePlaying = true;
        this.isGesturePending = false;
        this.currentGestureAction = action;
        this.gestureElapsed = 0;
        this.gestureDuration = action.getClip().duration;
        this.gestureOverlapTime = Math.min(transitionTime, Math.max(this.gestureDuration * 0.35, 0.08));
        this.gestureFadeStarted = false;
    }

    private resumeBackgroundAnimation(transitionTime: number): void {
        // "이전 클립"을 되살리는 것이 아니라, "현재 상태(Pool)"에 맞는 클립을 틂.
        // 왜냐하면 제스처 도중에 State가 Idle -> Speaking으로 바뀌었을 수 있기 때문.
        // selectAndPlayNextClip(true)를 호출하면 현재 pool에서 적절한 클립을 골라 fadeIn 해줌.
        // IMPORTANT: transitionTime을 넘겨서, 제스처 fadeOut과 동일한 속도로 fadeIn 되게 함. (T-pose 방지)
        this.selectAndPlayNextClip(true, transitionTime);
    }

    public update(dt: number): void {
        this.gestureMixer.update(dt);
        this.updateRetiringActions(dt);

        if (this.isGesturePlaying && this.currentGestureAction) {
            this.gestureElapsed += dt;

            if (!this.gestureFadeStarted && this.gestureElapsed >= this.gestureDuration - this.gestureOverlapTime) {
                this.gestureFadeStarted = true;

                if (this.queuedGestureCountHint === 0) {
                    try {
                        this.currentGestureAction.fadeOut(this.gestureOverlapTime);
                    } catch { }
                    this.resumeBackgroundAnimation(this.gestureOverlapTime);
                }
            }

            if (this.gestureElapsed >= this.gestureDuration) {
                const finishingAction = this.currentGestureAction;

                this.isGesturePlaying = false;
                this.isGesturePending = false;
                this.gestureElapsed = 0;
                this.gestureDuration = 0;
                this.gestureOverlapTime = 0;
                this.gestureFadeStarted = false;

                if (this.queuedGestureCountHint === 0) {
                    try {
                        finishingAction.stop();
                        finishingAction.reset();
                    } catch { }
                    this.disposeTransientGestureAction(finishingAction);
                    if (this.currentGestureAction === finishingAction) {
                        this.currentGestureAction = null;
                    }
                }
            }
        }

        // 제스처 재생 중에는 백그라운드 풀 로직 정지 (타이머는 가게 둘 수도 있지만, 변경은 막음)
        if (this.isGesturePlaying) return;

        if (!this.currentPoolName) return;

        this.clipTimer += dt;

        if (this.isBlending) {
            this.blendTimer += dt;
            if (this.blendTimer >= this.currentTransitionTime) {
                this.isBlending = false;
                this.blendTimer = 0;
            }
        }

        // 다음 클립으로 변경할 시점인지 체크
        if (this.clipTimer >= this.nextChangeTime && !this.isBlending) {
            this.selectAndPlayNextClip();
        }
    }

    private selectAndPlayNextClip(force: boolean = false, transitionOverride?: number): void {
        const pool = ANIMATION_POOLS[this.currentPoolName];
        if (!pool) return;

        // 가중치 기반 랜덤 선택
        const selectedClip = this.weightedRandomSelect(pool.animations);
        if (!selectedClip) return;

        // 같은 클립 연속 재생 방지 (force가 아닌 경우)
        if (!force && selectedClip.clipName === this.currentClipName) {
            // 다른 클립 재시도 (최대 3번)
            for (let i = 0; i < 3; i++) {
                const retry = this.weightedRandomSelect(pool.animations);
                if (retry && retry.clipName !== this.currentClipName) {
                    void this.playClip(retry, pool, transitionOverride, ++this.backgroundRequestToken);
                    return;
                }
            }
        }

        void this.playClip(selectedClip, pool, transitionOverride, ++this.backgroundRequestToken);
    }

    private weightedRandomSelect(animations: WeightedAnimation[]): WeightedAnimation | null {
        const now = Date.now() / 1000; // 현재 시간 (초)

        // 쿨타임 체크 및 유효한 애니메이션만 필터링
        const availableAnims = animations.filter(anim => {
            if (anim.cooldown && anim.lastPlayedTime) {
                return (now - anim.lastPlayedTime) >= anim.cooldown;
            }
            return true;
        });

        if (availableAnims.length === 0) return null;

        // 가중치 합계 계산
        const totalWeight = availableAnims.reduce((sum, anim) => sum + anim.weight, 0);
        if (totalWeight === 0) return null;

        // 가중치 기반 랜덤 선택
        let random = Math.random() * totalWeight;

        for (const anim of availableAnims) {
            random -= anim.weight;
            if (random <= 0) {
                anim.lastPlayedTime = now; // 재생 시간 기록
                return anim;
            }
        }

        return availableAnims[0]; // 폴백
    }

    private async playClip(
        clip: WeightedAnimation,
        pool: AnimationPoolConfig,
        transitionOverride?: number,
        requestToken?: number,
    ): Promise<void> {
        const action = await this.model.ensureAnimationLoaded(clip.clipName);
        if (!action) {
            console.warn(`[AnimPool] Animation not found: ${clip.clipName}`);
            this.nextChangeTime = Math.max(pool.minPlayTime, 1.0);
            return;
        }

        if (requestToken !== undefined && requestToken !== this.backgroundRequestToken) {
            return;
        }

        // 실제 적용할 transition time 결정 (Override 우선)
        const transitionTime = transitionOverride ?? pool.transitionTime;
        const dominantAction = this.getDominantAction(action);
        const isSameAction = this.currentClipName === clip.clipName;

        //이전 클립이랑 같은 애니메이션인지 확인 (Override가 있으면 강제 재생)
        if (transitionOverride || !isSameAction) {
            console.log(`[AnimPool] Playing: ${clip.clipName} (weight: ${clip.weight}) trTime:${transitionTime}`);

            // 새 클립 페이드인 / 실제 현재 기여 포즈에서 크로스페이드
            this.cancelRetiringAction(action);
            if (!isSameAction) {
                action.reset();
            }
            action.setLoop(THREE.LoopPingPong, Infinity); // 무한 루프
            action.enabled = true;
            action.play();

            if (dominantAction && dominantAction !== action) {
                action.crossFadeFrom(dominantAction, transitionTime, false);
            } else {
                action.fadeIn(transitionTime);
            }
            this.fadeOutConflictingActions([action, dominantAction], transitionTime);

            this.currentClipName = clip.clipName;
            this.clipTimer = 0;
            this.isBlending = true;
            this.blendTimer = 0;
            this.currentTransitionTime = transitionTime;
        }
        // 다음 변경 시점 설정
        const playDuration = clip.duration || this.getRandomPlayTime(pool);
        this.nextChangeTime = Math.max(playDuration, pool.minPlayTime);
    }

    private getRandomPlayTime(pool: AnimationPoolConfig): number {
        return pool.minPlayTime + Math.random() * (pool.maxPlayTime - pool.minPlayTime);
    }

    public getCurrentClip(): string {
        return this.currentClipName;
    }

    public isPlaying(): boolean {
        return !!this.currentClipName && !this.isBlending;
    }

    public stop(fadeOutTime: number = 0.0): void {
        // 1) 상태 플래그 정리
        this.isGesturePlaying = false;
        this.currentGestureAction = null;
        this.isGesturePending = false;
        this.queuedGestureCountHint = 0;
        this.gestureElapsed = 0;
        this.gestureDuration = 0;
        this.gestureOverlapTime = 0;
        this.gestureFadeStarted = false;
        this.isBlending = false;
        this.blendTimer = 0;
        this.clipTimer = 0;
        this.nextChangeTime = 0;
        this.currentTransitionTime = 0;
        this.retiringActions = [];
        this.transientGestureClips.forEach((_clip, action) => {
            this.disposeTransientGestureAction(action);
        });
        this.transientGestureClips.clear();

        // 2) 액션 정지 (background + gesture 포함)
        // model.actions는 같은 mixer를 공유할 수도 있어서 stopAllAction도 같이 해줌
        const actions = Object.values(this.model.actions);

        if (fadeOutTime > 0) {
            for (const a of actions) {
                try {
                    a.fadeOut(fadeOutTime);
                } catch { }
            }
            // fadeOut 후 stop을 걸고 싶으면 setTimeout으로 처리 가능하지만,
            // 여기서는 "정지" 목적이니 즉시 stop도 같이 걸어버림(안정 우선)
            for (const a of actions) {
                try {
                    a.stop();
                    a.reset();
                } catch { }
            }
        } else {
            for (const a of actions) {
                try {
                    a.stop();
                    a.reset();
                } catch { }
            }
        }

        // 3) gestureMixer도 정리
        try {
            this.gestureMixer.stopAllAction();
            const root = this.model.vrm?.scene;
            if (root) this.gestureMixer.uncacheRoot(root);
        } catch { }

        // 4) 현재 풀/클립 정보 초기화
        this.currentClipName = '';
        this.currentPoolName = '';
    }

}

//------------------------------------------------------------------
// State Definitions & Configurations
//------------------------------------------------------------------

export enum CharacterState {
    IDLE = 'idle',
    LISTENING = 'listening',
    THINKING = 'thinking',
    SPEAKING = 'speaking'
}

export interface StateConfig {
    // Pose targets (humanoid bone rotations in local space)
    headTilt: THREE.Vector3;           // Euler angles (rad)
    neckTilt: THREE.Vector3;
    spineRotation: THREE.Vector3;

    // Hand gesture targets
    leftHandPose?: THREE.Vector3;
    rightHandPose?: THREE.Vector3;

    // Expression blends
    expressions: Record<string, number>;

    // Gaze behavior
    gazePattern: 'random' | 'upward' | 'forward' | 'mouse_follow';
    gazeIntensity: number;             // 0-1

    // Animation overrides
    baseAnimation?: string;            // Mixamo clip name
    gestureClips?: string[];           // Additional gesture animations

    entryClip?: string;              // Intro  (LoopOnce)
    loopPool?: string;              // Pool   (LoopRepeat / weighted)
    exitClip?: string;              // Outro  (LoopOnce)

    // Transition timing
    blendInTime: number;               // seconds
    blendOutTime: number;
}

//------------------------------------------------------------------
// State Configurations
//------------------------------------------------------------------

const STATE_CONFIGS: Record<CharacterState, StateConfig & { animationPool?: string }> = {
    [CharacterState.IDLE]: {
        headTilt: new THREE.Vector3(0, 0, 0),
        neckTilt: new THREE.Vector3(0, 0, 0),
        spineRotation: new THREE.Vector3(0, 0, 0),
        expressions: { 'neutral': 1.0 },
        gazePattern: 'forward',          // ← 안정적인 시선 (random은 초기 로드 시 흔들림 유발 가능)
        gazeIntensity: 0.6,
        animationPool: 'idle_pool',      // ← 애니메이션 풀 지정
        blendInTime: 0.8,
        blendOutTime: 0.5
    },

    [CharacterState.THINKING]: {
        headTilt: new THREE.Vector3(0.1, -0.1, 0.05),
        neckTilt: new THREE.Vector3(0.05, -0.08, 0),
        spineRotation: new THREE.Vector3(-0.02, 0, 0),
        expressions: {
            'neutral': 0.2,
            'fun': 0.3,
            'surprised': 0.1
        },
        gazePattern: 'upward',
        gazeIntensity: 0.7,
        animationPool: 'thinking_pool',  // ← 생각하는 애니메이션 풀
        blendInTime: 0.6,
        blendOutTime: 0.4
    },

    [CharacterState.LISTENING]: {
        headTilt: new THREE.Vector3(-0.15, 0.05, 0),
        neckTilt: new THREE.Vector3(-0.08, 0, 0),
        spineRotation: new THREE.Vector3(0.05, 0, 0),
        expressions: {
            'neutral': 0.3,
            'relaxed': 0.7
        },
        gazePattern: 'mouse_follow',
        gazeIntensity: 0.9,
        animationPool: 'listening_pool', // ← 듣기 애니메이션 풀
        blendInTime: 0.4,
        blendOutTime: 0.3
    },

    [CharacterState.SPEAKING]: {
        headTilt: new THREE.Vector3(0, 0, 0),
        neckTilt: new THREE.Vector3(0, 0, 0),
        spineRotation: new THREE.Vector3(0, 0, 0),
        expressions: {
            'happy': 0.4,
            'neutral': 0.6
        },
        gazePattern: 'forward',
        gazeIntensity: 0.8,
        animationPool: 'speaking_pool',  // ← 말하는 애니메이션 풀
        //baseAnimation: 'Talking.fbx',    // 스피킹은 고정 애니메이션
        //gestureClips: ['Talking With Hands.fbx', 'Explaining.fbx'],
        blendInTime: 0.3,
        blendOutTime: 0.2
    }
};

//------------------------------------------------------------------
// State Transition Rules
//------------------------------------------------------------------

interface TransitionRule {
    from: CharacterState;
    to: CharacterState;
    condition: () => boolean;
    priority: number;                  // Higher = more priority
}

//------------------------------------------------------------------
// Main State Manager Class
//------------------------------------------------------------------
export class CharacterStateManager {
    private model: Model;
    private vrm: VRM;
    private animationPoolManager: AnimationPoolManager;

    // Current state
    private currentState: CharacterState = CharacterState.IDLE;
    private stateTimer: number = 0;
    private transitionTimer: number = 0;
    private isTransitioning: boolean = false;

    // Bone references (cached for performance)
    private headBone?: THREE.Bone;
    private neckBone?: THREE.Bone;
    private spineBone?: THREE.Bone;
    private leftHandBone?: THREE.Bone;
    private rightHandBone?: THREE.Bone;

    // Pose blending targets
    private targetPoses: Map<THREE.Bone, THREE.Quaternion> = new Map();
    private originalPoses: Map<THREE.Bone, THREE.Quaternion> = new Map();

    // External intent state
    private inputActive: boolean = false;
    private awaitingAssistantResponse: boolean = false;
    private speechActive: boolean = false;
    private desiredState: CharacterState = CharacterState.IDLE;
    private gestureQueue: string[] = [];

    constructor(model: Model, vrm: VRM) {
        this.model = model;
        this.vrm = vrm;
        this.animationPoolManager = new AnimationPoolManager(model);
        this.initializeBoneReferences();
        this.cacheOriginalPoses();

        this.setState(CharacterState.IDLE, true);
    }

    //----------------------------------------------------------------
    // Initialization
    //----------------------------------------------------------------

    private initializeBoneReferences(): void {
        this.headBone = this.vrm.humanoid.getRawBoneNode('head') as THREE.Bone;
        this.neckBone = this.vrm.humanoid.getRawBoneNode('neck') as THREE.Bone;
        this.spineBone = this.vrm.humanoid.getRawBoneNode('spine') as THREE.Bone;
        this.leftHandBone = this.vrm.humanoid.getRawBoneNode('leftHand') as THREE.Bone;
        this.rightHandBone = this.vrm.humanoid.getRawBoneNode('rightHand') as THREE.Bone;
    }

    private cacheOriginalPoses(): void {
        const bones = [this.headBone, this.neckBone, this.spineBone,
        this.leftHandBone, this.rightHandBone].filter(Boolean);

        for (const bone of bones) {
            this.originalPoses.set(bone!, bone!.quaternion.clone());
        }
    }

    //----------------------------------------------------------------
    // Public State Control API
    //----------------------------------------------------------------

    public setState(newState: CharacterState, force: boolean = false): void {
        if (!force && this.currentState === newState) return;
        // 기존 애니메이션 정리
        //for (const action of Object.values(this.model.actions)) {
        //    action.fadeOut(0.3).stop();
        //}
        this.currentState = newState;
        this.stateTimer = 0;
        this.transitionTimer = 0;
        this.isTransitioning = true;
        this.applyStateConfiguration(newState);
    }

    public setListening(listening: boolean): void {
        this.onUserInputChanged(listening);
    }

    public setSpeaking(speaking: boolean): void {
        if (speaking) {
            this.onAssistantSpeechStarted();
            return;
        }

        this.onAssistantSpeechFinished();
    }

    public beginAssistantResponse(): void {
        this.onUserPromptSubmitted();
    }

    public onUserInputChanged(hasInput: boolean): void {
        this.inputActive = hasInput;
        if (hasInput) {
            this.awaitingAssistantResponse = false;
        }
        this.recomputeDesiredState();
    }

    public onUserPromptSubmitted(): void {
        this.inputActive = false;
        this.awaitingAssistantResponse = true;
        this.recomputeDesiredState();
    }

    public onAssistantSpeechStarted(): void {
        this.awaitingAssistantResponse = false;
        this.speechActive = true;
        this.recomputeDesiredState();
    }

    public onAssistantSpeechFinished(): void {
        this.speechActive = false;
        this.recomputeDesiredState();
    }

    public triggerGesture(gestureName: string): void {
        this.requestGesture(gestureName);
    }

    public requestGesture(gestureName: string): void {
        this.gestureQueue.push(gestureName);
    }

    public getCurrentState(): CharacterState {
        return this.currentState;
    }

    //----------------------------------------------------------------
    // State Logic & Transitions
    //----------------------------------------------------------------

    private recomputeDesiredState(): void {
        if (this.speechActive) {
            this.desiredState = CharacterState.SPEAKING;
            return;
        }

        if (this.awaitingAssistantResponse) {
            // Thinking 애셋이 정리되기 전까지는 idle로 대기한다.
            this.desiredState = CharacterState.IDLE;
            return;
        }

        if (this.inputActive) {
            this.desiredState = CharacterState.LISTENING;
            return;
        }

        this.desiredState = CharacterState.IDLE;
    }

    private evaluateTransitions(): void {
        if (this.currentState !== this.desiredState) {
            this.setState(this.desiredState);
        }
    }

    //----------------------------------------------------------------
    // State Configuration Application
    //----------------------------------------------------------------

    private applyStateConfiguration(state: CharacterState): void {
        const config = STATE_CONFIGS[state];

        // 1. Setup pose targets
        // this.setupPoseTargets(config);

        // 2. Apply expressions  
        this.applyExpressions(config.expressions);

        // 3. Configure gaze behavior
        this.configureGaze(config);

        // 4. Handle animation changes
        if (config.animationPool) {
            // 애니메이션 풀 사용
            this.animationPoolManager.setPool(config.animationPool);
        } else if (config.baseAnimation) {
            // 기존 방식 (단일 애니메이션)
            this.handleAnimationChange(config);
        }
    }

    private setupPoseTargets(config: StateConfig): void {
        // Head rotation
        if (this.headBone) {
            const headTarget = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(config.headTilt.x, config.headTilt.y, config.headTilt.z)
            );
            const originalHead = this.originalPoses.get(this.headBone)!;
            this.targetPoses.set(this.headBone, originalHead.clone().multiply(headTarget));
        }

        // Neck rotation
        if (this.neckBone) {
            const neckTarget = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(config.neckTilt.x, config.neckTilt.y, config.neckTilt.z)
            );
            const originalNeck = this.originalPoses.get(this.neckBone)!;
            this.targetPoses.set(this.neckBone, originalNeck.clone().multiply(neckTarget));
        }

        // Spine rotation  
        if (this.spineBone) {
            const spineTarget = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(config.spineRotation.x, config.spineRotation.y, config.spineRotation.z)
            );
            const originalSpine = this.originalPoses.get(this.spineBone)!;
            this.targetPoses.set(this.spineBone, originalSpine.clone().multiply(spineTarget));
        }
    }

    private applyExpressions(expressions: Record<string, number>): void {
        return;

        //const [expression] = Object.entries(expressions)
        //this.model.Emotion(expression[0], expression[1])

        // Clear current expressions
        //if (this.vrm.expressionManager) {
        //    for (const preset of this.vrm.expressionManager.expressions) {
        //        this.vrm.expressionManager.setValue(preset.name, 0);
        //    }
        //    // Apply new expressions
        //    for (const [name, weight] of Object.entries(expressions)) {
        //        this.vrm.expressionManager.setValue(name, weight);
        //    }
        //}
    }

    private configureGaze(config: StateConfig): void {
        switch (config.gazePattern) {
            case 'mouse_follow':
                this.model.startMouseFollowing();
                break;
            case 'random':
                this.model.stopMouseFollowing();
                this.model.changeGaze();
                break;
            case 'upward':
                this.model.stopMouseFollowing();
                this.model.changeGaze({ x: 0.5, y: 1.5, z: 0.8 });
                break;
            case 'forward':
                this.model.stopMouseFollowing();
                this.model.changeGaze({ x: 0.2, y: 0.2, z: 1.0 });
                break;
        }
    }

    private handleAnimationChange(config: StateConfig): void {
        if (!config.baseAnimation) return;

        void this.model.ensureAnimationLoaded(config.baseAnimation).then((targetAction) => {
            if (!targetAction) return;

            for (const action of Object.values(this.model.actions)) {
                action.fadeOut(config.blendOutTime);
            }

            targetAction.reset().fadeIn(config.blendInTime).play();
        });
    }

    //----------------------------------------------------------------
    // Frame Update
    //----------------------------------------------------------------

    public update(dt: number): void {
        this.stateTimer += dt;

        this.handleGestures(); // 제스처 큐를 최우선으로 처리
        this.animationPoolManager.setQueuedGestureCountHint(this.gestureQueue.length);
        this.animationPoolManager.update(dt);

        // Evaluate state transitions
        this.evaluateTransitions();

        // 제스처 중에도 desired/current state는 따라가되,
        // 포즈 블렌딩/상태별 미세 동작은 잠시 멈춘다.
        if (this.animationPoolManager.isGestureActive()) {
            return;
        }

        // Handle pose blending during transitions
        if (this.isTransitioning) {
            this.transitionTimer += dt;
            this.updatePoseBlending(dt);

            const config = STATE_CONFIGS[this.currentState];
            if (this.transitionTimer >= config.blendInTime) {
                this.isTransitioning = false;
            }
        }

        // State-specific updates
        this.updateStateSpecificBehavior(dt);
    }

    private handleGestures(): void {
        if (
            this.gestureQueue.length > 0 &&
            this.animationPoolManager.canStartGesture()
        ) {

            const gestureClipName = this.gestureQueue.shift();
            if (gestureClipName) {
                this.animationPoolManager.triggerGesture(gestureClipName);
            }

            //const gestureClipName = this.gestureQueue.shift();
            //if (gestureClipName && this.model.actions[gestureClipName]) {
            //    console.log(`[FSM] Playing gesture: ${gestureClipName}`);
            //    const gestureAction = this.model.actions[gestureClipName];
            //
            //    // 현재 재생중인 모든 액션을 잠시 중단하지 않고, 제스처를 위에 덮어씌워 한 번 재생합니다.
            //    // 이 방식은 간단한 손짓 등에는 효과적입니다.
            //    gestureAction.reset();
            //    gestureAction.setLoop(THREE.LoopOnce, 1);
            //    gestureAction.clampWhenFinished = true; // 마지막 프레임에서 멈춤
            //    gestureAction.play();
            //}
        }
    }

    private updatePoseBlending(dt: number): void {
        const config = STATE_CONFIGS[this.currentState];
        const alpha = Math.min(this.transitionTimer / config.blendInTime, 1.0);
        const smoothAlpha = this.smoothStep(alpha);  // Ease-in-out

        for (const [bone, targetQuat] of this.targetPoses) {
            const originalQuat = this.originalPoses.get(bone)!;
            bone.quaternion.slerpQuaternions(originalQuat, targetQuat, smoothAlpha);
            bone.updateMatrixWorld(true);
        }
    }

    private updateStateSpecificBehavior(dt: number): void {
        switch (this.currentState) {
            case CharacterState.THINKING:
                // Add subtle head movement variation
                if (this.headBone && Math.random() < 0.02) { // 2% chance per frame
                    const variation = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(0, 1, 0),
                        (Math.random() - 0.5) * 0.1
                    );
                    this.headBone.quaternion.multiply(variation);
                }
                break;

            case CharacterState.SPEAKING:
                // 이제 제스처는 handleGestures()에서 전역으로 처리됩니다.
                break;
        }
    }

    // 런타임에서 애니메이션 풀 가중치 조정 API
    public adjustAnimationWeight(poolName: string, clipName: string, newWeight: number): void {
        const pool = ANIMATION_POOLS[poolName];
        if (!pool) return;

        const anim = pool.animations.find(a => a.clipName === clipName);
        if (anim) {
            anim.weight = newWeight;
            console.log(`[AnimPool] Updated ${clipName} weight to ${newWeight}`);
        }
    }

    // 특정 애니메이션 강제 실행
    //public forcePlayAnimation(clipName: string): void {
    //    if (this.model.actions[clipName]) {
    //        // 현재 애니메이션 중단
    //        for (const action of Object.values(this.model.actions)) {
    //            action.fadeOut(0.3);
    //        }
    //
    //        // 강제 실행
    //        const action = this.model.actions[clipName];
    //        action.reset().fadeIn(0.3).play();
    //    }
    //}

    //----------------------------------------------------------------
    // Utility Functions  
    //----------------------------------------------------------------

    private smoothStep(t: number): number {
        return t * t * (3.0 - 2.0 * t);  // Hermite interpolation
    }

    //----------------------------------------------------------------
    // Debug & Monitoring
    //----------------------------------------------------------------

    public getDebugInfo(): object {
        return {
            currentState: this.currentState,
            desiredState: this.desiredState,
            stateTimer: this.stateTimer.toFixed(2),
            isTransitioning: this.isTransitioning,
            transitionTimer: this.transitionTimer.toFixed(2),
            currentClip: this.animationPoolManager.getCurrentClip(),
            gestureQueueLength: this.gestureQueue.length,
            inputActive: this.inputActive,
            awaitingAssistantResponse: this.awaitingAssistantResponse,
            speechActive: this.speechActive
        };
    }

    public stop(fadeOutTime: number = 0.2): void {
        // 1) 외부 트리거/큐 정리
        this.inputActive = false;
        this.awaitingAssistantResponse = false;
        this.speechActive = false;
        this.desiredState = CharacterState.IDLE;
        this.gestureQueue.length = 0;

        // 2) 상태머신 정리
        this.isTransitioning = false;
        this.transitionTimer = 0;
        this.stateTimer = 0;

        // 3) 시선/인터랙션 정지
        try {
            this.model.stopMouseFollowing();
        } catch { }

        // 4) 포즈 원복 (캐시해둔 originalPoses로 되돌리기)
        try {
            for (const [bone, originalQuat] of this.originalPoses) {
                bone.quaternion.copy(originalQuat);
                bone.updateMatrixWorld(true);
            }
        } catch { }

        // 5) 애니메이션 풀/제스처 타이머 포함 전체 정지
        this.animationPoolManager.stop(fadeOutTime);

        // 6) 혹시 남아있는 액션들도 안전하게 정리 (이중 안전장치)
        try {
            for (const action of Object.values(this.model.actions)) {
                action.fadeOut(fadeOutTime);
                action.stop();
                action.reset();
            }
        } catch { }

        // 7) (선택) 표정 리셋 - 지금 applyExpressions가 return이라 실사용은 아니지만,
        // expressionManager를 실제로 쓰는 경우엔 아래를 켜는 게 맞음
        /*
        try {
            if (this.vrm.expressionManager) {
                for (const preset of this.vrm.expressionManager.expressions) {
                    this.vrm.expressionManager.setValue(preset.name, 0);
                }
                this.vrm.expressionManager.setValue('neutral', 1.0);
            }
        } catch {}
        */

        // 8) 기본 상태로 돌리고 싶으면(선택)
        // this.currentState = CharacterState.IDLE;
    }

}

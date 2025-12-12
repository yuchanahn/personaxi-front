// StateManager.ts - VRM Character State Machine
// Author: Senior Graphics R&D Engineer
// Purpose: FSM-based behavior management with pose/expression blending
// -----------------------------------------------------------------------------

import * as THREE from 'three/webgpu';
import { VRM } from '@pixiv/three-vrm';
import { Model } from '../core/model';

// StateManager.ts - 가중치 기반 랜덤 애니메이션 시스템 추가
// Author: Senior Graphics R&D Engineer  
// -----------------------------------------------------------------------------

//------------------------------------------------------------------
// Animation Pool Configuration
//------------------------------------------------------------------

interface WeightedAnimation {
    clipName: string;
    weight: number;                    // 가중치 (높을수록 자주 재생)
    duration?: number;                 // 강제 재생 시간 (없으면 클립 원본 길이)
    cooldown?: number;                 // 재실행 쿨타임 (초)
    lastPlayedTime?: number;           // 마지막 재생 시점
}

interface AnimationPoolConfig {
    animations: WeightedAnimation[];
    transitionTime: number;            // 애니메이션 간 블렌드 시간
    minPlayTime: number;              // 최소 재생 시간 (너무 빨리 바뀌는 것 방지)
    maxPlayTime: number;              // 최대 재생 시간 (무한 루프 방지)
}

//------------------------------------------------------------------
// Enhanced State Configuration with Animation Pools
//------------------------------------------------------------------

const ANIMATION_POOLS: Record<string, AnimationPoolConfig> = {
    // IDLE 상태용 애니메이션 풀
    'idle_pool': {
        animations: [
            //{ clipName: 'Idle Base.fbx', weight: 40 },           // 가장 자주 (기본 숨쉬기)
            //{ clipName: 'Breathing Idle1.fbx', weight: 40 },           // 가장 자주 (기본 숨쉬기)
            //{ clipName: 'Breathing Idle2.fbx', weight: 40 },           // 가장 자주 (기본 숨쉬기)

            { clipName: 'Idle_nomal.fbx', weight: 60 },            // 보통 빈도
            //{ clipName: 'Listening.fbx', weight: 50 },

            { clipName: 'Looking Around.fbx', weight: 5 },
            { clipName: 'Hands on waist.fbx', weight: 5 },
            { clipName: 'Arms crossed.fbx', weight: 5 },
            { clipName: 'Neck Stretching.fbx', weight: 2, cooldown: 30.0 }, // 매우 드물게, 30초 쿨타임
            { clipName: 'Arm Stretching.fbx', weight: 2, cooldown: 30.0 }, // 매우 드물게, 30초 쿨타임
            { clipName: 'Yawning.fbx', weight: 1, cooldown: 45.0, duration: 5.0 },   // 극히 드물게
            //{ clipName: 'Adjusting Hair.fbx', weight: 2, cooldown: 60.0 } // 1분에 한 번 정도
        ],
        transitionTime: 1.5,
        minPlayTime: 3.0,              // 최소 4초는 재생
        maxPlayTime: 30.0              // 최대 12초 후 변경 고려
    },

    // THINKING 상태용 (생각하는 다양한 모션)
    'thinking_pool': {
        animations: [
            { clipName: 'Thinking.fbx', weight: 35 },
            { clipName: 'Hand To Chin.fbx', weight: 25 },
            { clipName: 'Looking Up Thinking.fbx', weight: 20 },
            { clipName: 'Head Scratch.fbx', weight: 15, cooldown: 20.0 },
            { clipName: 'Deep Thought.fbx', weight: 5 }
        ],
        transitionTime: 1.5,
        minPlayTime: 2.0,
        maxPlayTime: 8.0
    },

    'speaking_pool': {
        animations: [
            { clipName: 'talk1.fbx', weight: 35 },
            { clipName: 'talk2.fbx', weight: 25 },
            { clipName: 'talk3.fbx', weight: 25 },
        ],
        transitionTime: 1.5,
        minPlayTime: 2.0,
        maxPlayTime: 8.0
    },

    // LISTENING 상태용
    'listening_pool': {
        animations: [
            { clipName: 'Listening.fbx', weight: 50 },
            //{ clipName: 'Listening2.fbx', weight: 50 },
            //{ clipName: 'Nodding.fbx', weight: 30, duration: 2.0 },
            //{ clipName: 'Attentive Pose.fbx', weight: 20 }
        ],
        transitionTime: 1.5,
        minPlayTime: 3.0,
        maxPlayTime: 10.0
    }
};

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
    private gestureEndTime: number = 0;
    private isGesturePlaying: boolean = false;

    // Timer Handles for cancellation
    private gestureFadeTimer: any = null;
    private gestureEndTimer: any = null;

    private gestureMixer: THREE.AnimationMixer;

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
        const action = this.model.actions[clipName];
        if (!action) return;

        console.log(`[AnimPool] Triggering gesture: ${clipName}`);

        // 1. 기존 제스처 타이머 취소 (중복 실행 방지)
        if (this.gestureFadeTimer) clearTimeout(this.gestureFadeTimer);
        if (this.gestureEndTimer) clearTimeout(this.gestureEndTimer);

        // 2. 현재 백그라운드 클립 페이드아웃 (아직 안 되어 있다면)
        // (연속 제스처의 경우 이미 fadeOut 되었을 수 있지만, 안전하게 호출)
        if (this.currentClipName && this.model.actions[this.currentClipName]) {
            this.model.actions[this.currentClipName].fadeOut(transitionTime);
        }

        // 3. 제스처 재생
        action.reset().setLoop(THREE.LoopOnce, 1).fadeIn(transitionTime).play();

        this.isGesturePlaying = true;
        const clipDuration = action.getClip().duration;

        // 제스처 종료 시점 기록
        const now = Date.now() / 1000;
        this.gestureEndTime = now + clipDuration;

        // 4. Auto Fade Out 스케줄링
        const fadeOutStartTime = (clipDuration - transitionTime) * 1000;

        this.gestureFadeTimer = setTimeout(() => {
            if (this.isGesturePlaying) {
                action.fadeOut(transitionTime);
                // 5. 백그라운드 애니메이션 복귀 (중요: 현재 Pool에 맞는 클립으로!)
                this.resumeBackgroundAnimation(transitionTime);
            }
        }, Math.max(0, fadeOutStartTime));

        // 6. 완전 종료 후 플래그 해제
        this.gestureEndTimer = setTimeout(() => {
            this.isGesturePlaying = false;
        }, clipDuration * 1000);
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
                    this.playClip(retry, pool, transitionOverride);
                    return;
                }
            }
        }

        this.playClip(selectedClip, pool, transitionOverride);
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

    private playClip(clip: WeightedAnimation, pool: AnimationPoolConfig, transitionOverride?: number): void {
        if (!this.model.actions[clip.clipName]) {
            console.warn(`[AnimPool] Animation not found: ${clip.clipName}`);
            return;
        }

        // 실제 적용할 transition time 결정 (Override 우선)
        const transitionTime = transitionOverride ?? pool.transitionTime;

        //이전 클립이랑 같은 애니메이션인지 확인 (Override가 있으면 강제 재생)
        if (transitionOverride || this.currentClipName !== clip.clipName) {
            console.log(`[AnimPool] Playing: ${clip.clipName} (weight: ${clip.weight}) trTime:${transitionTime}`);

            // 이전 클립 페이드아웃
            if (this.currentClipName && this.model.actions[this.currentClipName]) {
                //this.model.actions[this.currentClipName].stop(); // fadeOut 대신 즉시 정지 후
                //this.model.actions[this.currentClipName].reset();
                this.model.actions[this.currentClipName].fadeOut(transitionTime);
            }

            // 새 클립 페이드인
            const action = this.model.actions[clip.clipName];
            action.reset();
            action.setLoop(THREE.LoopPingPong, Infinity); // 무한 루프
            action.fadeIn(transitionTime);
            action.play();

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
        gazePattern: 'random',
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

    // External state triggers
    private isListening: boolean = false;
    private isSpeaking: boolean = false;
    private lastUserInput: number = 0;
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
        this.isListening = listening;
        if (listening) {
            this.lastUserInput = Date.now();
        }
    }

    public setSpeaking(speaking: boolean): void {
        this.isSpeaking = speaking;
    }

    public triggerGesture(gestureName: string): void {
        this.gestureQueue.push(gestureName);
    }

    public getCurrentState(): CharacterState {
        return this.currentState;
    }

    //----------------------------------------------------------------
    // State Logic & Transitions
    //----------------------------------------------------------------

    private evaluateTransitions(): void {
        const rules: TransitionRule[] = [
            // High priority: Speaking state
            {
                from: CharacterState.IDLE,
                to: CharacterState.SPEAKING,
                condition: () => this.isSpeaking,
                priority: 100
            },
            {
                from: CharacterState.LISTENING,
                to: CharacterState.SPEAKING,
                condition: () => this.isSpeaking,
                priority: 100
            },
            {
                from: CharacterState.THINKING,
                to: CharacterState.SPEAKING,
                condition: () => this.isSpeaking,
                priority: 100
            },

            // Medium priority: Listening
            {
                from: CharacterState.IDLE,
                to: CharacterState.LISTENING,
                condition: () => this.isListening,
                priority: 80
            },
            {
                from: CharacterState.THINKING,
                to: CharacterState.LISTENING,
                condition: () => this.isListening,
                priority: 80
            },

            // Thinking state (after user input, before response)
            //{
            //    from: CharacterState.LISTENING,
            //    to: CharacterState.THINKING,
            //    condition: () => !this.isListening && !this.isSpeaking &&
            //        (Date.now() - this.lastUserInput) < 3000,
            //    priority: 60
            //},

            // Back to idle
            {
                from: CharacterState.SPEAKING,
                to: CharacterState.IDLE,
                condition: () => !this.isSpeaking,
                priority: 40
            },
            {
                from: CharacterState.THINKING,
                to: CharacterState.IDLE,
                condition: () => this.stateTimer > 2.0 && !this.isSpeaking,
                priority: 40
            },
            {
                from: CharacterState.LISTENING,
                to: CharacterState.IDLE,
                condition: () => !this.isListening &&
                    (Date.now() - this.lastUserInput) > 5000,
                priority: 40
            }
        ];

        // Find highest priority applicable rule
        const applicableRule = rules
            .filter(rule => rule.from === this.currentState && rule.condition())
            .sort((a, b) => b.priority - a.priority)[0];

        if (applicableRule) {
            this.setState(applicableRule.to);
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
        if (config.baseAnimation && this.model.actions[config.baseAnimation]) {
            // Fade out current animations
            for (const action of Object.values(this.model.actions)) {
                action.fadeOut(config.blendOutTime);
            }

            // Fade in target animation
            const targetAction = this.model.actions[config.baseAnimation];
            targetAction.reset().fadeIn(config.blendInTime).play();
        }
    }

    //----------------------------------------------------------------
    // Frame Update
    //----------------------------------------------------------------

    public update(dt: number): void {
        this.stateTimer += dt;

        this.handleGestures(); // 제스처 큐를 최우선으로 처리
        this.animationPoolManager.update(dt);

        // Evaluate state transitions
        this.evaluateTransitions();

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
        if (this.gestureQueue.length > 0) {

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
            stateTimer: this.stateTimer.toFixed(2),
            isTransitioning: this.isTransitioning,
            transitionTimer: this.transitionTimer.toFixed(2),
            currentClip: this.animationPoolManager.getCurrentClip(),
            gestureQueueLength: this.gestureQueue.length,
            isListening: this.isListening,
            isSpeaking: this.isSpeaking
        };
    }
}

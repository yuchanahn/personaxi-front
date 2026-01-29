export class Live2DAutonomy {
    // ⚙️ SENSITIVITY SETTINGS (0.1 ~ 2.0)
    // 모델마다 반응이 다르니 이 값으로 전체 모션 크기 조절
    public sensitivity = 1.0;

    private model: any;
    private app: any;
    private ticker: ((ticker: any) => void) | null = null;

    private dragTargetX = 0;
    private dragTargetY = 0;
    private dragPhysicsX = 0;
    private dragPhysicsY = 0;
    private currentBodyX = 0;
    private currentBodyY = 0;
    private bodyVol = 0;

    private blinkState: 'OPEN' | 'CLOSING' | 'CLOSED' | 'OPENING' = 'OPEN';
    private nextBlinkTime = 0;
    private blinkOpenValue = 1.0;
    private blinkValue = 1.0;
    private blinkDuration = 150;
    private blinkTimer = 0;

    private gazeTargetX = 0;
    private gazeTargetY = 0;
    private gazeCurrentX = 0;
    private gazeCurrentY = 0;

    private saccadeOffsetX = 0;
    private saccadeOffsetY = 0;
    private nextSaccadeTime = 0;

    private idleTargetHeadX = 0;
    private idleTargetHeadY = 0;
    private idleTargetHeadZ = 0;
    private idleEyeOpenMax = 1.0;
    private nextIdleMoveTime = 0;
    private nextGazeMoveTime = 0;

    private isGesturePlaying = false;
    private gestureStartTime = 0;
    private gestureDuration = 0;
    private currentGesture: GestureType | null = null;

    private isSpeaking = false;

    public setSpeaking(speaking: boolean) {
        this.isSpeaking = speaking;
        console.log(`🗣️ Speaking State: ${speaking}`);
    }

    public currentEmotion:
        | "ELATED"
        | "GENTLE"
        | "STERN"
        | "DEPRESSED"
        | "TENSE"
        | "ASTONISHED"
        | "SLEEP"
        | "CALM" = 'CALM';

    private emotionConfigs = {
        ELATED: { headYOffset: 8, motionSpeed: 0.15, eyeOpenMin: 1.0, breathRate: 2.0, idleIntervalMin: 500 },
        GENTLE: { headYOffset: 2, motionSpeed: 0.06, eyeOpenMin: 0.9, breathRate: 1.0, idleIntervalMin: 1200 },
        STERN: { headYOffset: -3, motionSpeed: 0.07, eyeOpenMin: 0.4, breathRate: 1.3, idleIntervalMin: 100 },
        DEPRESSED: { headYOffset: -12, motionSpeed: 0.02, eyeOpenMin: 0.5, breathRate: 0.5, idleIntervalMin: 3000 },
        TENSE: { headYOffset: -2, motionSpeed: 0.10, eyeOpenMin: 1.1, breathRate: 2.2, idleIntervalMin: 600 },
        ASTONISHED: { headYOffset: 10, motionSpeed: 0.18, eyeOpenMin: 1.5, breathRate: 0.3, idleIntervalMin: 3500 },
        SLEEP: { headYOffset: -2, motionSpeed: 0.02, eyeOpenMin: 0.0, breathRate: 0.3, idleIntervalMin: 999999 },
        CALM: { headYOffset: 0, motionSpeed: 0.04, eyeOpenMin: 0.8, breathRate: 0.8, idleIntervalMin: 2000 }
    };

    private activeConfig = this.emotionConfigs.CALM;
    private paramIndices: Record<string, number> = {};

    private currentHeadZ = 0;
    private voiceEnv = 0;

    private SleepTimer: any | null = null;

    private StopSleepTimer = () => {
        if (this.SleepTimer) {
            clearTimeout(this.SleepTimer);
        }
    };

    private StartSleepTimer = () => {
        this.StopSleepTimer();
        this.SleepTimer = setTimeout(
            () => {
                this.setEmotion("SLEEP");
            },
            1000 * 60 * 3,
        );
    };

    constructor(model: any, app: any, sensitivity: number = 1.0) {
        this.model = model;
        this.app = app;
        this.sensitivity = this.clamp(sensitivity, 0.1, 2.0);
        this.cacheParamIndices();
        this.scheduleNextBlink();
        this.scheduleNextSaccade();

        console.log(`🤖 Autonomy Initialized (Sensitivity: ${this.sensitivity}x)`);
    }

    public start() {
        if (this.ticker) return;

        this.ticker = (dt: number) => {
            let deltaMS = this.app.ticker.deltaMS;
            if (!deltaMS || isNaN(deltaMS)) deltaMS = 16.6;
            this.update(deltaMS);
        };

        this.app.ticker.add(this.ticker, null, 0);
        console.log("🤖 Live2D Autonomy Enhanced Started");
        this.StartSleepTimer();
    }

    public stop() {
        if (this.ticker) {
            this.app.ticker.remove(this.ticker);
            this.ticker = null;
        }
        this.StopSleepTimer();
    }

    public setSensitivity(value: number) {
        this.sensitivity = this.clamp(value, 0.1, 2.0);
        console.log(`⚙️ Sensitivity changed to ${this.sensitivity}x`);
    }

    public playGesture(gesture: GestureType) {
        if (this.isGesturePlaying) return; // 이미 재생 중이면 무시

        console.log(`🎭 Playing Gesture: ${gesture}`);
        this.currentGesture = gesture;
        this.isGesturePlaying = true;
        this.gestureStartTime = Date.now();

        switch (gesture) {
            case 'NOD':
                this.gestureDuration = 800;
                break;
            case 'SHAKE':
                this.gestureDuration = 1200;
                break;
            case 'TILT':
                this.gestureDuration = 600;
                break;
            case 'FIDGET':
                this.gestureDuration = 2000;
                break;
            case 'SIGH':
                this.gestureDuration = 1500;
                break;
            case 'LOOK_DOWN':
                this.gestureDuration = 1000;
                break;
            case 'CLOSE_EYES':
                this.gestureDuration = 2000;
                break;
            case 'WINK':
                this.gestureDuration = 1000;
                break;
            case 'PUFF_CHEEKS':
                this.gestureDuration = 800;
                break;
            case 'STICK_TONGUE':
                this.gestureDuration = 600;
                break;
            case 'SQUINT':
                this.gestureDuration = 700;
                break;
            case 'ROLL_EYES':
                this.gestureDuration = 1200;
                break;
            case 'LOOK_UP_THINK':
                this.gestureDuration = 1500;
                break;
            case 'FLINCH':
                this.gestureDuration = 300;
                break;
            case 'PANT':
                this.gestureDuration = 3000;
                break;
            case 'WAKE_UP':
                this.gestureDuration = 2500;
                break;
        }
    }

    // ✨ Callback for UI (e.g., Sleep Effect)
    public onEmotionChange: ((emotion: keyof typeof this.emotionConfigs) => void) | null = null;


    public WakeUp() {
        if (!this.isSleeping()) return;
        this.setEmotion("CALM");
    }

    public isSleeping(): boolean {
        return this.currentEmotion === 'SLEEP';
    }

    public setEmotion(emotion: keyof typeof this.emotionConfigs) {
        if (this.currentEmotion === emotion) return;

        console.log(`🤖 Emotion Changed: ${this.currentEmotion} -> ${emotion}`);

        // ✨ Wake Up Trigger
        if (this.currentEmotion === 'SLEEP' && emotion !== 'SLEEP') {
            console.log("🌅 Waking Up!");
            this.playGesture('WAKE_UP');
        }

        this.currentEmotion = emotion;
        this.activeConfig = this.emotionConfigs[emotion];

        // Trigger Callback
        if (this.onEmotionChange) {
            this.onEmotionChange(emotion);
        }

        this.nextIdleMoveTime = Date.now();

        if (emotion === 'ELATED' || emotion === 'STERN') {
            this.blinkState = 'OPEN';
            this.blinkValue = 1.0;
            this.nextBlinkTime = Date.now() + 2000;
        }

        this.StartSleepTimer();
    }

    public handleDrag(normalizedX: number, normalizedY: number) {
        const deltaX = (normalizedX - this.dragTargetX) * 20;
        const deltaY = (normalizedY - this.dragTargetY) * 20;

        this.dragPhysicsX += deltaX;
        this.dragPhysicsY += deltaY;

        this.dragPhysicsX = this.clamp(this.dragPhysicsX, -30, 30);
        this.dragPhysicsY = this.clamp(this.dragPhysicsY, -30, 30);

        this.dragTargetX = normalizedX;
        this.dragTargetY = normalizedY;
    }

    private update(deltaMS: number) {
        if (!this.model || !this.model.internalModel) return;

        const internal = this.model.internalModel;
        const core = internal.coreModel;
        const values = core._parameterValues;

        this.updateBlinking(deltaMS, values);
        this.updateBreathing(deltaMS, values);
        this.updateSaccades(deltaMS); // ✨ NEW
        this.updateGestures(deltaMS); // ✨ NEW
        this.updatePhysics(deltaMS, values, internal);
    }

    // ✨ NEW: 마이크로 새카드 업데이트
    private updateSaccades(deltaMS: number) {
        const now = Date.now();

        if (now >= this.nextSaccadeTime) {
            // 아주 작은 랜덤 오프셋 생성 (눈 떨림) - 감도 적용
            this.saccadeOffsetX = (Math.random() - 0.5) * 0.08 * this.sensitivity;
            this.saccadeOffsetY = (Math.random() - 0.5) * 0.06 * this.sensitivity;

            // 다음 새카드 시간 (50~300ms 사이)
            this.nextSaccadeTime = now + 50 + Math.random() * 250;
        }

        // 새카드는 빠르게 감쇠
        this.saccadeOffsetX *= 0.85;
        this.saccadeOffsetY *= 0.85;
    }

    // ✨ NEW: 제스처 애니메이션
    private updateGestures(deltaMS: number) {
        if (!this.isGesturePlaying || !this.currentGesture) return;

        const now = Date.now();
        const elapsed = now - this.gestureStartTime;
        const progress = Math.min(elapsed / this.gestureDuration, 1.0);

        switch (this.currentGesture) {
            case 'NOD': // 끄덕끄덕
                this.gestureNod(progress);
                break;
            case 'SHAKE': // 노노
                this.gestureShake(progress);
                break;
            case 'TILT': // 갸웃
                this.gestureTilt(progress);
                break;
            case 'FIDGET': // 안절부절
                this.gestureFidget(progress);
                break;
            case 'SIGH': // 한숨
                this.gestureSigh(progress);
                break;
            case 'LOOK_DOWN': // 눈 내리깔기
                this.gestureLookDown(progress);
                break;
            case 'CLOSE_EYES': // 눈감기
                this.gestureCloseEyes(progress);
                break;
            case 'WINK': // 윙크
                this.gestureWink(progress);
                break;
            case 'PUFF_CHEEKS': // 볼 부풀리기
                this.gesturePuffCheeks(progress);
                break;
            case 'STICK_TONGUE': // 혀내밀기
                this.gestureStickTongue(progress);
                break;
            case 'SQUINT': // 눈 가늘게 뜨기
                this.gestureSquint(progress);
                break;
            case 'ROLL_EYES': // 눈동자 굴리기
                this.gestureRollEyes(progress);
                break;
            case 'LOOK_UP_THINK': // 눈동자 올리고 생각하기
                this.gestureLookUpThink(progress);
                break;
            case 'FLINCH': // 움찔하기
                this.gestureFlinch(progress);
                break;
            case 'PANT': // 가쁜 숨
                this.gesturePant(progress);
                break;
            case 'WAKE_UP': // 기상
                this.gestureWakeUp(progress);
                break;
        }

        // 제스처 종료
        if (progress >= 1.0) {
            this.isGesturePlaying = false;
            this.currentGesture = null;
            console.log("🎭 Gesture Finished");
        }
    }

    // [NOD] 끄덕끄덕 (Y축 상하) - 강도 높임, 더 확실하게 (두 번 끄덕이는 느낌으로 사이클 증가)
    private gestureNod(t: number) {
        // 0 -> 아래 -> 위 -> 아래 -> 위 -> 원위치 (2.5 사이클로 더 확실하게)
        const cycle = Math.sin(t * Math.PI * 5) * 30 * this.sensitivity; // 강도 20 -> 30, 사이클 2 -> 5
        this.idleTargetHeadY = cycle;
        this.idleTargetHeadX = 0;
        this.idleTargetHeadZ = 0;
    }

    // [SHAKE] 고개 젓기 (X축 좌우)
    private gestureShake(t: number) {
        // 좌 -> 우 -> 좌 -> 우 (2회 반복)
        const cycle = Math.sin(t * Math.PI * 4) * 35 * this.sensitivity;
        this.idleTargetHeadX = cycle;
        this.idleTargetHeadY = 0;
        this.idleTargetHeadZ = -cycle * 0.3; // Z도 같이
    }

    // [TILT] 갸웃 (Z축 회전) - 강도 높임, 더 그럴듯하게 (빠르게 기울이고 천천히 복귀)
    private gestureTilt(t: number) {
        // 빠르게 한쪽으로 기울이고 천천히 복귀 (ease-in-out)
        const easeInOut = t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
        this.idleTargetHeadZ = Math.sin(easeInOut * Math.PI / 2) * 40 * this.sensitivity; // 강도 25 -> 40, 커브 변경
        this.idleTargetHeadX = Math.sin(easeInOut * Math.PI / 2) * 15 * this.sensitivity; // X도 약간
        this.idleTargetHeadY = 8 * this.sensitivity; // 약간 위로
    }

    // [FIDGET] 안절부절 (빠른 시선 이동 + 몸 흔들림)
    private gestureFidget(t: number) {
        // 빠르게 랜덤하게 움직임
        if (Math.random() < 0.1) {
            this.gazeTargetX = (Math.random() - 0.5) * 2.5 * this.sensitivity;
            this.gazeTargetY = (Math.random() - 0.5) * 2.0 * this.sensitivity;
            this.idleTargetHeadX = (Math.random() - 0.5) * 40 * this.sensitivity;
            this.idleTargetHeadY = (Math.random() - 0.5) * 20 * this.sensitivity;
        }
    }
    private gestureMouthOpen = 0;
    // ✨ NEW: [SIGH] 한숨 쉬기 (숨 크게 내쉬기 + 고개 약간 숙임)
    private gestureSigh(t: number) {
        this.idleTargetHeadY = Math.sin(t * Math.PI) * -15;
        this.gestureMouthOpen = Math.sin(t * Math.PI) * 0.4;
    }

    // ✨ NEW: [LOOK_DOWN] 눈 내리깔기 (시선 아래로 + 눈 살짝 감음)
    private gestureLookDown(t: number) {
        const ease = Math.sin(t * Math.PI);
        this.gazeTargetY = -1.5 * ease * this.sensitivity;
        this.idleEyeOpenMax = 0.7 * (1 - ease * 0.3); // 살짝 감음
    }

    // ✨ NEW: [CLOSE_EYES] 눈감기 (천천히 감았다 뜸)
    private gestureCloseEyes(t: number) {
        const closePhase = t < 0.5 ? t * 2 : (1 - t) * 2;
        this.blinkValue = 1 - Math.sin(closePhase * Math.PI / 2); // 부드럽게 감음
    }

    // ✨ NEW: [WINK] 윙크 (한쪽 눈 감음)
    private gestureWink(t: number) {
        this.setParamOverride('ParamEyeROpen', t < 0.5 ? 0 : 1.0); // 오른쪽 눈만 (모델에 따라 L/R)
    }

    // ✨ NEW: [PUFF_CHEEKS] 볼 부풀리기 (입 벌리고 볼 팽창)
    private gesturePuffCheeks(t: number) {
        const puff = Math.sin(t * Math.PI);
        this.setParamOverride('ParamCheek', puff * 1.0 * this.sensitivity); // ParamCheek 가정
        this.setParamOverride('ParamMouthOpenY', puff * 0.5);
    }

    // ✨ NEW: [STICK_TONGUE] 혀내밀기 (입 벌리고 혀 앞으로)
    private gestureStickTongue(t: number) {
        const stick = Math.sin(t * Math.PI);
        this.setParamOverride('ParamTongue', stick * 1.0 * this.sensitivity); // ParamTongue 가정
        this.setParamOverride('ParamMouthOpenY', stick * 0.8);
    }

    // ✨ NEW: [SQUINT] 눈 가늘게 뜨기 (눈 좁히기 + 눈썹 약간 찌푸림)
    private gestureSquint(t: number) {
        const squint = Math.sin(t * Math.PI);
        this.idleEyeOpenMax = 0.6 + squint * 0.4;
        this.setParamOverride('ParamBrowLY', -squint * 0.5); // 눈썹 아래로 (가정)
    }

    // ✨ NEW: [ROLL_EYES] 눈동자 굴리기 (시선 원형으로 돌림)
    private gestureRollEyes(t: number) {
        const angle = t * Math.PI * 2;
        this.gazeTargetX = Math.cos(angle) * 1.5 * this.sensitivity;
        this.gazeTargetY = Math.sin(angle) * 1.5 * this.sensitivity;
    }

    // ✨ NEW: [LOOK_UP_THINK] 눈동자 올리고 생각하기 (시선 위로 + 고개 약간 젖힘)
    private gestureLookUpThink(t: number) {
        const ease = Math.sin(t * Math.PI);
        this.gazeTargetY = 1.2 * ease * this.sensitivity;
        this.gazeTargetX = (Math.random() - 0.5) * 0.5 * ease; // 약간 흔들림
        this.idleTargetHeadY = 15 * ease * this.sensitivity;
    }

    // ✨ NEW: [FLINCH] 움찔하기 (빠르게 뒤로 + 눈 감음)
    private gestureFlinch(t: number) {
        const flinch = Math.pow(1 - t, 2) * 20 * this.sensitivity;
        this.idleTargetHeadY = -flinch;
        this.blinkValue = t < 0.5 ? 0 : 1; // 순간 감음
    }

    // ✨ NEW: [PANT] 가쁜 숨 (빠른 호흡 + 몸 약간 떨림)
    private gesturePant(t: number) {
        const pantRate = 4.0 * 1.8; // 약간 느리게 하여 큰 움직임 강조
        const breath = (Math.sin(t * Math.PI * 2 * pantRate) + 1) * 0.5;
        this.idleTargetHeadY = (breath * 50) * this.sensitivity;
        this.idleTargetHeadX = 0;
        this.idleTargetHeadZ = breath * 10 * this.sensitivity;
    }

    // ✨ NEW: [WAKE_UP] 기상 (기지개 + 하품 + 눈 번쩍)
    private gestureWakeUp(t: number) {
        // 1. Stretch (0~70%)
        if (t < 0.7) {
            const ease = Math.sin((t / 0.7) * Math.PI); // 0 -> 1 -> 0
            this.idleTargetHeadY = 15 * ease * this.sensitivity; // 고개 들기
            this.idleTargetHeadZ = -5 * ease; // 고개 갸웃
            this.setParamOverride('ParamMouthOpenY', 0.6 * ease); // 하품

            // 눈은 천천히 뜸
            const wakeEye = Math.min(1, (t / 0.5));
            this.idleEyeOpenMax = 0.2 + (wakeEye * 0.8); // 0.2 -> 1.0
        } else {
            // 2. Blink/Shake (70%~100%)
            const remainder = (t - 0.7) / 0.3; // 0~1
            // 빠르게 두 번 깜빡임
            const blink = Math.sin(remainder * Math.PI * 4);
            this.blinkValue = blink > 0.8 ? 0 : 1;

            this.idleTargetHeadY = 0;
            this.idleEyeOpenMax = 1.0;
        }
    }

    private updateBlinking(deltaMS: number, values: Float32Array) {
        const now = Date.now();

        switch (this.blinkState) {
            case 'OPEN':
                if (now >= this.nextBlinkTime) {
                    this.blinkState = 'CLOSING';
                    this.blinkTimer = 0;
                }
                break;
            case 'CLOSING':
                this.blinkTimer += deltaMS;
                const closeRatio = this.blinkTimer / (this.blinkDuration * 0.4);
                if (closeRatio >= 1) {
                    this.blinkValue = 0.0;
                    this.blinkState = 'CLOSED';
                    this.blinkTimer = 0;
                } else {
                    this.blinkValue = 1.0 - closeRatio;
                }
                break;
            case 'CLOSED':
                this.blinkTimer += deltaMS;
                if (this.blinkTimer > 50) {
                    this.blinkState = 'OPENING';
                    this.blinkTimer = 0;
                }
                break;
            case 'OPENING':
                this.blinkTimer += deltaMS;
                const openRatio = this.blinkTimer / (this.blinkDuration * 0.6);
                if (openRatio >= 1) {
                    this.blinkValue = 1.0;
                    this.blinkState = 'OPEN';
                    this.scheduleNextBlink();
                } else {
                    this.blinkValue = openRatio;
                }
                break;
        }
    }

    private setBreathOverride: number | null = null; // ✨ NEW: 제스처용 override

    private updateBreathing(deltaMS: number, values: Float32Array) {
        const t = Date.now() / 1000;
        let breathValue = (Math.sin(t * 1.5 * this.activeConfig.breathRate) + 1) * 0.5;

        if (this.setBreathOverride !== null) {
            breathValue = this.setBreathOverride;
            if (!this.isGesturePlaying) this.setBreathOverride = null; // 종료 후 리셋
        }

        this.setParam(values, 'ParamBreath', breathValue);
    }

    private updatePhysics(deltaMS: number, values: Float32Array, internal: any) {
        const now = Date.now();
        const config = this.activeConfig;

        // --- 1. Audio Sync ---
        if (internal.motionManager && typeof internal.motionManager.mouthSync === 'function') {
            this.bodyVol = internal.motionManager.mouthSync();
        }

        // --- 2. Idle Behavior (제스처가 재생 중이면 스킵) ---
        if (!this.isGesturePlaying && now >= this.nextIdleMoveTime) {
            const actionRoll = Math.random();

            if (actionRoll < 0.4) {
                this.idleTargetHeadX = (Math.random() - 0.5) * 60 * this.sensitivity;
                this.idleTargetHeadY = (Math.random() - 0.5) * 10 * this.sensitivity + config.headYOffset;
                this.idleTargetHeadZ = -this.idleTargetHeadX * 0.2;
            } else if (actionRoll < 0.6) {
                this.idleTargetHeadX = 0;
                this.idleTargetHeadY = (Math.random() - 0.5) * 20 * this.sensitivity + config.headYOffset;
                this.idleTargetHeadZ = 0;
            } else {
                this.idleTargetHeadX = (Math.random() - 0.5) * 5 * this.sensitivity;
                this.idleTargetHeadY = (Math.random() - 0.5) * 5 * this.sensitivity + config.headYOffset;
                this.idleTargetHeadZ = 0;
            }

            if (config.eyeOpenMin >= 1.0) {
                this.idleEyeOpenMax = config.eyeOpenMin;
            } else {
                this.idleEyeOpenMax = Math.random() < 0.3 ? config.eyeOpenMin : 1.0;
            }

            this.nextIdleMoveTime = now + config.idleIntervalMin + Math.random() * 2000;
        }

        // --- 3. Chaotic Gaze (제스처 중에도 동작, 단 안절부절/FIDGET 빼고) ---
        if (this.currentEmotion !== 'SLEEP' && this.currentGesture !== 'FIDGET' && this.currentGesture !== 'ROLL_EYES' && this.currentGesture !== 'LOOK_UP_THINK' && now >= this.nextGazeMoveTime) {
            this.gazeTargetX = (Math.random() - 0.5) * 2.0 * this.sensitivity;
            this.gazeTargetY = (Math.random() - 0.5) * 1.5 * this.sensitivity;
            this.nextGazeMoveTime = now + 200 + Math.random() * 1300;
        } else if (this.currentEmotion === 'SLEEP') {
            this.gazeTargetX = 0;
            this.gazeTargetY = 0;
        }

        // --- 4. Physics Interpolation ---
        const speed = config.motionSpeed;

        // ✨ Speaking Damping Logic (Non-destructive)
        // isSpeaking이 true이면 항상 부드럽게 감쇠 (볼륨 0이어도 유지)
        const damp = this.isSpeaking ? 0.6 : 1.0; // 말할 때는 60% 정도의 움직임만 허용

        // damped targets
        const effectiveHeadX = this.idleTargetHeadX * damp;
        const effectiveHeadY = this.idleTargetHeadY * damp;
        const effectiveHeadZ = this.idleTargetHeadZ * damp;

        // movement
        this.currentBodyX += (effectiveHeadX - this.currentBodyX) * speed;
        this.currentBodyY += (effectiveHeadY - this.currentBodyY) * speed;
        this.currentHeadZ += (effectiveHeadZ - this.currentHeadZ) * speed;

        // ✨ 눈동자는 고개보다 빠르게 (0.3 vs 0.05)
        // 시선도 Speaking 상태일 때 중앙으로 수렴 (강하게)
        const effectiveGazeX = this.isSpeaking ? this.gazeTargetX * 0.3 : this.gazeTargetX;
        const effectiveGazeY = this.isSpeaking ? this.gazeTargetY * 0.3 : this.gazeTargetY;

        this.gazeCurrentX += (effectiveGazeX - this.gazeCurrentX) * 0.3;
        this.gazeCurrentY += (effectiveGazeY - this.gazeCurrentY) * 0.3;

        this.blinkOpenValue += (this.idleEyeOpenMax - this.blinkOpenValue) * 0.1;

        // --- 4.5 Voice Bob ---
        const rawVol = this.clamp(this.bodyVol ?? 0, 0, 1);
        const gate = 0.06;
        const volGated = rawVol <= gate ? 0 : (rawVol - gate) / (1 - gate);

        const attackMs = 60;
        const releaseMs = 180;
        const aAttack = 1 - Math.exp(-deltaMS / attackMs);
        const aRelease = 1 - Math.exp(-deltaMS / releaseMs);

        const targetEnv = volGated;
        const a = targetEnv > this.voiceEnv ? aAttack : aRelease;
        this.voiceEnv += (targetEnv - this.voiceEnv) * a;

        let amp = 6.0 * this.sensitivity; // 감도 적용
        if (this.currentEmotion === 'ELATED') amp = 5.0 * this.sensitivity;
        if (this.currentEmotion === 'DEPRESSED') amp = 2.0 * this.sensitivity;
        if (this.currentEmotion === 'STERN') amp = 3.0 * this.sensitivity;
        if (this.currentEmotion === 'ASTONISHED') amp = 6.0 * this.sensitivity;
        if (this.currentEmotion === 'GENTLE') amp = 4.0 * this.sensitivity;
        if (this.currentEmotion === 'TENSE') amp = 3.5 * this.sensitivity;

        const voiceBobY = this.clamp(this.voiceEnv * amp, 0, amp);

        // --- 5. Apply Parameters ---
        const finalEyeOpen = this.blinkValue * this.blinkOpenValue;

        this.setParam(values, 'ParamEyeLOpen', this.getParamOverride('ParamEyeLOpen', finalEyeOpen));
        this.setParam(values, 'ParamEyeROpen', this.getParamOverride('ParamEyeROpen', finalEyeOpen));

        // ✨ 눈동자에 마이크로 새카드 적용
        this.setParam(values, 'ParamEyeBallX', this.gazeCurrentX + this.saccadeOffsetX);
        this.setParam(values, 'ParamEyeBallY', this.gazeCurrentY + this.saccadeOffsetY);

        // Drag Effect
        const dragX = this.dragTargetX * 70 * this.sensitivity;
        const dragY = this.dragTargetY * 60 * this.sensitivity;

        const angleX = this.currentBodyX + dragX;
        const angleY = this.currentBodyY + dragY + (voiceBobY * 0.35);
        const angleZ = this.currentHeadZ + (dragX * -0.2);

        this.setParam(values, 'ParamAngleX', angleX);
        this.setParam(values, 'ParamAngleY', angleY);
        this.setParam(values, 'ParamAngleZ', angleZ);

        const bodyX = (this.currentBodyX + dragX) * 0.5;
        const bodyY = (this.currentBodyY + dragY) * 0.5 + voiceBobY;
        const bodyZ = (this.currentBodyX + dragX) * 0.2;

        this.setParam(values, 'ParamBodyAngleX', bodyX);
        this.setParam(values, 'ParamBodyAngleY', bodyY);
        this.setParam(values, 'ParamBodyAngleZ', bodyZ);

        // ✨ 제스처 오버라이드 적용 (추가 param)
        this.applyParamOverrides(values);

        if (this.isGesturePlaying) {
            this.setParam(values, 'ParamMouthOpenY', this.gestureMouthOpen);
        }

        // ✨ 말할 때 오버라이드 적용 (마지막에 적용하여 우선순위 높임)
        this.applySpeakingExpressions(values);

        // 💤 SLEEP OVERRIDE (Final Enforcement)
        if (this.currentEmotion === 'SLEEP') {
            this.setParam(values, 'ParamEyeLOpen', 0);
            this.setParam(values, 'ParamEyeROpen', 0);
            this.setParam(values, 'ParamEyeBallX', 0);
            this.setParam(values, 'ParamEyeBallY', 0);
            // 고개는 약간 숙인 상태 유지를 위해 물리를 완전히 끄진 않지만 제한할 수 있음
        }
    }

    private paramOverrides: Record<string, number> = {}; // ✨ NEW: 제스처용 param override

    private setParamOverride(key: string, value: number) {
        this.paramOverrides[key] = value;
    }

    private getParamOverride(key: string, defaultValue: number): number {
        return this.paramOverrides[key] !== undefined ? this.paramOverrides[key] : defaultValue;
    }

    private applyParamOverrides(values: Float32Array) {
        for (const [key, value] of Object.entries(this.paramOverrides)) {
            this.setParam(values, key, value);
        }
        if (!this.isGesturePlaying) this.paramOverrides = {}; // 종료 후 클리어
    }

    // ✨ NEW: 말할 때 특수 효과 (눈 살짝 감음) - 위치 고정 로직은 updatePhysics에서 처리
    private applySpeakingExpressions(values: Float32Array) {
        // 음성 볼륨이 일정 이상일 때만 발동
        if (this.voiceEnv > 0.1) {
            const intensity = Math.min(this.voiceEnv * 1.5, 1.0); // 0.0 ~ 1.0 강도
            const currentBlink = this.blinkValue * this.blinkOpenValue;
            let squintFactor = 1.0; // 기본값
            let browFactor = 0.0; // 눈썹 조절 (음수: 찌푸림, 양수: 올림)
            let mouthAdd = 0.0; // 추가 입 열림

            // 감정에 따라 다르게 설정
            switch (this.currentEmotion) {
                case 'ELATED':
                    // 기쁨: 눈 크게 뜨고, 눈썹 올림, 입 크게
                    squintFactor = 1.0 + intensity * 0.1; // 살짝 더 뜸 (max 1.1)
                    browFactor = intensity * 0.5; // 눈썹 올림
                    mouthAdd = intensity * 0.2; // 입 더 벌림
                    break;
                case 'GENTLE':
                    // 부드러움: 약간 감은 눈, 눈썹 약간 내림, 입 부드럽게
                    squintFactor = 1.0 - intensity * 0.1; // 살짝 감음 (min 0.9)
                    browFactor = -intensity * 0.2; // 약간 찌푸림
                    mouthAdd = intensity * 0.1;
                    break;
                case 'STERN':
                    // 엄격함: 눈 가늘게, 눈썹 강하게 찌푸림, 입 단호하게
                    squintFactor = 1.0 - intensity * 0.25; // 더 감음 (min 0.75)
                    browFactor = -intensity * 0.8; // 강한 찌푸림
                    mouthAdd = intensity * 0.05; // 적게 벌림
                    break;
                case 'DEPRESSED':
                    // 우울: 눈 많이 감음, 눈썹 내림, 입 약하게
                    squintFactor = 1.0 - intensity * 0.3; // 많이 감음 (min 0.7)
                    browFactor = -intensity * 0.4;
                    mouthAdd = intensity * 0.05;
                    break;
                case 'TENSE':
                    // 긴장: 눈 크게, 눈썹 찌푸림, 입 꽉
                    squintFactor = 1.0 + intensity * 0.05; // 살짝 더 뜸
                    browFactor = -intensity * 0.6;
                    mouthAdd = intensity * 0.1;
                    break;
                case 'ASTONISHED':
                    // 놀람: 눈 크게 뜨고, 눈썹 올림, 입 크게
                    squintFactor = 1.0 + intensity * 0.2; // 더 뜸 (max 1.2)
                    browFactor = intensity * 0.7; // 눈썹 높이 올림
                    mouthAdd = intensity * 0.3; // 크게 벌림
                    break;
                case 'CALM':
                    // 차분: 기본 살짝 감음
                    squintFactor = 1.0 - intensity * 0.15; // 원래 동작 (min 0.85)
                    browFactor = 0.0;
                    mouthAdd = 0.0;
                    break;
            }

            // 눈 적용 (squintFactor 범위 제한: 0.5 ~ 1.5로 안전하게)
            const finalEyeOpen = currentBlink * this.clamp(squintFactor, 0.5, 1.5);
            this.setParam(values, 'ParamEyeLOpen', this.getParamOverride('ParamEyeLOpen', finalEyeOpen));
            this.setParam(values, 'ParamEyeROpen', this.getParamOverride('ParamEyeROpen', finalEyeOpen));

            // 눈썹 적용 (모델에 따라 L/R 동일하게)
            this.setParam(values, 'ParamBrowLY', browFactor);
            this.setParam(values, 'ParamBrowRY', browFactor);

            // 입 추가 열림 (기존 MouthOpenY에 더함, 모델의 mouthSync와 조합)
            const currentMouthOpen = this.getParamOverride('ParamMouthOpenY', 0); // 기본 0
            this.setParam(values, 'ParamMouthOpenY', currentMouthOpen + mouthAdd);
        }
    }

    private scheduleNextBlink() {
        this.nextBlinkTime = Date.now() + 2000 + Math.random() * 4000;
        if (Math.random() < 0.1) {
            this.nextBlinkTime = Date.now() + 150 + Math.random() * 100;
        }
    }

    private scheduleNextSaccade() {
        this.nextSaccadeTime = Date.now() + 50 + Math.random() * 250;
    }

    private cacheParamIndices() {
        if (!this.model || !this.model.internalModel) return;
        const core = this.model.internalModel.coreModel;
        const ids = core._parameterIds;

        const targets = [
            'ParamAngleX', 'ParamAngleY', 'ParamAngleZ',
            'ParamBodyAngleX', 'ParamBodyAngleY', 'ParamBodyAngleZ',
            'ParamEyeLOpen', 'ParamEyeROpen', 'ParamBreath',
            'ParamEyeBallX', 'ParamEyeBallY',
            // ✨ NEW: 추가 파라미터 (모델에 따라 aliases 추가)
            'ParamMouthOpenY', 'ParamMouthForm',
            'ParamCheek', 'ParamTongue',
            'ParamBrowLY', 'ParamBrowRY'
        ];

        const aliases: Record<string, string[]> = {
            'ParamBodyAngleX': ['ParamBodyX'],
            'ParamBodyAngleY': ['ParamBodyY', 'ParamBodyAngle'],
            'ParamBodyAngleZ': ['ParamBodyZ'],
            // ✨ NEW: 추가 aliases (모델별로 다를 수 있음)
            'ParamMouthOpenY': ['ParamMouthOpen'],
            'ParamCheek': ['ParamCheekPuff'],
            'ParamTongue': ['ParamTongueOut'],
            'ParamBrowLY': ['ParamBrowL', 'ParamBrowY'],
            'ParamBrowRY': ['ParamBrowR']
        };

        targets.forEach(key => {
            let idx = ids.indexOf(key);
            if (idx === -1 && aliases[key]) {
                for (const alias of aliases[key]) {
                    idx = ids.indexOf(alias);
                    if (idx !== -1) break;
                }
            }
            this.paramIndices[key] = idx;
        });

        console.log("🤖 Autonomy Parameter Map:", this.paramIndices);
    }

    private setParam(values: Float32Array, key: string, value: number) {
        const idx = this.paramIndices[key];
        if (idx !== undefined && idx !== -1) {
            if (typeof value === 'number' && isFinite(value)) {
                values[idx] = value;
            }
        }
    }

    private clamp(val: number, min: number, max: number) {
        return Math.min(Math.max(val, min), max);
    }
}

// ✨ 제스처 타입 정의
type GestureType = 'NOD' | 'SHAKE' | 'TILT' | 'FIDGET' | 'SIGH' | 'LOOK_DOWN' | 'CLOSE_EYES' | 'WINK' | 'PUFF_CHEEKS' | 'STICK_TONGUE' | 'SQUINT' | 'ROLL_EYES' | 'LOOK_UP_THINK' | 'FLINCH' | 'PANT'
    | 'WAKE_UP';
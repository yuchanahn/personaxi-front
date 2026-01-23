export class Live2DAutonomy {
    private model: any;
    private app: any;
    private ticker: ((ticker: any) => void) | null = null;

    // --- State: Physics / Drag ---
    private dragTargetX = 0;
    private dragTargetY = 0;
    private dragPhysicsX = 0;
    private dragPhysicsY = 0;
    private currentBodyX = 0;
    private currentBodyY = 0;
    private bodyVol = 0;

    // --- State: Blinking ---
    private blinkState: 'OPEN' | 'CLOSING' | 'CLOSED' | 'OPENING' = 'OPEN';
    private nextBlinkTime = 0;
    private blinkOpenValue = 1.0; // 현재 눈이 떠있는 정도 (게슴츠레함 반영)
    private blinkValue = 1.0;     // 깜빡임 애니메이션 값 (0~1)
    private blinkDuration = 150;
    private blinkTimer = 0;

    // --- State: Motion Logic ---
    private gazeTargetX = 0;
    private gazeTargetY = 0;
    private gazeCurrentX = 0;
    private gazeCurrentY = 0;

    private idleTargetHeadX = 0;
    private idleTargetHeadY = 0;
    private idleTargetHeadZ = 0;
    private idleEyeOpenMax = 1.0;
    private nextIdleMoveTime = 0;
    private nextGazeMoveTime = 0;

    // --- State: Emotion & Presets ---
    public currentEmotion: 'NORMAL' | 'HAPPY' | 'SAD' | 'ANGRY' | 'SURPRISED' = 'NORMAL';

    // 감정별 행동 지침 (속도, 고개 오프셋, 눈 크기, 호흡 속도, 대기 시간)
    private emotionConfigs = {
        NORMAL: { headYOffset: 0, motionSpeed: 0.05, eyeOpenMin: 1.0, breathRate: 1.0, idleIntervalMin: 1000 },
        HAPPY: { headYOffset: 5, motionSpeed: 0.12, eyeOpenMin: 1.0, breathRate: 1.5, idleIntervalMin: 500 },
        SAD: { headYOffset: -15, motionSpeed: 0.02, eyeOpenMin: 0.6, breathRate: 0.6, idleIntervalMin: 3000 },
        ANGRY: { headYOffset: -5, motionSpeed: 0.08, eyeOpenMin: 1.2, breathRate: 2.5, idleIntervalMin: 800 },
        SURPRISED: { headYOffset: 10, motionSpeed: 0.20, eyeOpenMin: 1.5, breathRate: 0.2, idleIntervalMin: 4000 }
    };

    private activeConfig = this.emotionConfigs.NORMAL;

    // --- Parameter Indices Cache ---
    private paramIndices: Record<string, number> = {};

    constructor(model: any, app: any) {
        this.model = model;
        this.app = app;
        this.cacheParamIndices();
        this.scheduleNextBlink();
    }

    public start() {
        if (this.ticker) return;

        this.ticker = (dt: number) => {
            // PIXI Ticker DeltaMS Safety Check
            let deltaMS = this.app.ticker.deltaMS;
            if (!deltaMS || isNaN(deltaMS)) deltaMS = 16.6;
            this.update(deltaMS);
        };

        this.app.ticker.add(this.ticker, null, 0);
        console.log("🤖 Live2D Autonomy System Started");
    }

    public stop() {
        if (this.ticker) {
            this.app.ticker.remove(this.ticker);
            this.ticker = null;
        }
    }

    // 감정 상태 변경 (외부 호출용)
    public setEmotion(emotion: keyof typeof this.emotionConfigs) {
        if (this.currentEmotion === emotion) return;

        console.log(`🤖 Emotion Changed: ${this.currentEmotion} -> ${emotion}`);
        this.currentEmotion = emotion;
        this.activeConfig = this.emotionConfigs[emotion];

        // 즉각 반응을 위해 타이머 리셋
        this.nextIdleMoveTime = Date.now();

        // 놀람/화남 등 격한 감정일 경우 눈을 바로 뜨게 함
        if (emotion === 'SURPRISED' || emotion === 'ANGRY') {
            this.blinkState = 'OPEN';
            this.blinkValue = 1.0;
            this.nextBlinkTime = Date.now() + 2000;
        }
    }

    public handleDrag(normalizedX: number, normalizedY: number) {
        // -1.0 ~ 1.0
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
        this.updatePhysics(deltaMS, values, internal);
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

        // blinkValue는 단순히 0~1 사이의 애니메이션 값. 
        // 최종 눈 크기는 Physics 단계에서 emotion과 결합하여 적용됨.
    }

    private updateBreathing(deltaMS: number, values: Float32Array) {
        const t = Date.now() / 1000;
        // 감정별 호흡 속도(breathRate) 반영
        const breathValue = (Math.sin(t * 1.5 * this.activeConfig.breathRate) + 1) * 0.5;
        this.setParam(values, 'ParamBreath', breathValue);
    }

    private updatePhysics(deltaMS: number, values: Float32Array, internal: any) {
        const now = Date.now();
        const config = this.activeConfig;

        // --- 1. Audio Sync ---
        if (internal.motionManager && typeof internal.motionManager.mouthSync === 'function') {
            this.bodyVol = internal.motionManager.mouthSync();
        }

        // --- 2. Idle Behavior Decision (Emotion Based) ---
        if (now >= this.nextIdleMoveTime) {
            const actionRoll = Math.random();

            if (actionRoll < 0.4) {
                // 좌우 두리번 + 감정별 고개 높이(Offset)
                this.idleTargetHeadX = (Math.random() - 0.5) * 60;
                this.idleTargetHeadY = (Math.random() - 0.5) * 10 + config.headYOffset;
                this.idleTargetHeadZ = -this.idleTargetHeadX * 0.2;
            } else if (actionRoll < 0.6) {
                // 끄덕임/젖힘 (감정 오프셋 중심)
                this.idleTargetHeadX = 0;
                this.idleTargetHeadY = (Math.random() - 0.5) * 20 + config.headYOffset;
                this.idleTargetHeadZ = 0;
            } else {
                // 정면 복귀
                this.idleTargetHeadX = (Math.random() - 0.5) * 5;
                this.idleTargetHeadY = (Math.random() - 0.5) * 5 + config.headYOffset;
                this.idleTargetHeadZ = 0;
            }

            // 눈 게슴츠레 여부 결정 (Sad 모드 등 반영)
            if (config.eyeOpenMin >= 1.0) {
                this.idleEyeOpenMax = config.eyeOpenMin;
            } else {
                this.idleEyeOpenMax = Math.random() < 0.3 ? config.eyeOpenMin : 1.0;
            }

            // 다음 행동 대기시간: 감정별 템포 + 랜덤
            this.nextIdleMoveTime = now + config.idleIntervalMin + Math.random() * 2000;
        }

        // --- 3. Chaotic Gaze ---
        if (now >= this.nextGazeMoveTime) {
            this.gazeTargetX = (Math.random() - 0.5) * 2.0;
            this.gazeTargetY = (Math.random() - 0.5) * 1.5;
            this.nextGazeMoveTime = now + 200 + Math.random() * 1300;
        }

        // --- 4. Physics Interpolation ---
        // 감정별 반응 속도(motionSpeed) 적용
        const speed = config.motionSpeed;

        this.currentBodyX += (this.idleTargetHeadX - this.currentBodyX) * speed;
        this.currentBodyY += (this.idleTargetHeadY - this.currentBodyY) * speed;

        this.gazeCurrentX += (this.gazeTargetX - this.gazeCurrentX) * 0.15;
        this.gazeCurrentY += (this.gazeTargetY - this.gazeCurrentY) * 0.15;

        // 눈 떠짐 정도 부드럽게 변경
        this.blinkOpenValue += (this.idleEyeOpenMax - this.blinkOpenValue) * 0.1;

        // --- 5. Apply Parameters ---
        const finalEyeOpen = this.blinkValue * this.blinkOpenValue;

        this.setParam(values, 'ParamEyeLOpen', finalEyeOpen);
        this.setParam(values, 'ParamEyeROpen', finalEyeOpen);

        this.setParam(values, 'ParamEyeBallX', this.gazeCurrentX);
        this.setParam(values, 'ParamEyeBallY', this.gazeCurrentY);

        // Drag Effect 합성
        const dragX = this.dragTargetX * 70;
        const dragY = this.dragTargetY * 60;

        this.setParam(values, 'ParamAngleX', this.currentBodyX + dragX);
        this.setParam(values, 'ParamAngleY', this.currentBodyY + dragY);
        this.setParam(values, 'ParamAngleZ', this.idleTargetHeadZ + (dragX * -0.2));

        this.setParam(values, 'ParamBodyAngleX', (this.currentBodyX + dragX) * 0.5);
        this.setParam(values, 'ParamBodyAngleY', (this.currentBodyY + dragY) * 0.5);
        this.setParam(values, 'ParamBodyAngleZ', (this.currentBodyX + dragX) * 0.2);
    }

    private scheduleNextBlink() {
        this.nextBlinkTime = Date.now() + 2000 + Math.random() * 4000;
        if (Math.random() < 0.1) {
            this.nextBlinkTime = Date.now() + 150 + Math.random() * 100;
        }
    }

    private cacheParamIndices() {
        if (!this.model || !this.model.internalModel) return;
        const core = this.model.internalModel.coreModel;
        const ids = core._parameterIds;

        const targets = [
            'ParamAngleX', 'ParamAngleY', 'ParamAngleZ',
            'ParamBodyAngleX', 'ParamBodyAngleY', 'ParamBodyAngleZ',
            'ParamEyeLOpen', 'ParamEyeROpen', 'ParamBreath',
            'ParamEyeBallX', 'ParamEyeBallY'
        ];

        const aliases: Record<string, string[]> = {
            'ParamBodyAngleX': ['ParamBodyX'],
            'ParamBodyAngleY': ['ParamBodyY', 'ParamBodyAngle'],
            'ParamBodyAngleZ': ['ParamBodyZ'],
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
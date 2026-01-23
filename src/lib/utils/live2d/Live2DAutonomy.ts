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
    private bodyVol = 0; // For speech reaction smoothing
    private speechEnergy = 0; // V3: Smoothed envelope "Am I speaking?" state
    private squintTarget = 1.0; // V3: Stable target for eye openness
    private currentSquint = 1.0; // V3: Smoothed current squint value

    // --- State: Blinking ---
    private blinkState: 'OPEN' | 'CLOSING' | 'CLOSED' | 'OPENING' = 'OPEN';
    private nextBlinkTime = 0;
    private blinkOpenValue = 1.0;
    private blinkValue = 1.0;
    private blinkDuration = 150; // Total duration of a blink in ms
    private blinkTimer = 0; // Progress within current blink

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

        // Use arrow function to preserve 'this' context
        this.ticker = (dt: number) => {
            // Fix: PIXI ticker passes a number (deltaTime coefficient), NOT the ticker object.
            // asking for dt.deltaMS returns undefined -> NaN

            // Get actual MS from the app ticker
            let deltaMS = this.app.ticker.deltaMS;

            // Fallback safety
            if (!deltaMS || isNaN(deltaMS)) deltaMS = 16.6;

            this.update(deltaMS);
        };

        // Priority: Run AFTER the standard model update to overwrite parameters.
        this.app.ticker.add(this.ticker, null, 0);
        console.log("🤖 Live2D Autonomy System Started (Priority: 0)");
    }

    public stop() {
        if (this.ticker) {
            this.app.ticker.remove(this.ticker);
            this.ticker = null;
            console.log("🤖 Live2D Autonomy System Stopped");
        }
    }

    public handleDrag(normalizedX: number, normalizedY: number) {
        // Input should be -1.0 to 1.0
        // Add "kick" to physics (Velocity Impulse)
        const deltaX = (normalizedX - this.dragTargetX) * 20;
        const deltaY = (normalizedY - this.dragTargetY) * 20;

        this.dragPhysicsX += deltaX;
        this.dragPhysicsY += deltaY;

        // Clamp Physics to prevent explosion
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

        // State Machine
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
                if (this.blinkTimer > 50) { // Stay closed for 50ms
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

        const finalVal = Math.max(0, Math.min(1, this.blinkValue));

        this.setParam(values, 'ParamEyeLOpen', finalVal);
        this.setParam(values, 'ParamEyeROpen', finalVal);
    }

    private updateBreathing(deltaMS: number, values: Float32Array) {
        const t = Date.now() / 1000;
        const breathValue = (Math.sin(t * 1.5) + 1) * 0.5; // 0 to 1

        this.setParam(values, 'ParamBreath', breathValue);
    }

    private updatePhysics(deltaMS: number, values: Float32Array, internal: any) {
        this.normal(deltaMS, values, internal);
    }


    private gazeTargetX = 0;
    private gazeTargetY = 0;
    private gazeCurrentX = 0;
    private gazeCurrentY = 0;

    private idleTargetHeadX = 0;      // 머리 목표 X 각도
    private idleTargetHeadY = 0;      // 머리 목표 Y 각도 (고개 젖힘 등)
    private idleTargetHeadZ = 0;      // 머리 목표 Z 각도 (갸웃)

    private idleEyeOpenMax = 1.0;     // 눈을 뜨는 최대치 (1.0=다 뜸, 0.5=게슴츠레)
    private nextIdleMoveTime = 0;     // 다음 행동 변경 시간

    private nextGazeMoveTime = 0;     // 다음 시선 변경 시간

    private normal(deltaMS: number, values: Float32Array, internal: any) {
        const now = Date.now();
        const t = now / 1000;

        // --- 1. Audio Input (Lip Sync Only) ---
        let rawVolume = 0;
        if (internal.motionManager && typeof internal.motionManager.mouthSync === 'function') {
            rawVolume = internal.motionManager.mouthSync();
        }
        // 입 모양만 싱크
        this.bodyVol = rawVolume;

        // --- 2. Idle Behavior Decision (The Brain) ---
        // 일정 시간이 지나면 새로운 "자세"와 "표정"을 결정합니다.
        if (now >= this.nextIdleMoveTime) {

            // A. 머리 좌우/상하 랜덤 이동 (행동 결정)
            const actionRoll = Math.random();

            if (actionRoll < 0.4) {
                // [40%] 좌측 or 우측으로 랜덤하게 고개 돌리고 멍때리기
                // -30(Left) ~ 30(Right)
                this.idleTargetHeadX = (Math.random() - 0.5) * 60;
                this.idleTargetHeadY = (Math.random() - 0.5) * 10; // 위아래는 살짝만
                this.idleTargetHeadZ = -this.idleTargetHeadX * 0.2; // 자연스러운 틸트
            }
            else if (actionRoll < 0.6) {
                // [20%] 고개 젖히기나 숙이기 (거만/나른함) -> Y축 +20~30 or -20~30
                this.idleTargetHeadX = 0;
                this.idleTargetHeadY = (Math.random() - 0.5) * 20 + 20;
                this.idleTargetHeadZ = 0;
            }
            else {
                // [40%] 정면 근처로 복귀
                this.idleTargetHeadX = (Math.random() - 0.5) * 5;
                this.idleTargetHeadY = (Math.random() - 0.5) * 5;
                this.idleTargetHeadZ = 0;
            }

            // B. 눈 반쯤 뜨기 (게슴츠레) 결정
            // 30% 확률로 눈을 반만 뜸 (0.5 ~ 0.7), 나머지는 또렷하게 (1.0)
            if (Math.random() < 0.3) {
                this.idleEyeOpenMax = 0.5 + Math.random() * 0.2; // 게슴츠레
            } else {
                this.idleEyeOpenMax = 1.0; // 정상
            }

            // 다음 행동까지 1초 ~ 3.5초 대기 (불규칙한 리듬)
            this.nextIdleMoveTime = now + 1000 + Math.random() * 2500;
        }

        // --- 3. Chaotic Gaze (Saccade) ---
        // 시선은 머리 움직임과 별개로 더 자주, 더 막 움직입니다.
        if (now >= this.nextGazeMoveTime) {
            // 시선 범위: -1.0 ~ 1.0
            this.gazeTargetX = (Math.random() - 0.5) * 2.0;
            this.gazeTargetY = (Math.random() - 0.5) * 1.5;

            // 시선은 0.2초 ~ 1.5초마다 바뀜 (아주 산만함)
            this.nextGazeMoveTime = now + 200 + Math.random() * 1300;
        }

        // --- 4. Physics Interpolation (Lerp) ---

        // A. 머리 움직임 (부드럽게 이동)
        // 0.05 factor = 아주 나른하고 천천히 움직임
        this.currentBodyX += (this.idleTargetHeadX - this.currentBodyX) * 0.05;
        this.currentBodyY += (this.idleTargetHeadY - this.currentBodyY) * 0.05;

        // B. 시선 움직임 (빠릿하게)
        this.gazeCurrentX += (this.gazeTargetX - this.gazeCurrentX) * 0.15;
        this.gazeCurrentY += (this.gazeTargetY - this.gazeCurrentY) * 0.15;

        // C. 눈 게슴츠레 상태 (서서히 변함)
        // blinkOpenValue 변수를 재활용하거나 직접 보간
        this.blinkOpenValue += (this.idleEyeOpenMax - this.blinkOpenValue) * 0.1;


        // --- 5. Apply Parameters ---

        // 최종 눈 크기 = 깜빡임(0~1) * 게슴츠레한계값(0.5~1.0)
        const finalEyeOpen = this.blinkValue * this.blinkOpenValue;

        this.setParam(values, 'ParamEyeLOpen', finalEyeOpen);
        this.setParam(values, 'ParamEyeROpen', finalEyeOpen);

        // [EYEBALLS] 랜덤 시선 적용
        this.setParam(values, 'ParamEyeBallX', this.gazeCurrentX);
        this.setParam(values, 'ParamEyeBallY', this.gazeCurrentY);

        // [HEAD & BODY]
        // 기본 상태(Idle) + 마우스 드래그(Drag) 합성
        // 드래그가 있으면 드래그가 우선되도록 더해줍니다.

        const dragX = this.dragTargetX * 70; // 높은 감도 유지
        const dragY = this.dragTargetY * 60;

        // Head X: Idle + Drag
        this.setParam(values, 'ParamAngleX', this.currentBodyX + dragX);

        // Head Y: Idle + Drag
        this.setParam(values, 'ParamAngleY', this.currentBodyY + dragY);

        // Head Z: Idle Tilt + Drag Tilt
        this.setParam(values, 'ParamAngleZ',
            this.idleTargetHeadZ + (dragX * -0.2)
        );

        // Body: 머리를 따라가되 조금 늦게
        this.setParam(values, 'ParamBodyAngleX', (this.currentBodyX + dragX) * 0.5);
        this.setParam(values, 'ParamBodyAngleY', (this.currentBodyY + dragY) * 0.5);
        this.setParam(values, 'ParamBodyAngleZ', (this.currentBodyX + dragX) * 0.2);
    }

    private scheduleNextBlink() {
        // Random time between 2s and 6s
        this.nextBlinkTime = Date.now() + 2000 + Math.random() * 4000;

        // Occasional double blink (10% chance)
        if (Math.random() < 0.1) {
            this.nextBlinkTime = Date.now() + 150 + Math.random() * 100;
        }
    }

    // --- Helpers ---

    private cacheParamIndices() {
        if (!this.model || !this.model.internalModel) return;
        const core = this.model.internalModel.coreModel;
        const ids = core._parameterIds;

        // Explicit mapping for the user's current model
        // Based on provided logs:
        // 0: "ParamAngleX"
        // 1: "ParamAngleY"
        // 2: "ParamAngleZ"
        // 3: "ParamBodyAngleX"
        // 5: "ParamBodyAngleY"
        // 7: "ParamBodyAngleZ"
        // 8: "ParamBreath"
        // 16: "ParamEyeLOpen"
        // 19: "ParamEyeROpen"

        const targets = [
            'ParamAngleX', 'ParamAngleY', 'ParamAngleZ',
            'ParamBodyAngleX', 'ParamBodyAngleY', 'ParamBodyAngleZ',
            'ParamEyeLOpen', 'ParamEyeROpen',
            'ParamBreath',
            // Add explicit ones just in case
            'ParamEyeBallX', 'ParamEyeBallY',
            'ParamMouthOpenY'
        ];

        // Also look for alternative names if needed (e.g. ParamBodyX instead of ParamBodyAngleX)
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
            // Safety Check: Ensure value is a finite number
            if (typeof value === 'number' && isFinite(value)) {
                values[idx] = value;
            } else {
                console.warn(`⚠️ Autonomy: Invalid value for ${key}:`, value);
            }
        }
    }

    private clamp(val: number, min: number, max: number) {
        return Math.min(Math.max(val, min), max);
    }

    private easeInOutQuad(t: number): number {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
}

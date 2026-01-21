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
        const values = core._parameterValues; // Direct access for performance

        // 1. Update Sub-systems
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

        // Apply to Parameters
        const finalVal = Math.max(0, Math.min(1, this.blinkValue));

        this.setParam(values, 'ParamEyeLOpen', finalVal);
        this.setParam(values, 'ParamEyeROpen', finalVal);

        // Debug blink value occasionally
        // if (Math.random() < 0.01) console.log("Blink:", safeBlink);
    }

    private updateBreathing(deltaMS: number, values: Float32Array) {
        // Standard Live2D Breath is usually handled by the Cubism framework automatic motion,
        // but we can override or enhance it here.

        const t = Date.now() / 1000;
        const breathValue = (Math.sin(t * 1.5) + 1) * 0.5; // 0 to 1

        // Standard Breath
        this.setParam(values, 'ParamBreath', breathValue);

        // Subtle Chest Heave (Body Y) - Additive to physics
        // Note: We'll apply this in Physics to combine with drag
    }

    private updatePhysics(deltaMS: number, values: Float32Array, internal: any) {
        // --- 1. Audio Reaction ---
        let volume = 0;
        if (internal.motionManager && typeof internal.motionManager.mouthSync === 'function') {
            volume = internal.motionManager.mouthSync(); // 0 ~ 1
        }

        const inputIntensity = Math.max(0, (volume * 10 - 1) / 4);
        this.bodyVol += (inputIntensity - this.bodyVol) * 0.1;

        // --- 2. Sway (Ambient) ---
        const t = Date.now() / 1000;
        const sway = (Math.sin(t * 1.5) + Math.cos(t * 0.9)) * 0.5;

        // --- 3. Drag Physics (Spring) ---
        const targetX = this.dragTargetX * 10;
        const targetY = this.dragTargetY * 10;

        // Smooth Damping (Lerp)
        this.currentBodyX += (targetX - this.currentBodyX) * 0.1;
        this.currentBodyY += (targetY - this.currentBodyY) * 0.1;

        // Velocity Decay
        this.dragPhysicsX *= 0.9;
        this.dragPhysicsY *= 0.9;

        // Final calculated values
        const finalBodyX = this.currentBodyX + this.dragPhysicsX;
        const finalBodyY = this.currentBodyY + this.dragPhysicsY;

        // --- 4. Apply to Parameters ---

        // Head Look At (Mouse + Physics)
        this.setParam(values, 'ParamAngleX', this.dragTargetX * 30 + this.dragPhysicsX * 0.5);

        // Head Angle Y (Mouse + Talk + Breathe)
        const breathe = (Math.sin(t * 2) * 2); // Local breathing var
        const talk = this.bodyVol * 10;
        this.setParam(values, 'ParamAngleY', breathe + talk + (this.dragTargetY * 30) + (this.dragPhysicsY * 0.5));

        // Head Angle Z (Tilt based on X)
        this.setParam(values, 'ParamAngleZ', (this.dragTargetX * -10) + (this.dragPhysicsX * -0.2));

        // Body X (Twist)
        this.setParam(values, 'ParamBodyAngleX', finalBodyX);

        // Body Y (Lean + Breathe)
        this.setParam(values, 'ParamBodyAngleY', finalBodyY + (this.bodyVol * 5));

        // Body Z (Tilt balance)
        this.setParam(values, 'ParamBodyAngleZ', (finalBodyX * 0.5) + sway);
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

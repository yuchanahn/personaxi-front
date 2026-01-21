<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { loadLive2DScripts } from "$lib/utils/live2dLoader";
    import Icon from "@iconify/svelte";
    import { SafeAudioManager } from "$lib/utils/safeAudioManager";
    import { Live2DAutonomy } from "$lib/utils/live2d/Live2DAutonomy";

    export let modelUrl: string;
    export let scale: number = 0.3;
    export let x: number = 0;
    export let y: number = 0;
    export let expressionMap: Record<string, string> = {};
    // svelte-ignore export_let_unused
    export let hitMotionMap: Record<string, string> = {};
    export let backgroundImage: string | null = null;

    let canvasElement: HTMLCanvasElement;
    let app: any;
    let currentModel: any | null = null;
    let isLoaded = false;
    let autonomy: Live2DAutonomy | null = null;

    // Debug State
    let showDebug = false;
    let debugInfo = {
        modelUrl: "",
        currentEmotion: "None",
        currentExpression: "None",
        lastMotion: "None",
        availableExpressions: [] as string[],
        availableMotionGroups: [] as string[],
        fileMotions: [] as string[],
        error: "",
        manualParamId: "",
        manualParamValue: 0,
    };

    let isDragging = false;

    export async function speak(audioUrl: string) {
        if (!currentModel) return;

        await SafeAudioManager.speak(currentModel, audioUrl, {
            onFinish: () => {
                console.log("### TTS Finished");
            },
            onError: (e) => {
                console.error("### TTS Error", e);
            },
        });
    }

    export function toggleDebug() {
        showDebug = !showDebug;
        if (currentModel && (currentModel as any).hitAreaFrames) {
            (currentModel as any).hitAreaFrames.visible = showDebug;
        }
    }
    // [TEST] Reset to Default
    export function resetToDefault() {
        if (!currentModel || !currentModel.internalModel) return;

        console.log("Debug: 🧹 Performing Hard Reset to Default");

        const internal = currentModel.internalModel;
        const mgr = internal.motionManager;

        // 1. 모션 정지 (안전하게 수정됨)
        if (mgr) {
            // A. stopAll이 함수로 존재하면 실행
            if (typeof mgr.stopAll === "function") {
                mgr.stopAll();
            }
            // B. 없다면 stop 함수 실행 (일반적인 경우)
            else if (typeof mgr.stop === "function") {
                mgr.stop();
            }

            // C. 혹시 몰라 대기열(Queue) 강제 초기화
            if (mgr.queue) {
                mgr.queue = [];
            }

            // 2. 표정(Expression) 강제 초기화
            if (mgr.expressionManager) {
                console.log("Debug: Stopping all expressions");
                // 여기도 혹시 모르니 체크
                if (
                    typeof mgr.expressionManager.stopAllExpressions ===
                    "function"
                ) {
                    mgr.expressionManager.stopAllExpressions();
                } else if (
                    typeof mgr.expressionManager.restore === "function"
                ) {
                    // 일부 버전에선 restore()가 초기화임
                    mgr.expressionManager.restore();
                }
            }
        }

        // 3. 파라미터 "진짜" 초기화 (모델 기본값으로 덮어쓰기)
        const core = internal.coreModel;
        if (core) {
            const paramCount = core.getParameterCount();
            for (let i = 0; i < paramCount; i++) {
                const defaultValue = core.getParameterDefaultValue(i);
                core.setParameterValueByIndex(i, defaultValue);
            }
        }

        // 4. 디버그 정보 초기화
        debugInfo.currentEmotion = "None";
        debugInfo.currentExpression = "None";
        debugInfo.lastMotion = "Reset (Hard)";
        debugInfo = debugInfo;

        // 5. Idle 모션 다시 재생 (약간의 딜레이)
        setTimeout(() => {
            const idleGroups = [
                "Idle",
                "idle",
                "Stand",
                "stand",
                "Wait",
                "wait",
            ];
            const defs = internal.motionManager?.definitions;
            if (defs) {
                for (const grp of idleGroups) {
                    if (defs[grp]) {
                        // 우선순위 3(Force)으로 강제 재생
                        currentModel.motion(grp, 0, 3);
                        console.log(`Debug: Triggering idle motion: ${grp}`);
                        break;
                    }
                }
            }
        }, 50);
    }

    export function triggerMotion(fileName: string) {
        if (
            !currentModel ||
            !currentModel.internalModel ||
            !currentModel.internalModel.motionManager
        )
            return;

        console.log(`Debug: Triggering motion by filename: ${fileName}`);
        const mgr = currentModel.internalModel.motionManager;
        const definitions = mgr.definitions;

        for (const [group, motions] of Object.entries(definitions)) {
            if (Array.isArray(motions)) {
                for (let i = 0; i < motions.length; i++) {
                    const m = motions[i];
                    // Check if file matches (handle paths)
                    if (
                        m.File &&
                        (m.File === fileName ||
                            m.File.endsWith("/" + fileName) ||
                            m.File.endsWith("\\" + fileName))
                    ) {
                        console.log(
                            `Debug: Found motion in group ${group} at index ${i}`,
                        );
                        resetToDefault();
                        currentModel.motion(group, i);
                        debugInfo.lastMotion = `${group} (${i}): ${fileName}`;
                        return;
                    }
                }
            }
        }
        console.warn(`Debug: Motion file not found: ${fileName}`);
    }

    let expressionLockUntil = 0; // Timestamp
    let pendingEmotion: string | null = null;
    let lockTimeout: any = null;

    export function triggerExpression(fileName: string) {
        if (!currentModel) return;

        console.log(
            `Debug: |triggerExpression| Found custom mapping for category '${fileName}'`,
        );
        currentModel.expression(fileName);
        debugInfo.currentExpression = fileName;

        // 🔥 Lock expression update for 1 second (1000ms)
        expressionLockUntil = Date.now() + 2000;
        console.log(`Debug: Expression Locked until ${expressionLockUntil}`);

        // Clear any existing pending stuff if we force a new expression
        if (lockTimeout) clearTimeout(lockTimeout);
        pendingEmotion = null;

        return;
    }

    export function setExpression(emotion: string) {
        if (!currentModel) return;

        // 🔥 Check Lock
        if (Date.now() < expressionLockUntil) {
            console.log(
                `Debug: setExpression Locked. queueing emotion: ${emotion}`,
            );
            pendingEmotion = emotion;

            if (!lockTimeout) {
                const wait = expressionLockUntil - Date.now();
                lockTimeout = setTimeout(() => {
                    lockTimeout = null;
                    if (pendingEmotion) {
                        console.log(
                            `Debug: Applying pending emotion: ${pendingEmotion}`,
                        );
                        setExpression(pendingEmotion);
                        pendingEmotion = null;
                    }
                }, wait);
            }
            return;
        }

        console.log(`Debug: |setExpression| called with: ${emotion}`);
        debugInfo.currentEmotion = emotion;

        const emotionLower = emotion.toLowerCase();
        let expressionIndex = 0;
        let category = "neutral";

        switch (emotionLower) {
            case "joy":
            case "happy":
            case "amusement":
            case "love":
            case "excitement":
            case "optimism":
            case "gratitude":
            case "pride":
            case "admiration":
            case "desire":
            case "approval":
            case "caring":
            case "relief":
            case "fun":
                expressionIndex = 1;
                category = "joy";
                break;
            case "anger":
            case "annoyance":
            case "disapproval":
            case "disgust":
                expressionIndex = 2;
                category = "anger";
                break;
            case "sadness":
            case "grief":
            case "disappointment":
            case "remorse":
            case "embarrassment":
            case "sorrow":
                expressionIndex = 3;
                category = "sorrow";
                break;
            case "surprise":
            case "realization":
            case "confusion":
            case "curiosity":
                expressionIndex = 4;
                category = "surprise";
                break;
            case "fear":
            case "nervousness":
                expressionIndex = 5;
                category = "fear";
                break;
            case "neutral":
                category = "neutral";
                expressionIndex = 0;
                break;
            default:
                console.log(`Debug: Unmapped emotion '${emotion}', ignoring.`);
                return;
        }

        // 1. Check Expression Map (Custom File)
        if (expressionMap && expressionMap[category]) {
            const mappedName = expressionMap[category];
            console.log(
                `Debug: Found custom mapping for category '${category}' -> '${mappedName}'`,
            );
            currentModel.expression(mappedName);
            debugInfo.currentExpression = mappedName;
            return;
        }

        return;
    }

    function draggable(model: any) {
        model.buttonMode = true;
        let startX = 0;
        let startY = 0;
        const dragThreshold = 10; // 10px threshold

        model.on("pointerdown", (e: any) => {
            startX = e.data.global.x;
            startY = e.data.global.y;
            // updateDragTarget will be called by pointermove
            if (autonomy) {
                updateDragTarget(e);
            }
        });

        model.on("pointermove", (e: any) => {
            if (!isDragging && startX !== 0 && startY !== 0) {
                const dx = Math.abs(e.data.global.x - startX);
                const dy = Math.abs(e.data.global.y - startY);
                if (dx > dragThreshold || dy > dragThreshold) {
                    isDragging = true;
                }
            }

            if (isDragging) {
                updateDragTarget(e);
            }
        });

        const stopDrag = () => {
            isDragging = false;
            startX = 0;
            startY = 0;
            if (autonomy) {
                autonomy.handleDrag(0, 0);
            }
        };
        model.on("pointerupoutside", stopDrag);
        model.on("pointerup", stopDrag);
    }

    function updateDragTarget(e: any) {
        if (!app || !autonomy) return;
        const x = e.data.global.x;
        const y = e.data.global.y;

        const centerX = app.screen.width / 2;
        const centerY = app.screen.height / 2;

        const clamp = (val: number, min: number, max: number) =>
            Math.min(Math.max(val, min), max);

        const newTargetX = clamp((x - centerX) / (app.screen.width / 3), -1, 1);
        const newTargetY = clamp(
            (y - centerY) / (app.screen.height / 3),
            -1,
            1,
        );
        autonomy.handleDrag(newTargetX, newTargetY);
    }

    // Motion Presets Configuration
    type MotionAxis = {
        intensity: number; // Amplitude
        speed: number; // Frequency
    };

    type MotionPreset = {
        bodyX?: MotionAxis;
        bodyY?: MotionAxis;
        bodyZ?: MotionAxis;
        headX?: MotionAxis;
        headY?: MotionAxis;
    };

    const MOTION_PRESETS: Record<string, MotionPreset> = {
        idle: {
            bodyX: { intensity: 2, speed: 5 },
            bodyY: { intensity: 5, speed: 5 },
            bodyZ: { intensity: 2, speed: 5 },
            headX: { intensity: 2, speed: 5 },
            headY: { intensity: 10, speed: 5 },
        },
        joy: {
            bodyX: { intensity: 5, speed: 5 },
            bodyY: { intensity: 10, speed: 5 },
            bodyZ: { intensity: 5, speed: 5 },
            headX: { intensity: 5, speed: 5 },
            headY: { intensity: 20, speed: 5 },
        },
        sadness: {
            bodyX: { intensity: 1, speed: 5 },
            bodyY: { intensity: 2, speed: 5 },
            bodyZ: { intensity: 0, speed: 5 },
            headX: { intensity: 1, speed: 5 },
            headY: { intensity: 5, speed: 5 },
        },
        nooo: {
            bodyX: { intensity: 0, speed: 5 },
            bodyY: { intensity: 0, speed: 5 },
            bodyZ: { intensity: 0, speed: 5 },
            headX: { intensity: 30, speed: 5 },
            headY: { intensity: 0, speed: 5 },
        },
    };

    let DestroyAudio = () => {};

    onMount(async () => {
        const wakeUpAudio = () => {
            SafeAudioManager.init();
            window.removeEventListener("click", wakeUpAudio);
            window.removeEventListener("touchstart", wakeUpAudio);
            console.log("👆 User interacted, Audio System initialized.");
        };

        window.addEventListener("click", wakeUpAudio);
        window.addEventListener("touchstart", wakeUpAudio);
        DestroyAudio = () => {
            window.removeEventListener("click", wakeUpAudio);
            window.removeEventListener("touchstart", wakeUpAudio);
        };

        setTimeout(async () => {
            try {
                await loadLive2DScripts();
                const PIXI = (window as any).PIXI;
                const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

                app = new PIXI.Application({
                    view: canvasElement,
                    autoStart: true,
                    backgroundAlpha: 0,
                    resizeTo: canvasElement.parentElement,
                    resolution: pixelRatio,
                    autoDensity: true,
                    antialias: false,
                });

                const model = await PIXI.live2d.Live2DModel.from(modelUrl, {
                    autoInteract: false,
                });

                model.interactive = true;
                model.buttonMode = true;

                draggable(model);

                try {
                    if (
                        PIXI.live2d.HitAreaFrames &&
                        typeof PIXI.live2d.HitAreaFrames === "function"
                    ) {
                        const hitAreaFrames = new PIXI.live2d.HitAreaFrames();
                        hitAreaFrames.visible = showDebug;
                        model.addChild(hitAreaFrames);
                        (model as any).hitAreaFrames = hitAreaFrames; // Store ref
                        console.log(
                            "Debug: HitAreaFrames added. Visible:",
                            hitAreaFrames.visible,
                        );
                    } else {
                        console.warn(
                            "PIXI.live2d.HitAreaFrames not available. Debug visuals disabled.",
                        );
                    }
                } catch (e) {
                    console.error("Failed to add HitAreaFrames:", e);
                }

                console.log("Debug: Inspecting Model Hit Areas...");
                const hitAreaKeys = model.hitAreas
                    ? Object.keys(model.hitAreas)
                    : [];
                console.log("Debug: Detected Hit Area Keys:", hitAreaKeys);

                if (hitAreaKeys.length === 0) {
                    console.warn(
                        "⚠️ This model seems to have NO Hit Areas defined in its settings.",
                    );
                    debugInfo.error =
                        "No Hit Areas detected in this model! (Check .model3.json)";
                } else {
                    debugInfo.fileMotions = hitAreaKeys;
                }

                model.scale.set(1);
                const bounds = model.getBounds();
                const paddingFactor = 1.3;
                const scaleX =
                    (app.screen.width * paddingFactor) / bounds.width;
                const scaleY =
                    (app.screen.height * paddingFactor) / bounds.height;
                const autoScale = Math.min(scaleX, scaleY);
                const finalScale = x === 0 && y === 0 ? autoScale : scale;
                model.scale.set(finalScale);

                model.on("pointertap", (e: any) => {
                    const point = e.data.global;
                    model.tap(point.x, point.y);
                });

                model.x = x;
                model.y = y;

                if (x === 0 && y === 0) {
                    model.anchor.set(0.5, 0.5);
                    model.x = app.screen.width / 2;
                    model.y = app.screen.height / 2 + 150;
                }

                app.stage.addChild(model);
                currentModel = model;

                // Initialize Autonomy
                autonomy = new Live2DAutonomy(model, app);
                autonomy.start();

                //startBouncing();
                //startNeuroMotion();

                isLoaded = true;
                debugInfo.modelUrl = modelUrl;

                console.log("Debug: Model loaded", model);
                console.log("Debug: Internal Model", model.internalModel);
                console.log("Debug: Settings", model.internalModel?.settings);

                // Check Parameters
                if (model.internalModel?.coreModel?._parameterIds) {
                    console.log(
                        "Debug: Available Parameter IDs:",
                        model.internalModel.coreModel._parameterIds,
                    );
                }

                // Discovery
                const foundExpressions = new Set<string>();
                if (model.expressions) {
                    console.log(
                        "Debug: model.expressions found:",
                        model.expressions,
                    );
                    model.expressions.forEach((e: string) =>
                        foundExpressions.add(e),
                    );
                }

                try {
                    const settings = model.internalModel?.settings;
                    if (settings) {
                        // Check specifically for FileReferences (Cubism 3+)
                        if (settings.FileReferences?.Expressions) {
                            console.log(
                                "Debug: Found FileReferences.Expressions",
                                settings.FileReferences.Expressions,
                            );
                            const exprs = settings.FileReferences.Expressions;
                            if (Array.isArray(exprs)) {
                                exprs.forEach((e: any) => {
                                    if (e.Name) foundExpressions.add(e.Name);
                                    else if (e.File)
                                        foundExpressions.add(
                                            e.File.split("/")
                                                .pop()
                                                .replace(".exp3.json", ""),
                                        );
                                });
                            }
                        }
                        // Fallback check for other structures
                        else if (settings.expressions) {
                            console.log(
                                "Debug: Found settings.expressions",
                                settings.expressions,
                            );
                            settings.expressions.forEach((e: any) => {
                                if (e.name) foundExpressions.add(e.name);
                                else if (e.Name) foundExpressions.add(e.Name);
                            });
                        }
                    }
                } catch (e) {
                    console.error("Debug: Expression discovery error", e);
                }
                debugInfo.availableExpressions = Array.from(foundExpressions);
                console.log(
                    "Debug: Final available expressions:",
                    debugInfo.availableExpressions,
                );
                debugInfo.availableExpressions = Array.from(foundExpressions);

                const foundMotionGroups = new Set<string>();
                if (model.internalModel?.motionManager?.definitions) {
                    Object.keys(
                        model.internalModel.motionManager.definitions,
                    ).forEach((k) => foundMotionGroups.add(k));
                }
                debugInfo.availableMotionGroups = Array.from(foundMotionGroups);
                debugInfo = debugInfo;

                //idleInterval = setInterval(() => {
                //    if (!currentModel?.internalModel?.motionManager) return;
                //    if (Math.random() > 0.5) {
                //        const motionManager =
                //            currentModel.internalModel.motionManager;
                //        if (motionManager.definitions["Idle"]) {
                //            currentModel.motion("Idle");
                //            debugInfo.lastMotion = "Idle (Random)";
                //            debugInfo = debugInfo;
                //        }
                //    }
                //}, 8000);

                window.addEventListener("resize", onResize);
            } catch (e: any) {
                console.error("Failed to initialize Live2D:", e);
                debugInfo.error = e.message || e.toString();
                isLoaded = true;
            }
        }, 100);
    });

    function onResize() {
        if (app && currentModel && x === 0 && y === 0) {
            const bounds = currentModel.getBounds();
            const modelWidth = bounds.width / currentModel.scale.x;
            const modelHeight = bounds.height / currentModel.scale.y;
            const paddingFactor = 1.3;
            const scaleX = (app.screen.width * paddingFactor) / modelWidth;
            const scaleY = (app.screen.height * paddingFactor) / modelHeight;
            const autoScale = Math.min(scaleX, scaleY);
            currentModel.scale.set(autoScale);
            currentModel.x = app.screen.width / 2;
            currentModel.y = app.screen.height / 2 + 150;
        }
    }

    onDestroy(() => {
        //if (idleInterval) clearInterval(idleInterval);
        window.removeEventListener("resize", onResize);

        //audio
        DestroyAudio();
        //stopNeuroMotion();

        if (currentModel)
            try {
                currentModel.destroy();
            } catch (e) {}
        if (app)
            try {
                app.destroy(true, {
                    children: true,
                    texture: true,
                    baseTexture: true,
                });
            } catch (e) {}
    });
</script>

<div class="live2d-container">
    {#if backgroundImage}
        <img
            src={backgroundImage}
            alt="background"
            class="live2d-bg"
            draggable="false"
        />
    {/if}
    <canvas bind:this={canvasElement} class="live2d-canvas"></canvas>

    {#if !isLoaded}
        <div class="model-loader">
            <div class="loader-content">
                <Icon
                    icon="line-md:loading-twotone-loop"
                    width="64"
                    height="64"
                />
                <span class="loading-text">Live2D 모델 로딩 중...</span>
                <small class="loading-hint"
                    >잠시 화면이 멈출 수 있습니다 (정상 동작)</small
                >
            </div>
        </div>
    {/if}

    {#if showDebug}
        <div class="debug-panel">
            <h3>🎭 Live2D Debug</h3>

            <div class="controls-row">
                <button class="stop-btn reset-btn" on:click={resetToDefault}
                    >🔄 Reset Model</button
                >
            </div>

            <div class="info-item">
                <strong>Model:</strong>
                <span class="break-all"
                    >{debugInfo.modelUrl.split("/").pop()}</span
                >
            </div>

            <div class="info-item">
                <strong>Emotion Input:</strong>
                <span class="highlight">{debugInfo.currentEmotion}</span>
            </div>

            <div class="info-item">
                <strong>Expression:</strong>
                <span class="highlight">{debugInfo.currentExpression}</span>
            </div>

            <div class="info-item">
                <strong>Last Motion:</strong>
                <span class="highlight">{debugInfo.lastMotion}</span>
            </div>

            <div class="info-section">
                <strong
                    >Expressions ({debugInfo.availableExpressions
                        .length}):</strong
                >
                <div class="scroll-list">
                    {#each debugInfo.availableExpressions as expr}
                        <button
                            class="list-item clickable"
                            on:click={() => {
                                console.log(
                                    "Debug: Triggering expression",
                                    expr,
                                );
                                currentModel.expression(expr);
                                debugInfo.currentExpression = expr;
                            }}
                        >
                            {expr}
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Manual Parameter Control -->
            <div class="info-section">
                <label
                    style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px; color: #fab;"
                >
                    <input
                        type="checkbox"
                        on:change={(e) => {
                            if (autonomy) {
                                if (e.currentTarget.checked) autonomy.start();
                                else autonomy.stop();
                            }
                        }}
                        checked={true}
                    />
                    Enable Autonomy (Uncheck to test manually)
                </label>

                <strong>🔧 Manual Parameter Test:</strong>
                <div style="display: flex; gap: 5px; margin-top: 5px;">
                    <input
                        type="text"
                        placeholder="Param ID (e.g. ParamEyeLOpen)"
                        style="flex: 2; padding: 4px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff; font-size: 12px;"
                        bind:value={debugInfo.manualParamId}
                    />
                    <input
                        type="number"
                        placeholder="Val"
                        step="0.1"
                        style="flex: 1; padding: 4px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff; font-size: 12px;"
                        bind:value={debugInfo.manualParamValue}
                    />
                    <button
                        style="padding: 4px 8px; border-radius: 4px; background: #4caf50; color: white; border: none; cursor: pointer; font-size: 12px;"
                        on:click={() => {
                            if (
                                currentModel &&
                                currentModel.internalModel &&
                                debugInfo.manualParamId
                            ) {
                                try {
                                    // Try Set Parameter
                                    currentModel.internalModel.coreModel.setParameterValueById(
                                        debugInfo.manualParamId,
                                        Number(debugInfo.manualParamValue),
                                    );
                                    console.log(
                                        `✅ Set ${debugInfo.manualParamId} to ${debugInfo.manualParamValue}`,
                                    );

                                    // Force update to see immediate effect
                                    currentModel.internalModel.coreModel.update();
                                } catch (e) {
                                    console.error(
                                        "❌ Failed to set parameter:",
                                        e,
                                    );
                                    alert("Error setting parameter. Check ID.");
                                }
                            }
                        }}
                    >
                        Set
                    </button>
                </div>
            </div>

            <div class="info-section">
                <strong>Motion Presets:</strong>
                <!-- <div
                    class="presets-row"
                    style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px;"
                >
                    {#each Object.keys(MOTION_PRESETS) as preset}
                        <button
                            class="list-item clickable"
                            style="flex: 1; text-align: center; border: 1px solid #0f0; border-radius: 4px; {currentPresetName ===
                            preset
                                ? 'background: rgba(0, 255, 0, 0.4); color: white;'
                                : ''}"
                            on:click={() => startBouncing(preset)}
                        >
                            {preset}
                        </button>
                    {/each}
                </div> -->
            </div>

            <div class="info-section">
                <strong>Motion Groups:</strong>
                <div class="scroll-list">
                    {#each debugInfo.availableMotionGroups as group}
                        <div class="group-container">
                            <!-- Group Header / Main Trigger -->
                            <button
                                class="group-header clickable"
                                title="Play Random {group} Motion"
                                on:click={() => {
                                    console.log(
                                        "Debug: Triggering motion group",
                                        group,
                                    );
                                    currentModel.motion(group);
                                    debugInfo.lastMotion = `${group} (Group Trigger)`;
                                }}
                            >
                                <span class="group-name">{group}</span>
                                <span class="play-icon">▶</span>
                            </button>

                            <!-- Individual File List -->
                            {#if currentModel && currentModel.internalModel && currentModel.internalModel.motionManager && currentModel.internalModel.motionManager.definitions[group]}
                                {#each currentModel.internalModel.motionManager.definitions[group] as def, i}
                                    <button
                                        class="list-item sub-item clickable"
                                        on:click={() => {
                                            console.log(
                                                `Debug: Triggering ${group} index ${i}`,
                                                def.File,
                                            );
                                            currentModel.motion(group, i);
                                            debugInfo.lastMotion = `${group} (${i}): ${def.File}`;
                                        }}
                                    >
                                        <span class="motion-index">[{i}]</span>
                                        <span class="motion-name"
                                            >{def.File
                                                ? def.File.split("/").pop()
                                                : "Unknown"}</span
                                        >
                                    </button>
                                {/each}
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>

            <!-- Found Files Section -->
            {#if debugInfo.fileMotions && debugInfo.fileMotions.length > 0}
                <div class="info-section">
                    <strong
                        >📂 Found Files ({debugInfo.fileMotions
                            .length}):</strong
                    >
                    <div class="scroll-list">
                        {#each debugInfo.fileMotions as file, i}
                            <button
                                class="list-item clickable"
                                on:click={() => {
                                    console.log("Debug: Playing file", file);
                                    // Play from the __debug__ group we created
                                    currentModel.motion("__debug__", i);
                                    debugInfo.lastMotion = file;
                                }}
                            >
                                {file}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    {/if}

    <!-- <button
        class="test-tts-btn"
        style="position: absolute; top: 50px; right: 70px; z-index: 9999; pointer-events: auto; padding: 8px 16px; background: #ff0055; color: white; border-radius: 20px; border: 2px solid white; font-weight: bold; box-shadow: 0 4px 10px rgba(0,0,0,0.3); cursor: pointer; transition: transform 0.1s;"
        on:click={() => speak("/TTS_Sample.mp3")}
        on:mousedown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
        on:mouseup={(e) => (e.currentTarget.style.transform = "scale(1)")}
        on:mouseleave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
        🗣️ Test TTS
    </button> -->
</div>

<style>
    .live2d-container {
        position: relative;
        width: 100%;
        height: 100%;
        pointer-events: none; /* Let clicks pass through container */
        background-color: #000; /* Fallback */
    }

    .live2d-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 0;
        opacity: 0.6; /* Slight dimming for better character visibility */
    }

    .live2d-canvas {
        position: absolute; /* Changed to absolute to stack */
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: block;
        z-index: 1; /* Above background */
        pointer-events: auto; /* Re-enable canvas interaction if model needs it, or 'none' if strictly background */
    }

    .model-loader {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        z-index: 1000;
        pointer-events: none;
        /* GPU acceleration */
        transform: translateZ(0);
        will-change: opacity;
    }

    .loader-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        color: white;
        /* GPU acceleration */
        transform: translateZ(0);
        backface-visibility: hidden;
    }

    .loading-text {
        font-size: 1.2rem;
        font-weight: 500;
        text-align: center;
    }

    .loading-hint {
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.875rem;
        text-align: center;
        max-width: 300px;
        line-height: 1.4;
    }

    .debug-panel {
        position: fixed;
        bottom: 130px;
        right: 20px;
        width: 320px;
        max-height: 80%;
        background: rgba(0, 0, 0, 0.95); /* Slightly more opaque */
        color: #0f0;
        padding: 15px;
        border-radius: 8px;
        border: 2px solid #0f0;
        font-family: "Courier New", monospace;
        font-size: 11px;
        z-index: 99999 !important; /* Force on top */
        overflow-y: auto;
        pointer-events: auto !important; /* Force clickable */
        box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
        touch-action: pan-y; /* Improve scrolling on touch devices */
    }

    .debug-panel h3 {
        margin: 0 0 10px 0;
        color: #0f0;
        border-bottom: 1px solid #0f0;
        padding-bottom: 5px;
        font-size: 14px;
    }

    .info-item {
        margin-bottom: 8px;
        line-height: 1.4;
    }

    .info-item strong {
        color: #0ff;
    }

    .highlight {
        color: #ff0;
        font-weight: bold;
    }

    .break-all {
        word-break: break-all;
        color: #ccc;
    }

    .info-section {
        margin-top: 12px;
        border-top: 1px solid #333;
        padding-top: 8px;
    }

    .info-section strong {
        color: #0ff;
    }

    .scroll-list {
        max-height: 200px; /* Increased height */
        overflow-y: auto;
        background: rgba(0, 255, 0, 0.05);
        padding: 5px;
        margin-top: 5px;
        border-radius: 4px;
        border: 1px solid #333;
        pointer-events: auto; /* Explicitly enable pointer events */
    }

    .list-item {
        display: block;
        width: 100%;
        text-align: left;
        background: none;
        border: none;
        padding: 3px 5px;
        border-bottom: 1px solid rgba(0, 255, 0, 0.1);
        color: #0f0;
        font-family: inherit;
        font-size: inherit;
        cursor: default;
    }

    .list-item.clickable {
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .list-item.clickable:hover {
        background-color: rgba(0, 255, 0, 0.2);
        color: #fff;
    }

    .list-item:last-child {
        border-bottom: none;
    }

    /* Custom scrollbar */
    .scroll-list::-webkit-scrollbar {
        width: 8px;
    }

    .scroll-list::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.3);
    }

    .scroll-list::-webkit-scrollbar-thumb {
        background: rgba(0, 255, 0, 0.5);
        border-radius: 4px;
    }

    .group-container {
        margin-bottom: 5px;
        border-bottom: 1px dashed rgba(0, 255, 0, 0.3);
    }

    .group-header {
        font-weight: bold;
        color: #0ff;
        padding: 4px 8px; /* Larger click area */
        background: rgba(0, 255, 0, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: none;
        width: 100%;
        text-align: left;
        cursor: pointer;
        transition: background 0.2s;
    }

    .group-header:hover {
        background: rgba(0, 255, 0, 0.3);
        color: #fff;
    }

    .play-icon {
        font-size: 0.8em;
        opacity: 0.7;
    }

    .list-item.sub-item {
        padding-left: 15px;
        font-size: 0.9em;
        display: flex;
        gap: 5px;
    }

    .motion-index {
        color: #aaa;
        min-width: 20px;
    }

    .motion-name {
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .controls-row {
        margin-bottom: 10px;
        display: flex;
        justify-content: center;
        gap: 10px; /* Add gap */
    }

    .stop-btn {
        background: rgba(255, 0, 0, 0.2);
        border: 1px solid #f00;
        color: #f00;
        padding: 5px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
        flex: 1; /* Match width */
    }

    .reset-btn {
        background: rgba(0, 255, 255, 0.2); /* Cyan background */
        border: 1px solid #0ff;
        color: #0ff;
    }

    .reset-btn:hover {
        background: rgba(0, 255, 255, 0.4);
        color: #fff;
    }

    .stop-btn:hover {
        background: rgba(255, 0, 0, 0.4);
        color: #fff;
    }
</style>

<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { loadLive2DScripts } from "$lib/utils/live2dLoader";
    import Icon from "@iconify/svelte";

    export let modelUrl: string;
    export let scale: number = 0.3;
    export let x: number = 0;
    export let y: number = 0;
    export let expressionMap: Record<string, string> = {};
    export let hitMotionMap: Record<string, string> = {};

    let canvasElement: HTMLCanvasElement;
    let app: any;
    let currentModel: any | null = null;
    let isLoaded = false;
    let idleInterval: any;

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
    };

    export async function speak(audioUrl: string) {
        if (!currentModel) {
            console.warn("Live2D model not ready for speaking.");
            return;
        }

        try {
            if (currentModel.stopSpeaking) {
                console.log("🛑 Stopping previous Live2D audio");
                currentModel.stopSpeaking();
            }
            resetToDefault();
            await currentModel.speak(audioUrl);
        } catch (e) {
            console.error("Live2D speak failed:", e);
        }
    }

    export function toggleDebug() {
        showDebug = !showDebug;
        if (currentModel && (currentModel as any).hitAreaFrames) {
            (currentModel as any).hitAreaFrames.visible = showDebug;
        }
    }
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
                        currentModel.motion(group, i);
                        debugInfo.lastMotion = `${group} (${i}): ${fileName}`;
                        return;
                    }
                }
            }
        }
        console.warn(`Debug: Motion file not found: ${fileName}`);
    }

    export function setExpression(emotion: string) {
        if (!currentModel) return;

        console.log(`Debug: setExpression called with: ${emotion}`);
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

        // 2. Fallback to Index / Default system
        console.log(
            `Debug: No custom mapping for '${category}', using index ${expressionIndex}`,
        );

        try {
            const definitions =
                currentModel.internalModel?.motionManager?.expressionManager
                    ?.definitions;
            if (definitions && definitions.length > expressionIndex) {
                const name = definitions[expressionIndex].Name;
                currentModel.expression(name);
                debugInfo.currentExpression = `${name} (Index: ${expressionIndex})`;
            } else {
                console.log(
                    `Debug: No expression definition found for index ${expressionIndex}, skipping.`,
                );
            }
        } catch (e) {
            console.warn("Error setting expression:", e);
            debugInfo.currentExpression = "Error";
        }
    }

    onMount(async () => {
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

                // Add Hit Area Frames for Debug
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

                // Inspect Hit Data
                console.log("Debug: Inspecting Model Hit Areas...");
                // @ts-ignore
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
                    debugInfo.fileMotions = hitAreaKeys; // Temporary re-use to show in debug panel if needed
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

                // Hit Interaction
                // Since autoInteract is false, we manually handle tap to trigger hit events
                model.on("pointertap", (e: any) => {
                    const point = e.data.global;
                    model.tap(point.x, point.y);
                });

                model.on("hit", (hitAreas: string[]) => {
                    console.log("Hit detected:", hitAreas);
                    hitAreas.forEach((area) => {
                        console.log(`Checking hit area: ${area}`);

                        // 1. Custom Map
                        if (hitMotionMap[area]) {
                            const motionFile = hitMotionMap[area];
                            console.log(
                                `Triggering mapped motion for ${area}: ${motionFile}`,
                            );
                            // We need to find the group/index for this file or just play by name if supported?
                            // Live2DModel.motion() usually takes (group, index, priority).
                            // But if we have the full filename, we might need a helper, OR better:
                            // The user selects a "Motion Group" usually, not a file path directly in the UI?
                            // Actually `availableMotions` are file paths.
                            // `model.motion` expects (group, index).
                            // Let's try to match the file path to a group/index.

                            // Simple approach: Assume the value IS the group name if defined in model,
                            // OR try to find which group/index corresponds to this file.

                            // For now, let's assume the user mapped it to a Valid Group Name or we search effectively.
                            // But usually `hit` triggers a logical motion like "TapBody".

                            // Let's try to find the group that matches the file.
                            // ... (Logic to find group by filename if needed, or just expecting a group name)
                            // Re-reading implementation plan: "Dropdown to select a Motion".
                            // If they select a file, we need to reverse-lookup the group/index.

                            // Let's implement a smart finder.
                            let found = false;
                            if (model.internalModel.motionManager.definitions) {
                                for (const [grp, motions] of Object.entries(
                                    model.internalModel.motionManager
                                        .definitions,
                                )) {
                                    // @ts-ignore
                                    motions.forEach((m, i) => {
                                        if (
                                            m.File === motionFile ||
                                            (m.File &&
                                                m.File.endsWith(motionFile))
                                        ) {
                                            console.log(
                                                `Found motion ${motionFile} in group ${grp} at index ${i}`,
                                            );
                                            model.motion(grp, i, 3); // Priority 3 = FORCE
                                            found = true;
                                        }
                                    });
                                }
                            }
                            if (!found) {
                                // Maybe it's just a group name?
                                model.motion(motionFile, undefined, 3);
                            }
                        } else {
                            // 2. Default Fallback: Tap + Area (e.g. TapBody)
                            const defaultMotion = "Tap" + area;
                            console.log(
                                `Trying default hit motion: ${defaultMotion}`,
                            );
                            model
                                .motion(defaultMotion, undefined, 3)
                                .catch(() => {});

                            // Lowercase fallback
                            const lower = "tap_" + area.toLowerCase();
                            model.motion(lower, undefined, 3).catch(() => {});
                        }
                    });
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
                isLoaded = true;
                debugInfo.modelUrl = modelUrl;

                console.log("Debug: Model loaded", model);
                console.log("Debug: Internal Model", model.internalModel);
                console.log("Debug: Settings", model.internalModel?.settings);

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

                idleInterval = setInterval(() => {
                    if (!currentModel?.internalModel?.motionManager) return;
                    if (Math.random() > 0.5) {
                        const motionManager =
                            currentModel.internalModel.motionManager;
                        if (motionManager.definitions["Idle"]) {
                            currentModel.motion("Idle");
                            debugInfo.lastMotion = "Idle (Random)";
                            debugInfo = debugInfo;
                        }
                    }
                }, 8000);

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
        if (idleInterval) clearInterval(idleInterval);
        window.removeEventListener("resize", onResize);
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
</div>

<style>
    .live2d-container {
        position: relative;
        width: 100%;
        height: 100%;
        pointer-events: none; /* Let clicks pass through container */
    }

    .live2d-canvas {
        width: 100%;
        height: 100%;
        display: block;
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

    .error-msg {
        color: #ff4444;
        border: 1px solid #ff4444;
        padding: 5px;
        background: rgba(255, 0, 0, 0.1);
        border-radius: 4px;
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

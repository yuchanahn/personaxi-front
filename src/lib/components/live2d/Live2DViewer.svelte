<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher, tick } from "svelte";
    import { loadLive2DScripts } from "$lib/utils/live2dLoader";
    import Icon from "@iconify/svelte";
    import { SafeAudioManager } from "$lib/utils/safeAudioManager";
    import { Live2DAutonomy } from "$lib/utils/live2d/Live2DAutonomy";
    import Live2DDebugPanel from "$lib/components/live2d/Live2DDebugPanel.svelte";

    const dispatch = createEventDispatcher();

    export let modelUrl: string;
    export let scale: number = 0.3;
    export let x: number = 0;
    export let y: number = 0;
    export let expressionMap: Record<string, string> = {};
    export let hitMotionMap: Record<string, string> = {};
    export let backgroundImage: string | null = null;
    export let closeupScale: number = 2.0;
    export let closeupOffset: number = 0.2;
    export let startVoiceUrl: string | undefined = undefined;
    export let persona: any = null;
    export let autonomy: Live2DAutonomy | null = null;

    export let error_showSpeech: boolean = false;

    let canvasElement: HTMLCanvasElement;
    let app: any;
    let currentModel: any | null = null;
    let isLoaded = false;
    let hasPlayedStartVoice = false;

    $: if (isLoaded && currentModel && !hasPlayedStartVoice) {
        hasPlayedStartVoice = true;
        if (startVoiceUrl) {
            console.log("[Live2D] Autoplay Start Voice:", startVoiceUrl);
            setTimeout(() => {
                speak(startVoiceUrl as string);
            }, 500);
        } else {
            setTimeout(() => {
                autonomy?.setEmotion("SLEEP");
            }, 500);
        }
    }

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
    let currentAutonomyEmotion = "CALM"; // ✨ Sleep Effect State
    const DISABLE_ALL_MOTIONS = true;
    let originalMotionDefinitions: Record<string, any[]> | null = null;
    let originalMotionUpdate: ((...args: any[]) => any) | null = null;
    const noMotionUpdate = () => true;
    let motionRelockTimer: any = null;

    function disableAllMotions(model: any) {
        if (!DISABLE_ALL_MOTIONS) return;
        const mgr = model?.internalModel?.motionManager;
        if (!mgr) return;

        if (!originalMotionDefinitions && mgr.definitions) {
            // Keep a snapshot for possible future manual-only restore.
            originalMotionDefinitions = { ...mgr.definitions };
        }
        if (!originalMotionUpdate && typeof mgr.update === "function") {
            originalMotionUpdate = mgr.update.bind(mgr);
        }

        if (typeof mgr.stopAllMotions === "function") {
            mgr.stopAllMotions();
        } else if (typeof mgr.stopAll === "function") {
            mgr.stopAll();
        } else if (typeof mgr.stop === "function") {
            mgr.stop();
        }

        mgr.update = noMotionUpdate;

        mgr.definitions = {};
        if (Array.isArray(mgr.queue)) {
            mgr.queue = [];
        }
        console.log("🔒 All Live2D motions disabled (definitions cleared)");
    }

    function getMotionDefinitionsForDebug(): Record<string, any[]> | null {
        if (DISABLE_ALL_MOTIONS && originalMotionDefinitions) {
            return originalMotionDefinitions;
        }
        return currentModel?.internalModel?.motionManager?.definitions ?? null;
    }

    function isLocalTestHost(): boolean {
        if (typeof window === "undefined") return false;
        const host = window.location.hostname;
        return host === "localhost" || host === "127.0.0.1" || host === "::1";
    }

    function relockMotionsWithoutStop(model: any) {
        if (!DISABLE_ALL_MOTIONS) return;
        const mgr = model?.internalModel?.motionManager;
        if (!mgr) return;
        mgr.update = noMotionUpdate;
        mgr.definitions = {};
        console.log("🔒 Live2D motions re-locked (definitions only)");
    }

    function playMotionTemporarilyEnabled(group: string, index?: number) {
        if (!currentModel?.internalModel?.motionManager) return;
        const mgr = currentModel.internalModel.motionManager;

        if (!DISABLE_ALL_MOTIONS) {
            return index === undefined
                ? currentModel.motion(group)
                : currentModel.motion(group, index, 3);
        }

        if (originalMotionDefinitions) {
            mgr.definitions = originalMotionDefinitions;
        }
        if (originalMotionUpdate) {
            mgr.update = originalMotionUpdate;
        }

        let relocked = false;
        const relock = () => {
            if (relocked || !currentModel) return;
            relocked = true;
            if (motionRelockTimer) {
                clearTimeout(motionRelockTimer);
                motionRelockTimer = null;
            }
            relockMotionsWithoutStop(currentModel);
        };

        const handleMotionFinish = () => {
            console.log("🎬 motionFinish received");
            relock();
        };

        if (typeof mgr.once === "function") {
            mgr.once("motionFinish", handleMotionFinish);
        } else if (typeof mgr.on === "function") {
            mgr.on("motionFinish", handleMotionFinish);
        }

        const result =
            index === undefined
                ? currentModel.motion(group)
                : currentModel.motion(group, index, 3);

        motionRelockTimer = setTimeout(() => {
            console.log("⏱️ motionFinish fallback timeout");
            relock();
        }, 12000);

        if (result && typeof result.then === "function") {
            result.then((ok: boolean) => {
                if (ok === false) {
                    console.log("❌ motion start failed");
                    relock();
                }
            }).catch(() => {
                relock();
            });
        }

        return result;
    }

    $: if (autonomy) {
        autonomy.onEmotionChange = (emo) => {
            currentAutonomyEmotion = emo;
        };
    }

    export async function speak(audioUrl: string, onFinish?: () => void) {
        if (!currentModel) return;

        error_showSpeech = false;

        if (autonomy) autonomy.setSpeaking(true);

        await SafeAudioManager.speak(currentModel, audioUrl, {
            onFinish: () => {
                if (autonomy) autonomy.setSpeaking(false);
                if (onFinish) onFinish();
            },
            onError: (e) => {
                console.error("### TTS Error", e);
                if (autonomy) autonomy.setSpeaking(false);
                error_showSpeech = true;
            },
        });
    }

    export function toggleDebug() {
        showDebug = !showDebug;
        if (currentModel && (currentModel as any).hitAreaFrames) {
            (currentModel as any).hitAreaFrames.visible = showDebug;
        }
    }

    function handleDebugExpressionSelect(expr: string) {
        if (!currentModel) return;
        console.log("Debug: Triggering expression", expr);
        currentModel.expression(expr);
        debugInfo.currentExpression = expr;
    }

    function handleDebugSetManualParam() {
        if (!currentModel || !currentModel.internalModel || !debugInfo.manualParamId) {
            return;
        }
        try {
            currentModel.internalModel.coreModel.setParameterValueById(
                debugInfo.manualParamId,
                Number(debugInfo.manualParamValue),
            );
            console.log(
                `✅ Set ${debugInfo.manualParamId} to ${debugInfo.manualParamValue}`,
            );
            currentModel.internalModel.coreModel.update();
        } catch (e) {
            console.error("❌ Failed to set parameter:", e);
            alert("Error setting parameter. Check ID.");
        }
    }

    function handleDebugSetEmotion(emotion: string) {
        if (!autonomy) return;
        // @ts-ignore
        autonomy.setEmotion(emotion);
        console.log("Set Emotion:", emotion);
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

        // 5. Do not auto-play default idle motion after reset.
        // Keep model state neutral until an explicit motion is triggered.
    }

    export function triggerMotion(fileName: string) {
        if (
            !currentModel ||
            !currentModel.internalModel ||
            !currentModel.internalModel.motionManager
        )
            return;

        console.log(`[1] Debug: Triggering motion by filename: ${fileName}`);
        const mgr = currentModel.internalModel.motionManager;
        const definitions = getMotionDefinitionsForDebug() ?? mgr.definitions;

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
                            `[2] Debug: Found motion in group ${group} at index ${i}`,
                        );
                        resetToDefault();
                        playMotionTemporarilyEnabled(group, i);
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

    // ✨ NEW: Expose Autonomy Controls
    export function playGesture(gesture: string) {
        if (autonomy) {
            autonomy.playGesture(gesture as any);
        }
    }

    export function setSensitivity(val: number) {
        if (autonomy) {
            autonomy.setSensitivity(val);
        }
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
        let category = "neutral";
        type EmotionType =
            | "ELATED"
            | "GENTLE"
            | "STERN"
            | "DEPRESSED"
            | "TENSE"
            | "ASTONISHED"
            | "CALM";
        let emotionType: EmotionType;

        interface EmotionInfo {
            cat: string;
            type: EmotionType;
        }
        const emotionMap: Record<string, EmotionInfo> = {
            // [joy] 따뜻한 긍정
            joy: { cat: "joy", type: "GENTLE" },
            happy: { cat: "joy", type: "GENTLE" },
            love: { cat: "joy", type: "GENTLE" },
            gratitude: { cat: "joy", type: "GENTLE" },
            relief: { cat: "joy", type: "GENTLE" },
            pride: { cat: "joy", type: "GENTLE" },

            // [amuse] 에너지가 높은 즐거움
            amusement: { cat: "amuse", type: "ELATED" },
            excitement: { cat: "amuse", type: "ELATED" },
            fun: { cat: "amuse", type: "ELATED" },
            curiosity: { cat: "amuse", type: "ELATED" },

            // [anger] 날선 부정
            anger: { cat: "anger", type: "STERN" },
            annoyance: { cat: "anger", type: "STERN" },
            disapproval: { cat: "anger", type: "STERN" },
            disgust: { cat: "anger", type: "STERN" },

            // [sorrow] 가라앉은 부정
            sadness: { cat: "sorrow", type: "DEPRESSED" },
            grief: { cat: "sorrow", type: "DEPRESSED" },
            disappointment: { cat: "sorrow", type: "DEPRESSED" },
            remorse: { cat: "sorrow", type: "DEPRESSED" },

            // [unease] 불안과 위축
            fear: { cat: "unease", type: "TENSE" },
            nervousness: { cat: "unease", type: "TENSE" },
            embarrassment: { cat: "unease", type: "TENSE" },

            // [surprise] 예기치 못한 인지
            surprise: { cat: "surprise", type: "ASTONISHED" },
            realization: { cat: "surprise", type: "ASTONISHED" },
            confusion: { cat: "surprise", type: "ASTONISHED" },

            // [neutral] 평온함
            neutral: { cat: "neutral", type: "CALM" },
            approval: { cat: "neutral", type: "CALM" },
            caring: { cat: "neutral", type: "CALM" },
        };

        const mapped = emotionMap[emotionLower];

        if (!mapped) {
            console.log(`Debug: Unmapped emotion '${emotionLower}', ignoring.`);
            return;
        }

        category = mapped.cat;
        emotionType = mapped.type;

        if (expressionMap) {
            let targetExpression = "";

            autonomy?.setEmotion(emotionType);

            if (expressionMap[emotionType]) {
                targetExpression = expressionMap[emotionType];
            } else if (expressionMap[category]) {
                targetExpression = expressionMap[category];
            }

            if (targetExpression) {
                console.log(
                    `Debug: Found custom mapping for '${emotionType}'/'${category}' -> '${targetExpression}'`,
                );
                currentModel.expression(targetExpression);
                debugInfo.currentExpression = targetExpression;
                return;
            }
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
            showHandCursor = true;
            cursorPos = { x: e.data.global.x, y: e.data.global.y };
            if (autonomy) {
                updateDragTarget(e);
            }
        });

        model.on("pointermove", (e: any) => {
            if (showHandCursor) {
                cursorPos = { x: e.data.global.x, y: e.data.global.y };
            }
            if (!isDragging && startX !== 0 && startY !== 0) {
                const dx = Math.abs(e.data.global.x - startX);
                const dy = Math.abs(e.data.global.y - startY);
                if (dx > dragThreshold || dy > dragThreshold) {
                    isDragging = true;

                    dispatch("interaction", {
                        action: "touch_start",
                        duration: "start",
                        state: "contact",
                        is_ongoing: true,
                    });
                    autonomy?.WakeUp();
                }
            }

            if (isDragging) {
                updateDragTarget(e);
            }
        });

        const stopDrag = () => {
            if (isDragging) {
                dispatch("interactionEnd");
            }
            isDragging = false;
            showHandCursor = false;
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

    let DestroyAudio = () => {};

    onMount(async () => {
        showDebug = isLocalTestHost();

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

                // Import dynamically since this is client-side code
                const cryptoModule = await import("$lib/utils/crypto");

                // Helper to load and decrypt Live2D
                async function loadEncryptedLive2D(url: string) {
                    const isSupabase = url.includes(
                        "uohepkqmwbstbmnkoqju.supabase.co",
                    );
                    if (!isSupabase) return url;

                    const basePath = url.substring(0, url.lastIndexOf("/") + 1);

                    // 1. Fetch model3.json and check if it's encrypted
                    const res = await fetch(url);
                    if (!res.ok) throw new Error("Failed to fetch model3.json");
                    const buffer = await res.arrayBuffer();

                    let modelJson;
                    try {
                        const plainText = new TextDecoder().decode(buffer);
                        modelJson = JSON.parse(plainText);
                        // If we are here, it's NOT encrypted! Just use the original URL!
                        console.log(
                            "[Live2D Viewer] Legacy unencrypted model detected. Loading directly from URL.",
                        );
                        return url;
                    } catch (e) {
                        // It IS encrypted.
                        const decryptedJsonBuffer =
                            await cryptoModule.xorEncryptDecrypt(buffer);
                        const jsonStr = new TextDecoder().decode(
                            decryptedJsonBuffer,
                        );
                        modelJson = JSON.parse(jsonStr);
                    }

                    const createDataUrl = async (
                        blob: Blob,
                    ): Promise<string> => {
                        return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () =>
                                resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                    };

                    // 2. Helper to fetch and decrypt a relative path, returning a data URL
                    const createDecryptedDataUrl = async (
                        relativeOrAbsolutePath: string,
                    ) => {
                        let fullUrl = relativeOrAbsolutePath;
                        if (
                            !fullUrl.startsWith("http") &&
                            !fullUrl.startsWith("data:")
                        ) {
                            fullUrl = new URL(relativeOrAbsolutePath, basePath)
                                .href;
                        }

                        const fallbackExt =
                            fullUrl.split(".").pop()?.toLowerCase() || "";
                        const mimeTypes: Record<string, string> = {
                            png: "image/png",
                            jpg: "image/jpeg",
                            jpeg: "image/jpeg",
                            json: "application/json",
                            moc3: "application/octet-stream",
                        };
                        const mime =
                            mimeTypes[fallbackExt] ||
                            "application/octet-stream";

                        const fileRes = await fetch(fullUrl);
                        if (!fileRes.ok)
                            throw new Error("Failed to fetch " + fullUrl);
                        const fileBuffer = await fileRes.arrayBuffer();
                        const decryptedFileBuffer =
                            await cryptoModule.xorEncryptDecrypt(fileBuffer);
                        const blob = new Blob([decryptedFileBuffer], {
                            type: mime,
                        });
                        return await createDataUrl(blob);
                    };

                    // 3. Discover all file paths.
                    // Recursively traverse modelJson and replace paths.
                    const replacePaths = async (obj: any) => {
                        if (Array.isArray(obj)) {
                            for (let i = 0; i < obj.length; i++) {
                                if (
                                    typeof obj[i] === "string" &&
                                    obj[i].match(
                                        /\.(moc3|png|jpg|jpeg|tga|atlas|json)$/i,
                                    )
                                ) {
                                    obj[i] = await createDecryptedDataUrl(
                                        obj[i],
                                    );
                                } else if (
                                    typeof obj[i] === "object" &&
                                    obj[i] !== null
                                ) {
                                    await replacePaths(obj[i]);
                                }
                            }
                        } else if (typeof obj === "object" && obj !== null) {
                            for (const key of Object.keys(obj)) {
                                if (
                                    typeof obj[key] === "string" &&
                                    obj[key].match(
                                        /\.(moc3|png|jpg|jpeg|tga|atlas|json)$/i,
                                    )
                                ) {
                                    obj[key] = await createDecryptedDataUrl(
                                        obj[key],
                                    );
                                } else if (
                                    typeof obj[key] === "object" &&
                                    obj[key] !== null
                                ) {
                                    await replacePaths(obj[key]);
                                }
                            }
                        }
                    };

                    await replacePaths(modelJson);

                    // 4. Create data URL for model3.json itself
                    const blobJson = new Blob([JSON.stringify(modelJson)], {
                        type: "application/json",
                    });

                    const finalDataUrl = await createDataUrl(blobJson);
                    return finalDataUrl + "#dummy.model3.json";
                }

                const finalUrl = await loadEncryptedLive2D(modelUrl);

                const model = await PIXI.live2d.Live2DModel.from(finalUrl, {
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

                //model.on("pointertap", (e: any) => {
                //    const point = e.data.global;
                //    model.tap(point.x, point.y);
                //    dispatch("interaction", {
                //        action: "tap",
                //        duration: "point",
                //        state: "neutral",
                //        is_ongoing: false,
                //    });
                //});

                model.x = x;
                model.y = y;

                if (x === 0 && y === 0) {
                    model.anchor.set(0.5, 0.5);
                    model.x = app.screen.width / 2;
                    model.y = app.screen.height / 2 + 150;
                }

                app.stage.addChild(model);
                currentModel = model;
                disableAllMotions(model);

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
                const motionDefsForDebug =
                    (DISABLE_ALL_MOTIONS && originalMotionDefinitions) ||
                    model.internalModel?.motionManager?.definitions;
                if (motionDefsForDebug) {
                    Object.keys(motionDefsForDebug).forEach((k) =>
                        foundMotionGroups.add(k),
                    );
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

                // --- NEW: Apply Permanent Expressions ---
                if (persona && persona.first_scene) {
                    try {
                        const data = JSON.parse(persona.first_scene);
                        if (Array.isArray(data.live2d_permanent_expressions)) {
                            console.log(
                                "Applying Permanent Expressions (Hard Lock):",
                                data.live2d_permanent_expressions,
                            );

                            const applyHardExpression = async (
                                exprName: string,
                            ) => {
                                try {
                                    const settings =
                                        model.internalModel?.settings;
                                    let file = "";

                                    // 1. Find the file path for the expression name
                                    if (settings?.FileReferences?.Expressions) {
                                        const exprEntry =
                                            settings.FileReferences.Expressions.find(
                                                (e: any) =>
                                                    e.Name === exprName ||
                                                    e.File?.includes(exprName),
                                            );
                                        if (exprEntry) file = exprEntry.File;
                                    } else if (settings?.expressions) {
                                        const exprEntry =
                                            settings.expressions.find(
                                                (e: any) =>
                                                    e.name === exprName ||
                                                    e.Name === exprName,
                                            );
                                        if (exprEntry)
                                            file =
                                                exprEntry.file ||
                                                exprEntry.File;
                                    }

                                    if (!file) {
                                        console.warn(
                                            `Could not find file for expression: ${exprName}`,
                                        );
                                        return;
                                    }

                                    // 2. Resolve URL
                                    // modelUrl is usually the model3.json URL
                                    const baseUrl = modelUrl.substring(
                                        0,
                                        modelUrl.lastIndexOf("/") + 1,
                                    );
                                    const exprUrl = baseUrl + file;

                                    console.log(
                                        `Fetching Expression JSON: ${exprUrl}`,
                                    );
                                    const resp = await fetch(exprUrl);
                                    const json = await resp.json();

                                    if (
                                        json.Parameters &&
                                        Array.isArray(json.Parameters)
                                    ) {
                                        json.Parameters.forEach((p: any) => {
                                            if (
                                                model.internalModel.coreModel
                                                    .setParameterValueById
                                            ) {
                                                model.internalModel.coreModel.setParameterValueById(
                                                    p.Id,
                                                    p.Value,
                                                );
                                            } else {
                                                // Fallback for older SDKs if method name differs
                                                console.warn(
                                                    "setParameterValueById not found on coreModel",
                                                );
                                            }
                                        });
                                        console.log(
                                            `✅ Applied hard-lock for ${exprName}`,
                                        );
                                    }
                                } catch (err) {
                                    console.error(
                                        `Failed to apply hard expression ${exprName}:`,
                                        err,
                                    );
                                }
                            };

                            data.live2d_permanent_expressions.forEach(
                                (expr: string) => {
                                    applyHardExpression(expr);
                                },
                            );
                        }
                    } catch (e) {
                        // console.warn("Failed to parse first_scene for Expressions", e);
                    }
                }
            } catch (e: any) {
                console.error("Failed to initialize Live2D:", e);
                debugInfo.error = e.message || e.toString();
                isLoaded = true;
            }
        }, 100);
    });

    export let isCloseup = false;

    // Trigger update when isCloseup changes externally or internally
    $: if (isCloseup !== undefined && app && currentModel) {
        onResize();
    }

    export function toggleCamera() {
        isCloseup = !isCloseup;
        // Reactive statement will handle onResize
    }

    // --- Drag Cursor Logic ---
    let cursorPos = { x: 0, y: 0 };
    let showHandCursor = false;

    $: if (closeupScale || closeupOffset) {
        if (isCloseup) onResize();
    }

    function onResize() {
        if (app && currentModel && x === 0 && y === 0) {
            const bounds = currentModel.getBounds();

            // Calculate original dimensions
            const modelWidth = bounds.width / currentModel.scale.x;
            const modelHeight = bounds.height / currentModel.scale.y;

            const paddingFactor = 1.3;
            const scaleX = (app.screen.width * paddingFactor) / modelWidth;
            const scaleY = (app.screen.height * paddingFactor) / modelHeight;
            let autoScale = Math.min(scaleX, scaleY);
            let targetY = app.screen.height / 2 + 50;

            if (isCloseup) {
                autoScale *= closeupScale;

                // Calculate offset based on VISUAL height, not Screen height
                const visualHeight = modelHeight * autoScale;
                targetY += visualHeight * closeupOffset;
            } else {
                // This ensures consistency across Portrait/Landscape
                const visualHeight = modelHeight * autoScale;
                targetY += visualHeight * 0.1;
            }

            currentModel.scale.set(autoScale);
            currentModel.x = app.screen.width / 2;
            currentModel.y = targetY;
        }
    }

    onDestroy(() => {
        //if (idleInterval) clearInterval(idleInterval);
        window.removeEventListener("resize", onResize);

        //audio
        DestroyAudio();
        SafeAudioManager.stop();
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

<div class="live2d-container" class:hiding-cursor={showHandCursor}>
    {#if backgroundImage}
        <img
            src={backgroundImage}
            alt="background"
            class="live2d-bg"
            draggable="false"
        />
    {/if}
    <canvas bind:this={canvasElement} class="live2d-canvas"></canvas>

    {#if showHandCursor}
        <div
            class="hand-cursor"
            style="left: {cursorPos.x}px; top: {cursorPos.y}px;"
        >
            <Icon
                icon="ph:hand-grabbing-fill"
                width="48"
                height="48"
                color="white"
            />
        </div>
    {/if}

    {#if !isLoaded}
        <div class="model-loader">
            <div class="loader-content">
                <Icon
                    icon="line-md:loading-twotone-loop"
                    width="64"
                    height="64"
                />
                <span class="loading-text">Live2D 모델 로딩 중...</span>
                <small class="loading-hint">Loading...</small>
            </div>
        </div>
    {/if}

    {#if showDebug}
        <Live2DDebugPanel
            {debugInfo}
            {autonomy}
            motionDefinitions={getMotionDefinitionsForDebug()}
            {resetToDefault}
            {playGesture}
            {playMotionTemporarilyEnabled}
            onExpressionSelect={handleDebugExpressionSelect}
            onSetManualParam={handleDebugSetManualParam}
            onSetEmotion={handleDebugSetEmotion}
        />
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

    <!-- ✨ SLEEP EFFECT (ZZZ...) -->
    {#if currentAutonomyEmotion === "SLEEP"}
        <div class="sleep-effect-container">
            <div class="z-particle z1">Z</div>
            <div class="z-particle z2">Z</div>
            <div class="z-particle z3">Z</div>
        </div>
    {/if}
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

    .live2d-container.hiding-cursor,
    .live2d-container.hiding-cursor .live2d-canvas {
        cursor: none !important;
    }

    .hand-cursor {
        position: fixed; /* absolute 대신 fixed가 스크롤/뷰포트 이슈에서 안전함 */
        top: 0;
        left: 0;
        pointer-events: none; /* 클릭 방해 금지 */
        z-index: 99999; /* 최상위 */
        transform: translate(-50%, -50%); /* 정확히 중앙에 위치 */

        /* 약간의 글로우 효과 */
        filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.5));

        /* 나타날 때 팝업 애니메이션 */
        animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes popIn {
        from {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
        }
        to {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
        }
    }

    /* ✨ SLEEP EFFECT STYLES */
    .sleep-effect-container {
        position: absolute;
        top: 20%;
        right: 25%;
        width: 100px;
        height: 100px;
        pointer-events: none;
        z-index: 9999;
    }

    .z-particle {
        position: absolute;
        color: white;
        font-weight: bold;
        font-family: "Comic Sans MS", "Chalkboard SE", sans-serif;
        text-shadow: 2px 2px 0px #4a4a4a;
        opacity: 0;
    }

    .z1 {
        font-size: 24px;
        animation: floatZ 3s infinite ease-out 0s;
        left: 0;
        bottom: 0;
    }
    .z2 {
        font-size: 32px;
        animation: floatZ 3s infinite ease-out 1s;
        left: 20px;
        bottom: 20px;
    }
    .z3 {
        font-size: 40px;
        animation: floatZ 3s infinite ease-out 2s;
        left: 45px;
        bottom: 45px;
    }

    @keyframes floatZ {
        0% {
            transform: translate(0, 0) rotate(-10deg);
            opacity: 0;
        }
        20% {
            opacity: 1;
        }
        80% {
            opacity: 0.8;
        }
        100% {
            transform: translate(40px, -60px) rotate(10deg);
            opacity: 0;
        }
    }
</style>

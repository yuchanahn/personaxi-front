<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from "svelte";
    import { loadLive2DScripts } from "$lib/utils/live2dLoader";
    import Icon from "@iconify/svelte";
    import { Live2DAutonomy } from "$lib/utils/live2d/Live2DAutonomy";
    import Live2DDebugPanel from "$lib/components/live2d/Live2DDebugPanel.svelte";
    import { createLive2DMotionControl } from "$lib/components/live2d/useLive2DMotionControl";
    import { createLive2DAudioController } from "$lib/components/live2d/useLive2DAudio";
    import { createLive2DExpressionControl } from "$lib/components/live2d/useLive2DExpressionControl";
    import {
        applyPermanentExpressions,
        collectAvailableExpressions,
        collectAvailableMotionGroups,
        loadLive2DModel,
    } from "$lib/components/live2d/useLive2DModel";

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
    let currentAutonomyEmotion = "CALM";

    const motionControl = createLive2DMotionControl({
        getCurrentModel: () => currentModel,
        disableAllMotionsByDefault: true,
    });

    const disableAllMotions = (model: any) => motionControl.disableAllMotions(model);
    const getMotionDefinitionsForDebug = () => motionControl.getMotionDefinitionsForDebug();
    const playMotionTemporarilyEnabled = (group: string, index?: number) =>
        motionControl.playMotion(group, index, 3);

    const audioController = createLive2DAudioController({
        getCurrentModel: () => currentModel,
        getAutonomy: () => autonomy,
        setSpeechError: (value) => {
            error_showSpeech = value;
        },
    });

    function isLocalTestHost(): boolean {
        if (typeof window === "undefined") return false;
        const host = window.location.hostname;
        return host === "localhost" || host === "127.0.0.1" || host === "::1";
    }

    $: if (autonomy) {
        autonomy.onEmotionChange = (emo) => {
            currentAutonomyEmotion = emo;
        };
    }

    export async function speak(audioUrl: string, onFinish?: () => void) {
        await audioController.speak(audioUrl, onFinish);
    }

    export function toggleDebug() {
        showDebug = !showDebug;
        if (currentModel && (currentModel as any).hitAreaFrames) {
            (currentModel as any).hitAreaFrames.visible = showDebug;
        }
    }

    function handleDebugExpressionSelect(expr: string) {
        if (!currentModel) return;
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
            currentModel.internalModel.coreModel.update();
        } catch (e) {
            console.error("Failed to set parameter:", e);
            alert("Error setting parameter. Check ID.");
        }
    }

    function handleDebugSetEmotion(emotion: string) {
        if (!autonomy) return;
        // @ts-ignore
        autonomy.setEmotion(emotion);
    }
    export function resetToDefault() {
        if (!currentModel || !currentModel.internalModel) return;

        const internal = currentModel.internalModel;
        const mgr = internal.motionManager;

        if (mgr) {
            if (typeof mgr.stopAll === "function") {
                mgr.stopAll();
            }
            else if (typeof mgr.stop === "function") {
                mgr.stop();
            }
            if (mgr.queue) {
                mgr.queue = [];
            }

            if (mgr.expressionManager) {
                if (
                    typeof mgr.expressionManager.stopAllExpressions ===
                    "function"
                ) {
                    mgr.expressionManager.stopAllExpressions();
                } else if (
                    typeof mgr.expressionManager.restore === "function"
                ) {
                    mgr.expressionManager.restore();
                }
            }
        }

        const core = internal.coreModel;
        if (core) {
            const paramCount = core.getParameterCount();
            for (let i = 0; i < paramCount; i++) {
                const defaultValue = core.getParameterDefaultValue(i);
                core.setParameterValueByIndex(i, defaultValue);
            }
        }

        debugInfo.currentEmotion = "None";
        debugInfo.currentExpression = "None";
        debugInfo.lastMotion = "Reset (Hard)";
        debugInfo = debugInfo;
    }

    export function triggerMotion(fileName: string) {
        const matchedMotion = motionControl.findMotionByFile(fileName);
        if (!matchedMotion) return;
        resetToDefault();
        playMotionTemporarilyEnabled(matchedMotion.group, matchedMotion.index);
        debugInfo.lastMotion = `${matchedMotion.group} (${matchedMotion.index}): ${fileName}`;
    }

    const expressionControl = createLive2DExpressionControl({
        getCurrentModel: () => currentModel,
        getAutonomy: () => autonomy,
        getExpressionMap: () => expressionMap,
        onSetCurrentEmotion: (emotion) => {
            debugInfo.currentEmotion = emotion;
        },
        onSetCurrentExpression: (expression) => {
            debugInfo.currentExpression = expression;
        },
    });

    export function triggerExpression(fileName: string) {
        expressionControl.triggerExpression(fileName);
    }

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
        expressionControl.setExpression(emotion);
    }

    function draggable(model: any) {
        model.buttonMode = true;
        let startX = 0;
        let startY = 0;
        const dragThreshold = 10;

        model.on("pointerdown", (e: any) => {
            startX = e.data.global.x;
            startY = e.data.global.y;
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

    let destroyAudioInit = () => {};

    onMount(async () => {
        showDebug = isLocalTestHost();

        destroyAudioInit = audioController.setupInteractionAudioInit();

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

                const { model, hitAreaKeys } = await loadLive2DModel({
                    PIXI,
                    app,
                    modelUrl,
                    showDebug,
                    x,
                    y,
                    scale,
                });
                draggable(model);

                if (hitAreaKeys.length === 0) {
                    debugInfo.error =
                        "No Hit Areas detected in this model! (Check .model3.json)";
                } else {
                    debugInfo.fileMotions = hitAreaKeys;
                }

                app.stage.addChild(model);
                currentModel = model;
                disableAllMotions(model);

                autonomy = new Live2DAutonomy(model, app);
                autonomy.start();

                isLoaded = true;
                debugInfo.modelUrl = modelUrl;
                debugInfo.availableExpressions =
                    collectAvailableExpressions(model);
                debugInfo.availableMotionGroups = collectAvailableMotionGroups(
                    model,
                    getMotionDefinitionsForDebug(),
                );
                debugInfo = debugInfo;

                window.addEventListener("resize", onResize);
                await applyPermanentExpressions(
                    model,
                    modelUrl,
                    persona?.first_scene,
                );
            } catch (e: any) {
                console.error("Failed to initialize Live2D:", e);
                debugInfo.error = e.message || e.toString();
                isLoaded = true;
            }
        }, 100);
    });

    export let isCloseup = false;

    $: if (isCloseup !== undefined && app && currentModel) {
        onResize();
    }

    export function toggleCamera() {
        isCloseup = !isCloseup;
    }

    let cursorPos = { x: 0, y: 0 };
    let showHandCursor = false;

    $: if (closeupScale || closeupOffset) {
        if (isCloseup) onResize();
    }

    function onResize() {
        if (app && currentModel && x === 0 && y === 0) {
            const bounds = currentModel.getBounds();

            const modelWidth = bounds.width / currentModel.scale.x;
            const modelHeight = bounds.height / currentModel.scale.y;

            const paddingFactor = 1.3;
            const scaleX = (app.screen.width * paddingFactor) / modelWidth;
            const scaleY = (app.screen.height * paddingFactor) / modelHeight;
            let autoScale = Math.min(scaleX, scaleY);
            let targetY = app.screen.height / 2 + 50;

            if (isCloseup) {
                autoScale *= closeupScale;

                const visualHeight = modelHeight * autoScale;
                targetY += visualHeight * closeupOffset;
            } else {
                const visualHeight = modelHeight * autoScale;
                targetY += visualHeight * 0.1;
            }

            currentModel.scale.set(autoScale);
            currentModel.x = app.screen.width / 2;
            currentModel.y = targetY;
        }
    }

    onDestroy(() => {
        window.removeEventListener("resize", onResize);
        destroyAudioInit();
        audioController.stop();
        expressionControl.destroy();

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

    <!-- SLEEP EFFECT (ZZZ...) -->
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

    /* SLEEP EFFECT STYLES */
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

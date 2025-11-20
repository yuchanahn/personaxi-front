<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { loadLive2DScripts } from "$lib/utils/live2dLoader";

    export let modelUrl: string;
    export let scale: number = 0.3;
    export let x: number = 0;
    export let y: number = 0;

    let canvasElement: HTMLCanvasElement;
    let app: any;
    let currentModel: any | null = null;
    let isLoaded = false;
    let idleInterval: any;

    // Debug State
    let showDebug = true;
    let debugInfo = {
        modelUrl: "",
        currentEmotion: "None",
        currentExpression: "None",
        lastMotion: "None",
        availableExpressions: [] as string[],
        availableMotionGroups: [] as string[],
    };

    export async function speak(audioUrl: string) {
        if (!currentModel) {
            console.warn("Live2D model not ready for speaking.");
            return;
        }

        try {
            await currentModel.speak(audioUrl, {
                volume: 1,
                expression: 4,
                resetExpression: true,
                crossOrigin: "anonymous",
            });
        } catch (e) {
            console.error("Live2D speak failed:", e);
        }
    }

    export function toggleDebug() {
        showDebug = !showDebug;
        console.log("Debug toggled:", showDebug);
    }

    export function setExpression(emotion: string) {
        if (!currentModel) return;

        debugInfo.currentEmotion = emotion;
        debugInfo = debugInfo;

        const emotionLower = emotion.toLowerCase();

        // 1. Smart Matching
        if (currentModel.expressions) {
            const availableExpressions = currentModel.expressions;
            let match = availableExpressions.find(
                (name: string) => name.toLowerCase() === emotionLower,
            );

            if (!match) {
                match = availableExpressions.find((name: string) =>
                    name.toLowerCase().includes(emotionLower),
                );
            }

            if (match) {
                console.log(
                    `Smart matched expression: ${match} for emotion: ${emotion}`,
                );
                currentModel.expression(match);
                debugInfo.currentExpression = match;
                return;
            }
        }

        // 2. Fallback to Group Mapping
        let expressionIndex = 0;

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
                expressionIndex = 1;
                break;

            case "anger":
            case "annoyance":
            case "disapproval":
            case "disgust":
                expressionIndex = 2;
                break;

            case "sadness":
            case "grief":
            case "disappointment":
            case "remorse":
            case "embarrassment":
                expressionIndex = 3;
                break;

            case "surprise":
            case "realization":
            case "confusion":
            case "curiosity":
                expressionIndex = 4;
                break;

            case "fear":
            case "nervousness":
                expressionIndex = 5;
                break;

            case "neutral":
            default:
                expressionIndex = 0;
                break;
        }

        try {
            const definitions =
                currentModel.internalModel?.motionManager?.expressionManager
                    ?.definitions;
            if (definitions && definitions.length > expressionIndex) {
                const name = definitions[expressionIndex].Name;
                currentModel.expression(name);
                debugInfo.currentExpression = `${name} (Index: ${expressionIndex})`;
            } else {
                const fallbackName = `f0${expressionIndex + 1}`;
                currentModel.expression(expressionIndex).catch(() => {
                    currentModel.expression(fallbackName).catch(() => {});
                });
                debugInfo.currentExpression = `Index: ${expressionIndex} / ${fallbackName}`;
            }
        } catch (e) {
            console.warn("Error setting expression:", e);
            debugInfo.currentExpression = "Error";
        }
    }

    onMount(async () => {
        try {
            await loadLive2DScripts();

            const PIXI = (window as any).PIXI;

            app = new PIXI.Application({
                view: canvasElement,
                autoStart: true,
                backgroundAlpha: 0,
                resizeTo: canvasElement.parentElement,
            });

            const model = await PIXI.live2d.Live2DModel.from(modelUrl, {
                autoInteract: true,
            });

            model.scale.set(scale);
            model.x = x;
            model.y = y;

            if (x === 0 && y === 0) {
                model.anchor.set(0.5, 0.5);
                model.x = app.screen.width / 2;
                model.y = app.screen.height / 2 + 100;
            }

            app.stage.addChild(model);
            currentModel = model;
            isLoaded = true;

            // Update Debug Info
            debugInfo.modelUrl = modelUrl;
            debugInfo.availableExpressions = model.expressions || [];
            if (model.internalModel && model.internalModel.motionManager) {
                debugInfo.availableMotionGroups = Object.keys(
                    model.internalModel.motionManager.definitions,
                );
            }
            debugInfo = debugInfo;

            console.log("Live2D Model Loaded");
            console.log("Expressions:", model.expressions);
            if (model.internalModel && model.internalModel.motionManager) {
                console.log(
                    "Motions:",
                    model.internalModel.motionManager.definitions,
                );
            }

            // Random Idle Behavior
            idleInterval = setInterval(() => {
                if (
                    !currentModel ||
                    !currentModel.internalModel ||
                    !currentModel.internalModel.motionManager
                )
                    return;

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
        } catch (e) {
            console.error("Failed to initialize Live2D:", e);
        }
    });

    function onResize() {
        if (app && currentModel && x === 0 && y === 0) {
            currentModel.x = app.screen.width / 2;
            currentModel.y = app.screen.height / 2 + 100;
        }
    }

    onDestroy(() => {
        if (idleInterval) clearInterval(idleInterval);
        if (app) {
            app.destroy(true, { children: true });
        }
        window.removeEventListener("resize", onResize);
    });
</script>

<!-- Debug UI -->
<div class="debug-toggle">
    <button on:click={() => (showDebug = !showDebug)}>
        {showDebug ? "🔍 Hide" : "🔍 Debug"}
    </button>
</div>
<div class="live2d-container">
    <canvas bind:this={canvasElement} class="live2d-canvas"></canvas>

    {#if showDebug}
        <div class="debug-panel">
            <h3>🎭 Live2D Debug</h3>

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
                        <div class="list-item">{expr}</div>
                    {/each}
                </div>
            </div>

            <div class="info-section">
                <strong>Motion Groups:</strong>
                <div class="scroll-list">
                    {#each debugInfo.availableMotionGroups as group}
                        <div class="list-item">{group}</div>
                    {/each}
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .live2d-container {
        position: relative;
        width: 100%;
        height: 100%;
    }

    .live2d-canvas {
        width: 100%;
        height: 100%;
        display: block;
        pointer-events: none; /* Allow clicks to pass through canvas */
    }

    .debug-toggle {
        position: fixed;
        bottom: 80px;
        right: 20px;
        z-index: 9999;
        pointer-events: auto;
    }

    .debug-toggle button {
        background: rgba(0, 0, 0, 0.8);
        color: #0f0;
        border: 1px solid #0f0;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        transition: all 0.2s;
        pointer-events: auto;
    }

    .debug-toggle button:hover {
        background: rgba(0, 255, 0, 0.2);
        box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
    }

    .debug-panel {
        position: fixed;
        bottom: 130px;
        right: 20px;
        width: 320px;
        max-height: 80%;
        background: rgba(0, 0, 0, 0.9);
        color: #0f0;
        padding: 15px;
        border-radius: 8px;
        border: 2px solid #0f0;
        font-family: "Courier New", monospace;
        font-size: 11px;
        z-index: 100;
        overflow-y: auto;
        pointer-events: auto;
        box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
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
        max-height: 120px;
        overflow-y: auto;
        background: rgba(0, 255, 0, 0.05);
        padding: 5px;
        margin-top: 5px;
        border-radius: 4px;
        border: 1px solid #333;
    }

    .list-item {
        padding: 3px 5px;
        border-bottom: 1px solid rgba(0, 255, 0, 0.1);
        color: #0f0;
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
</style>

<script module lang="ts">
    export interface Live2DMotionInfo {
        group: string;
        index: number;
        file: string;
    }
</script>

<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { loadLive2DScripts } from "$lib/utils/live2dLoader";
    import { SafeAudioManager } from "$lib/utils/safeAudioManager";

    interface Props {
        modelUrl?: string;
        scale?: number;
        onMetadataLoaded?: (info: {
            expressions: string[];
            motions: Live2DMotionInfo[];
        }) => void;
        onError?: (error: { message: string }) => void;
    }

    let {
        modelUrl = "",
        scale = 0.5,
        onMetadataLoaded = () => {},
        onError = () => {},
    }: Props = $props();

    let canvasContainer: HTMLDivElement;
    let app: any = null;
    let currentModel: any = null;

    // We dynamically import crypto to prevent SSR issues
    let cryptoModule: any = null;

    let isSpeaking = false;

    onMount(async () => {
        await loadLive2DScripts();
        const PIXI = (window as any).PIXI;

        // Initialize PIXI App, responsive to the container
        app = new PIXI.Application({
            resizeTo: canvasContainer,
            transparent: true,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
        });
        canvasContainer.appendChild(app.view as any);

        if (modelUrl) {
            await loadModel(modelUrl);
        }

        // Pointer tracking bounded precisely to canvas
        app.view.addEventListener("pointermove", (e: PointerEvent) => {
            if (currentModel) {
                // Convert browser event coordinates to canvas-local coordinates
                let rect = (
                    app!.view as HTMLCanvasElement
                ).getBoundingClientRect();
                let x = e.clientX - rect.left;
                let y = e.clientY - rect.top;
                currentModel.focus(x, y);
            }
        });
    });

    onDestroy(() => {
        if (currentModel) {
            currentModel.destroy();
        }
        if (app) {
            app.destroy(true, { children: true });
        }
        SafeAudioManager.stop();
    });

    $effect(() => {
        if (app && modelUrl) {
            loadModel(modelUrl);
        }
    });

    // Helper to load and decrypt Live2D (copied from Live2DViewer)
    async function loadEncryptedLive2D(url: string) {
        const isSupabase = url.includes("uohepkqmwbstbmnkoqju.supabase.co");
        if (!isSupabase) return url;

        if (!cryptoModule) {
            cryptoModule = await import("$lib/utils/crypto");
        }

        const basePath = url.substring(0, url.lastIndexOf("/") + 1);

        // 1. Fetch model3.json and check if it's encrypted
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch model3.json");
        const buffer = await res.arrayBuffer();

        let modelJson;
        try {
            const plainText = new TextDecoder().decode(buffer);
            modelJson = JSON.parse(plainText);
            // NOT encrypted
            return url;
        } catch (e) {
            // IS encrypted
            const decryptedJsonBuffer =
                await cryptoModule.xorEncryptDecrypt(buffer);
            const jsonStr = new TextDecoder().decode(decryptedJsonBuffer);
            modelJson = JSON.parse(jsonStr);
        }

        const createDataUrl = async (blob: Blob): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        };

        const createDecryptedDataUrl = async (
            relativeOrAbsolutePath: string,
        ) => {
            let fullUrl = relativeOrAbsolutePath;
            if (!fullUrl.startsWith("http") && !fullUrl.startsWith("data:")) {
                fullUrl = new URL(relativeOrAbsolutePath, basePath).href;
            }
            const fallbackExt = fullUrl.split(".").pop()?.toLowerCase() || "";
            const mimeTypes: Record<string, string> = {
                png: "image/png",
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                json: "application/json",
                moc3: "application/octet-stream",
            };
            const mime = mimeTypes[fallbackExt] || "application/octet-stream";

            const fileRes = await fetch(fullUrl);
            if (!fileRes.ok) throw new Error("Failed to fetch " + fullUrl);
            const fileBuffer = await fileRes.arrayBuffer();
            const decryptedFileBuffer =
                await cryptoModule.xorEncryptDecrypt(fileBuffer);
            const blob = new Blob([decryptedFileBuffer], { type: mime });
            return await createDataUrl(blob);
        };

        const replacePaths = async (obj: any) => {
            if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length; i++) {
                    if (
                        typeof obj[i] === "string" &&
                        obj[i].match(/\.(moc3|png|jpg|jpeg|tga|atlas|json)$/i)
                    ) {
                        obj[i] = await createDecryptedDataUrl(obj[i]);
                    } else if (typeof obj[i] === "object" && obj[i] !== null) {
                        await replacePaths(obj[i]);
                    }
                }
            } else if (typeof obj === "object" && obj !== null) {
                for (const key of Object.keys(obj)) {
                    if (
                        typeof obj[key] === "string" &&
                        obj[key].match(/\.(moc3|png|jpg|jpeg|tga|atlas|json)$/i)
                    ) {
                        obj[key] = await createDecryptedDataUrl(obj[key]);
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

        const blobJson = new Blob([JSON.stringify(modelJson)], {
            type: "application/json",
        });
        const finalDataUrl = await createDataUrl(blobJson);
        return finalDataUrl + "#dummy.model3.json";
    }

    async function loadModel(url: string) {
        if (!url) return;

        if (currentModel) {
            currentModel.destroy();
            currentModel = null;
        }

        try {
            const finalUrl = await loadEncryptedLive2D(url);

            // autoInteract: false completely disables the built-in tracking/clicking
            // allowing us to handle it manually and preventing idle motions overriding tests
            const model = await PIXI.live2d.Live2DModel.from(finalUrl, {
                autoInteract: false,
            });

            // Center model and scale it
            model.anchor.set(0.5, 0.5);

            // We wait for a tick so resizeTo settles
            setTimeout(() => {
                if (!app) return;
                model.x = app.screen.width / 2;
                model.y = app.screen.height / 2 + 100; // slight offset down
                model.scale.set(scale);
            }, 50);

            app!.stage.addChild(model);
            currentModel = model;

            // Extract real motions and expressions
            extractMetadata(model);
        } catch (error) {
            console.error("Failed to load Live2D model in Sandbox:", error);
            onError({ message: "Failed to load model" });
        }
    }

    function extractMetadata(model: any) {
        // Expressions
        const expressions = new Set<string>();
        const settings = model.internalModel?.settings;

        // Some runtimes expose model.expressions but keep it empty.
        // Do not stop fallback discovery when that happens.
        const modelExpressions = model.expressions;
        if (Array.isArray(modelExpressions) && modelExpressions.length > 0) {
            modelExpressions.forEach((e: any) => {
                if (typeof e === "string" && e.trim()) {
                    expressions.add(e.trim());
                    return;
                }
                if (e && typeof e === "object") {
                    if (typeof e.Name === "string" && e.Name.trim()) {
                        expressions.add(e.Name.trim());
                        return;
                    }
                    if (typeof e.name === "string" && e.name.trim()) {
                        expressions.add(e.name.trim());
                        return;
                    }
                    if (typeof e.File === "string" && e.File.trim()) {
                        expressions.add(
                            e.File.split("/")
                                .pop()
                                ?.replace(/\.exp3\.json$/i, "") || e.File,
                        );
                    }
                }
            });
        }

        if (settings?.FileReferences?.Expressions) {
            settings.FileReferences.Expressions.forEach((e: any) => {
                if (typeof e?.Name === "string" && e.Name.trim()) {
                    expressions.add(e.Name.trim());
                } else if (typeof e?.File === "string" && e.File.trim()) {
                    expressions.add(
                        e.File.split("/")
                            .pop()
                            ?.replace(/\.exp3\.json$/i, "") || e.File,
                    );
                }
            });
        } else if (Array.isArray(settings?.expressions)) {
            settings.expressions.forEach((e: any) => {
                if (typeof e?.name === "string" && e.name.trim()) {
                    expressions.add(e.name.trim());
                } else if (typeof e?.Name === "string" && e.Name.trim()) {
                    expressions.add(e.Name.trim());
                }
            });
        }

        // Motions (Groups and Indices)
        const motions: Live2DMotionInfo[] = [];
        const motionDefs = model.internalModel?.motionManager?.definitions;
        const motionFiles = settings?.FileReferences?.Motions;

        if (motionFiles) {
            Object.keys(motionFiles).forEach((group) => {
                motionFiles[group].forEach((motionObj: any, index: number) => {
                    motions.push({
                        group,
                        index,
                        file: motionObj.File || `${group}_${index}`,
                    });
                });
            });
        } else if (motionDefs) {
            Object.keys(motionDefs).forEach((group) => {
                motionDefs[group].forEach((_: any, index: number) => {
                    motions.push({
                        group,
                        index,
                        file: `${group} [${index}]`,
                    });
                });
            });
        }

        onMetadataLoaded({
            expressions: Array.from(expressions),
            motions: motions,
        });
    }

    // --- Public API for Parent Sandbox ---

    export function triggerExpression(exprName: string) {
        if (!currentModel) return;
        currentModel.expression(exprName);
    }

    export async function triggerMotion(group: string, index: number) {
        if (!currentModel) return;
        // The Priority argument is usually 3 (Force) to override anything else
        const audioSnapshot = SafeAudioManager.getPlaybackSnapshot();
        const motionResult = currentModel.motion(group, index, 3);

        const tryResume = async () => {
            await SafeAudioManager.resumeFromSnapshotIfInterrupted(
                audioSnapshot,
            );
        };

        // Some runtimes return a Promise that resolves when the motion ends.
        if (motionResult && typeof motionResult.then === "function") {
            try {
                await motionResult;
            } catch (e) {
                console.warn("Motion play failed:", e);
            }
            await tryResume();
            return;
        }

        // Fallback for runtimes without motion Promise support.
        // Retry a few times to catch different motion lengths.
        setTimeout(() => {
            tryResume();
        }, 900);
        setTimeout(() => {
            tryResume();
        }, 1600);
        setTimeout(() => {
            tryResume();
        }, 2400);
    }

    export async function speak(audioUrl: string) {
        if (!currentModel) return;

        isSpeaking = true;
        try {
            await SafeAudioManager.speak(currentModel, audioUrl, {
                resetExpression: false,
            });
        } finally {
            isSpeaking = false;
        }
    }
</script>

<div class="viewer-container" bind:this={canvasContainer}></div>

<style>
    .viewer-container {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
    }

    :global(canvas) {
        display: block;
        width: 100%;
        height: 100%;
    }
</style>

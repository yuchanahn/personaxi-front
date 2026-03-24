<script module lang="ts">
    export interface Live2DMotionInfo {
        group: string;
        index: number;
        file: string;
    }

    export interface Live2DParameterSlotSupport {
        canonicalId: string;
        resolvedId: string | null;
        supported: boolean;
    }

    export interface Live2DParameterSupportSummary {
        head: {
            x: Live2DParameterSlotSupport;
            y: Live2DParameterSlotSupport;
            z: Live2DParameterSlotSupport;
        };
        body: {
            x: Live2DParameterSlotSupport;
            y: Live2DParameterSlotSupport;
            z: Live2DParameterSlotSupport;
        };
    }

    export interface Live2DBodyPhysicsLinkSlot {
        linked: boolean;
        bodyParamId: string | null;
        sourceParamIds: string[];
        physicsSettingIds: string[];
    }

    export interface Live2DBodyPhysicsLinkSummary {
        x: Live2DBodyPhysicsLinkSlot;
        y: Live2DBodyPhysicsLinkSlot;
        z: Live2DBodyPhysicsLinkSlot;
    }
</script>

<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { loadLive2DScripts } from "$lib/utils/live2dLoader";
    import { SafeAudioManager } from "$lib/utils/safeAudioManager";
    import {
        Live2DAutonomy,
        type Live2DParameterSupportSummary as RuntimeParameterSupportSummary,
    } from "$lib/utils/live2d/Live2DAutonomy";
    import {
        resolveLive2DParameterMetadata,
        type Live2DBodyPhysicsLinkSummary as MetadataBodyPhysicsLinkSummary,
    } from "$lib/components/live2d/live2dParameterMetadata";
    import { createLive2DInteractionControl } from "$lib/components/live2d/useLive2DInteractionControl";
    import { createLive2DMotionControl } from "$lib/components/live2d/useLive2DMotionControl";

    interface Props {
        modelUrl?: string;
        scale?: number;
        onMetadataLoaded?: (info: {
            expressions: string[];
            motions: Live2DMotionInfo[];
            parameterSupport: Live2DParameterSupportSummary;
            bodyPhysicsLinks: Live2DBodyPhysicsLinkSummary;
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
    let autonomy: Live2DAutonomy | null = null;
    let currentBodyPhysicsLinks: Live2DBodyPhysicsLinkSummary = {
        x: {
            linked: false,
            bodyParamId: null,
            sourceParamIds: [],
            physicsSettingIds: [],
        },
        y: {
            linked: false,
            bodyParamId: null,
            sourceParamIds: [],
            physicsSettingIds: [],
        },
        z: {
            linked: false,
            bodyParamId: null,
            sourceParamIds: [],
            physicsSettingIds: [],
        },
    };
    let headCalibration = {
        angleYGain: 1.0,
        angleYOffset: 0,
        angleYMin: -90,
        angleYMax: 90,
        angleZGain: 1.0,
        angleZOffset: 0,
        angleZMin: -90,
        angleZMax: 90,
    };
    let bodyCalibration = {
        bodyXGain: 1.0,
        bodyYGain: 1.0,
        bodyZGain: 1.0,
        bodyXOffset: 0,
        bodyYOffset: 0,
        bodyZOffset: 0,
        bodyXMin: -90,
        bodyXMax: 90,
        bodyYMin: -90,
        bodyYMax: 90,
        bodyZMin: -90,
        bodyZMax: 90,
    };
    const motionControl = createLive2DMotionControl({
        getCurrentModel: () => currentModel,
        disableAllMotionsByDefault: true,
    });

    // We dynamically import crypto to prevent SSR issues
    let cryptoModule: any = null;

    let isSpeaking = false;
    let isDragging = false;
    let hasInteracted = false;

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

    });

    onDestroy(() => {
        interactionControl.destroy();
        autonomy?.stop();
        autonomy = null;
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

    const interactionControl = createLive2DInteractionControl({
        getApp: () => app,
        getAutonomy: () => autonomy,
        onCursorChange: () => {},
        onDragStateChange: (dragging) => {
            isDragging = dragging;
        },
        onInteractionStart: () => {
            hasInteracted = true;
        },
        onInteractionEnd: () => {},
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
                await Promise.all(
                    obj.map(async (item, i) => {
                        if (
                            typeof item === "string" &&
                            item.match(/\.(moc3|png|jpg|jpeg|tga|atlas|json)$/i)
                        ) {
                            obj[i] = await createDecryptedDataUrl(item);
                        } else if (
                            typeof item === "object" &&
                            item !== null
                        ) {
                            await replacePaths(item);
                        }
                    }),
                );
            } else if (typeof obj === "object" && obj !== null) {
                const keys = Object.keys(obj);
                await Promise.all(
                    keys.map(async (key) => {
                        const value = obj[key];
                        if (
                            typeof value === "string" &&
                            value.match(/\.(moc3|png|jpg|jpeg|tga|atlas|json)$/i)
                        ) {
                            obj[key] = await createDecryptedDataUrl(value);
                        } else if (
                            typeof value === "object" &&
                            value !== null
                        ) {
                            await replacePaths(value);
                        }
                    }),
                );
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

        interactionControl.destroy();
        isDragging = false;
        hasInteracted = false;

        if (currentModel) {
            autonomy?.stop();
            autonomy = null;
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
            motionControl.disableAllMotions(model);
            autonomy = new Live2DAutonomy(model, app);
            const parameterMetadata = await resolveLive2DParameterMetadata(
                url,
                model,
            );
            const parameterAliasHints = parameterMetadata.aliasHints;
            currentBodyPhysicsLinks = mapBodyPhysicsLinks(
                parameterMetadata.bodyPhysicsLinks,
            );
            if (Object.keys(parameterAliasHints).length > 0) {
                autonomy.setParameterAliasHints(parameterAliasHints);
            }
            autonomy.setHeadCalibration(headCalibration);
            autonomy.setBodyCalibration(bodyCalibration);
            autonomy.start();
            interactionControl.bind(model);

            // Extract real motions and expressions
            extractMetadata(model, currentBodyPhysicsLinks);
        } catch (error) {
            console.error("Failed to load Live2D model in Sandbox:", error);
            onError({ message: "Failed to load model" });
        }
    }

    function createEmptyBodyPhysicsLinks(): Live2DBodyPhysicsLinkSummary {
        return {
            x: {
                linked: false,
                bodyParamId: null,
                sourceParamIds: [],
                physicsSettingIds: [],
            },
            y: {
                linked: false,
                bodyParamId: null,
                sourceParamIds: [],
                physicsSettingIds: [],
            },
            z: {
                linked: false,
                bodyParamId: null,
                sourceParamIds: [],
                physicsSettingIds: [],
            },
        };
    }

    function mapBodyPhysicsLinks(
        summary: MetadataBodyPhysicsLinkSummary | null | undefined,
    ): Live2DBodyPhysicsLinkSummary {
        return summary ?? createEmptyBodyPhysicsLinks();
    }

    function extractMetadata(
        model: any,
        bodyPhysicsLinks: MetadataBodyPhysicsLinkSummary | null | undefined,
    ) {
        // Expressions
        const expressions = new Set<string>();
        const settings = model.internalModel?.settings;
        const expressionEntries = getExpressionEntries(settings);

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

        expressionEntries.forEach((e: any) => {
            if (typeof e?.name === "string" && e.name.trim()) {
                expressions.add(e.name.trim());
            } else if (typeof e?.Name === "string" && e.Name.trim()) {
                expressions.add(e.Name.trim());
            } else if (typeof e?.File === "string" && e.File.trim()) {
                expressions.add(
                    e.File.split("/")
                        .pop()
                        ?.replace(/\.exp3\.json$/i, "")
                        ?.replace(/\.json$/i, "") || e.File,
                );
            } else if (typeof e?.file === "string" && e.file.trim()) {
                expressions.add(
                    e.file.split("/")
                        .pop()
                        ?.replace(/\.exp3\.json$/i, "")
                        ?.replace(/\.json$/i, "") || e.file,
                );
            }
        });

        if (expressions.size === 0 && Array.isArray(settings?.json?.FileReferences?.Expressions)) {
            settings.json.FileReferences.Expressions.forEach((e: any) => {
                if (typeof e?.Name === "string" && e.Name.trim()) {
                    expressions.add(e.Name.trim());
                }
            });
        }

        // Motions (Groups and Indices)
        const motions: Live2DMotionInfo[] = [];
        const motionDefs =
            motionControl.getMotionDefinitionsForDebug() ||
            model.internalModel?.motionManager?.definitions;
        const motionFiles = getMotionGroups(settings);

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

        const parameterSupport = mapParameterSupport(
            autonomy?.getParameterSupportSummary(),
        );
        const mappedBodyPhysicsLinks = mapBodyPhysicsLinks(bodyPhysicsLinks);
        if (hasMissingParameterSupport(parameterSupport)) {
            logDiagnostics(
                model,
                parameterSupport,
                mappedBodyPhysicsLinks,
                "missing-parameter-support",
            );
        }

        onMetadataLoaded({
            expressions: Array.from(expressions),
            motions: motions,
            parameterSupport,
            bodyPhysicsLinks: mappedBodyPhysicsLinks,
        });
    }

    function mapParameterSupport(
        summary: RuntimeParameterSupportSummary | null | undefined,
    ): Live2DParameterSupportSummary {
        return (
            summary ?? {
                head: {
                    x: {
                        canonicalId: "ParamAngleX",
                        resolvedId: null,
                        supported: false,
                    },
                    y: {
                        canonicalId: "ParamAngleY",
                        resolvedId: null,
                        supported: false,
                    },
                    z: {
                        canonicalId: "ParamAngleZ",
                        resolvedId: null,
                        supported: false,
                    },
                },
                body: {
                    x: {
                        canonicalId: "ParamBodyAngleX",
                        resolvedId: null,
                        supported: false,
                    },
                    y: {
                        canonicalId: "ParamBodyAngleY",
                        resolvedId: null,
                        supported: false,
                    },
                    z: {
                        canonicalId: "ParamBodyAngleZ",
                        resolvedId: null,
                        supported: false,
                    },
                },
            }
        );
    }

    function hasMissingParameterSupport(
        summary: Live2DParameterSupportSummary,
    ): boolean {
        return [
            summary.head.x,
            summary.head.y,
            summary.head.z,
            summary.body.x,
            summary.body.y,
            summary.body.z,
        ].some((slot) => !slot.supported);
    }

    function summarizeMotionGroups(settings: any) {
        const motions = getMotionGroups(settings);
        if (!motions || typeof motions !== "object") return {};
        const summary: Record<string, string[]> = {};
        Object.entries(motions).forEach(([group, entries]: [string, any]) => {
            summary[group] = Array.isArray(entries)
                ? entries.map(
                      (entry) =>
                          entry?.File || entry?.file || "(no file)",
                  )
                : [];
        });
        return summary;
    }

    function summarizeExpressions(settings: any) {
        const expressions = getExpressionEntries(settings);
        if (!Array.isArray(expressions)) return [];
        return expressions.map((entry: any) => ({
            name: entry?.name || entry?.Name || null,
            file: entry?.file || entry?.File || null,
        }));
    }

    function getRawSettingsJson(settings: any) {
        if (settings?.json && typeof settings.json === "object") return settings.json;
        if (settings?._json && typeof settings._json === "object") return settings._json;
        return null;
    }

    function getExpressionEntries(settings: any): any[] {
        const rawJson = getRawSettingsJson(settings);
        const entries =
            settings?.FileReferences?.Expressions ||
            rawJson?.FileReferences?.Expressions ||
            settings?.expressions ||
            rawJson?.expressions;
        return Array.isArray(entries) ? entries : [];
    }

    function getMotionGroups(settings: any): Record<string, any[]> | null {
        const rawJson = getRawSettingsJson(settings);
        const motions =
            settings?.FileReferences?.Motions ||
            rawJson?.FileReferences?.Motions ||
            settings?.motions ||
            rawJson?.motions;
        return motions && typeof motions === "object" ? motions : null;
    }

    function getHitAreas(settings: any): any[] {
        const rawJson = getRawSettingsJson(settings);
        const hitAreas =
            settings?.HitAreas ||
            settings?.hitAreas ||
            rawJson?.HitAreas ||
            rawJson?.hitAreas;
        return Array.isArray(hitAreas) ? hitAreas : [];
    }

    function getGroups(settings: any): any[] {
        const rawJson = getRawSettingsJson(settings);
        const groups =
            settings?.Groups ||
            settings?.groups ||
            rawJson?.Groups ||
            rawJson?.groups;
        return Array.isArray(groups) ? groups : [];
    }

    function getLayout(settings: any) {
        const rawJson = getRawSettingsJson(settings);
        return (
            settings?.Layout ||
            settings?.layout ||
            rawJson?.Layout ||
            rawJson?.layout ||
            null
        );
    }

    function buildDiagnostics(
        model: any,
        parameterSupport: Live2DParameterSupportSummary,
        bodyPhysicsLinks: Live2DBodyPhysicsLinkSummary,
    ) {
        const internal = model?.internalModel;
        const core = internal?.coreModel;
        const settings = internal?.settings;
        const parameterIds = Array.isArray(core?._parameterIds)
            ? [...core._parameterIds]
            : [];

        return {
            modelUrl,
            parameterSupport,
            bodyPhysicsLinks,
            parameterCount: parameterIds.length,
            parameterIds,
            motions: summarizeMotionGroups(settings),
            expressions: summarizeExpressions(settings),
            hitAreas: getHitAreas(settings),
            groups: getGroups(settings),
            layout: getLayout(settings),
            rawSettings: settings || null,
            rawModelJson: getRawSettingsJson(settings),
            internalModelKeys: internal ? Object.keys(internal) : [],
        };
    }

    function logDiagnostics(
        model: any,
        parameterSupport: Live2DParameterSupportSummary,
        bodyPhysicsLinks: Live2DBodyPhysicsLinkSummary,
        reason: string,
    ) {
        const diagnostics = buildDiagnostics(
            model,
            parameterSupport,
            bodyPhysicsLinks,
        );
        console.groupCollapsed(
            `[Live2D Advanced Diagnostics] ${reason}: ${modelUrl || "(unknown model)"}`,
        );
        console.warn("Parameter support issue detected.", diagnostics);
        console.log("Body physics links:", diagnostics.bodyPhysicsLinks);
        console.log("All parameter IDs:", diagnostics.parameterIds);
        console.log("Motion groups:", diagnostics.motions);
        console.log("Expressions:", diagnostics.expressions);
        console.log("Hit areas:", diagnostics.hitAreas);
        console.log("Groups:", diagnostics.groups);
        console.log("Layout:", diagnostics.layout);
        console.log("Raw model json:", diagnostics.rawModelJson);
        console.log("Raw settings:", diagnostics.rawSettings);
        console.groupEnd();
    }

    // --- Public API for Parent Sandbox ---

    export function triggerExpression(exprName: string) {
        if (!currentModel) return;
        currentModel.expression(exprName);
    }

    export async function triggerMotion(
        group: string,
        index: number,
        file?: string,
    ) {
        if (!currentModel) return;
        try {
            const audioApi = SafeAudioManager as any;
            const audioSnapshot =
                typeof audioApi.getPlaybackSnapshot === "function"
                    ? audioApi.getPlaybackSnapshot()
                    : null;

            let resolvedGroup = group;
            let resolvedIndex = index;

            if (file) {
                const byFile =
                    motionControl.findMotionByFile(file) ||
                    motionControl.findMotionByFile(file.split("/").pop() || file);
                if (byFile) {
                    resolvedGroup = byFile.group;
                    resolvedIndex = byFile.index;
                }
            }

            if (!resolvedGroup && resolvedGroup !== "") return;

            let motionResult = motionControl.playMotion(
                resolvedGroup,
                resolvedIndex,
                3,
            );
            if (
                motionResult === undefined &&
                typeof currentModel.motion === "function"
            ) {
                motionResult = currentModel.motion(
                    resolvedGroup,
                    resolvedIndex,
                    3,
                );
            }

            const tryResume = async () => {
                if (
                    audioSnapshot &&
                    typeof audioApi.resumeFromSnapshotIfInterrupted ===
                        "function"
                ) {
                    await audioApi.resumeFromSnapshotIfInterrupted(audioSnapshot);
                }
            };

            if (motionResult && typeof motionResult.then === "function") {
                try {
                    await motionResult;
                } catch (e) {
                    console.warn("Motion play failed:", e);
                }
                await tryResume();
                return;
            }

            setTimeout(() => {
                tryResume();
            }, 900);
            setTimeout(() => {
                tryResume();
            }, 1600);
            setTimeout(() => {
                tryResume();
            }, 2400);
        } catch (e) {
            console.error("triggerMotion failed before playback:", e);
        }
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

    export function setEmotion(emotion: string) {
        autonomy?.setEmotion(emotion as any);
    }

    export function playGesture(gesture: string) {
        autonomy?.playGesture(gesture as any);
    }

    export function setSensitivity(value: number) {
        autonomy?.setSensitivity(value);
    }

    export function setHeadCalibration(
        config: Partial<{
            angleYGain: number;
            angleYOffset: number;
            angleYMin: number;
            angleYMax: number;
            angleZGain: number;
            angleZOffset: number;
            angleZMin: number;
            angleZMax: number;
        }>,
    ) {
        headCalibration = {
            ...headCalibration,
            ...config,
        };
        autonomy?.setHeadCalibration(headCalibration);
    }

    export function setBodyCalibration(
        config: Partial<{
            bodyXGain: number;
            bodyYGain: number;
            bodyZGain: number;
            bodyXOffset: number;
            bodyYOffset: number;
            bodyZOffset: number;
            bodyXMin: number;
            bodyXMax: number;
            bodyYMin: number;
            bodyYMax: number;
            bodyZMin: number;
            bodyZMax: number;
        }>,
    ) {
        bodyCalibration = {
            ...bodyCalibration,
            ...config,
        };
        autonomy?.setBodyCalibration(bodyCalibration);
    }
</script>

<div
    class="viewer-container"
    class:dragging={isDragging}
    class:interactive={!!currentModel}
    bind:this={canvasContainer}
>
    {#if currentModel && !hasInteracted}
        <div class="interaction-hint">
            Drag the model to test head/body sensitivity
        </div>
    {/if}
</div>

<style>
    .viewer-container {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
    }

    .viewer-container.interactive {
        cursor: grab;
    }

    .viewer-container.dragging {
        cursor: grabbing;
    }

    .interaction-hint {
        position: absolute;
        left: 50%;
        bottom: 1.5rem;
        transform: translateX(-50%);
        padding: 0.65rem 0.9rem;
        border-radius: 999px;
        background: rgba(17, 17, 17, 0.78);
        border: 1px solid rgba(255, 255, 255, 0.14);
        color: rgba(255, 255, 255, 0.88);
        font-size: 0.8rem;
        letter-spacing: 0.01em;
        pointer-events: none;
        z-index: 2;
        backdrop-filter: blur(8px);
    }

    :global(canvas) {
        display: block;
        width: 100%;
        height: 100%;
    }
</style>

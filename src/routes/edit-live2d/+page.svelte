<script lang="ts">
    import { goto } from "$app/navigation";
    import { onDestroy, onMount, tick } from "svelte";
    import Icon from "@iconify/svelte";
    import PxlAdvancedViewer from "$lib/components/live2d/PxlAdvancedViewer.svelte";
    import type { Live2DMotionInfo } from "$lib/components/live2d/PxlAdvancedViewer.svelte";
    import { toast } from "$lib/stores/toast";
    import { page } from "$app/stores";
    import { loadPersonaOriginal } from "$lib/api/edit_persona";
    import type { Persona } from "$lib/types";

    let persona: Persona | null = null;
    let isLoading = false;
    let returnPath = "/edit3";

    const LIVE2D_EDITOR_BRIDGE_PREFIX = "live2d_editor_config_bridge:";

    let modelUrl = "";
    let renderViewer = false;
    let viewerKey = 0;

    let availableExpressions: string[] = [];
    let availableMotions: Live2DMotionInfo[] = [];

    // Sandbox Mapping State
    interface Pxl2DMapping {
        modelUrl: string;
        motions: Record<string, { file: string; alias: string; category: string }>;
        expressions: Record<string, string>;
        expressionAliases: Record<string, string>;
        settings: {
            scale: number;
            x: number;
            y: number;
            offsetY: number;
            sensitivity: number;
            angleYGain: number;
            angleYOffset: number;
            angleYMin: number;
            angleYMax: number;
            angleZGain: number;
            angleZOffset: number;
            angleZMin: number;
            angleZMax: number;
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
        };
    }

    let pxlState: Pxl2DMapping = {
        modelUrl: "",
        motions: {},
        expressions: {},
        expressionAliases: {},
        settings: {
            scale: 0.12,
            x: 0,
            y: 0,
            offsetY: 0,
            sensitivity: 1.0,
            angleYGain: 1.0,
            angleYOffset: 0,
            angleYMin: -90,
            angleYMax: 90,
            angleZGain: 1.0,
            angleZOffset: 0,
            angleZMin: -90,
            angleZMax: 90,
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
        },
    };

    interface UploadedAudioItem {
        id: string;
        name: string;
        url: string;
    }
    let uploadedAudios: UploadedAudioItem[] = [];

    let viewerRef: any;

    let activeTab:
        | "motions"
        | "expressions"
        | "audio"
        | "runtime"
        | "mapping" = "motions";

    const emotionMapKeys = [
        "ELATED",
        "GENTLE",
        "STERN",
        "DEPRESSED",
        "TENSE",
        "ASTONISHED",
        "CALM",
    ] as const;
    type EmotionMapKey = (typeof emotionMapKeys)[number];
    type SceneMotionItem = { name: string; file: string; desc: string };
    let sceneExpressionMap: Record<EmotionMapKey, string> = {
        ELATED: "",
        GENTLE: "",
        STERN: "",
        DEPRESSED: "",
        TENSE: "",
        ASTONISHED: "",
        CALM: "",
    };
    let scenePermanentExpressions: string[] = [];
    let sceneMotionList: SceneMotionItem[] = [];

    const emotionOptions = [
        "CALM",
        "GENTLE",
        "ELATED",
        "STERN",
        "DEPRESSED",
        "TENSE",
        "ASTONISHED",
        "SLEEP",
    ];

    const gestureOptions = [
        "NOD",
        "SHAKE",
        "TILT",
        "FIDGET",
        "SIGH",
        "LOOK_DOWN",
        "CLOSE_EYES",
        "WINK",
        "STICK_TONGUE",
        "SQUINT",
        "LOOK_UP_THINK",
        "FLINCH",
        "PANT",
    ];

    function normalizePxlState(raw: any): Pxl2DMapping {
        const normalizedMotions: Record<
            string,
            { file: string; alias: string; category: string }
        > = {};
        if (raw?.motions && typeof raw.motions === "object") {
            Object.entries(raw.motions).forEach(([key, value]: [string, any]) => {
                if (!value || typeof value !== "object") return;
                const file =
                    typeof value.file === "string"
                        ? value.file
                        : typeof value.alias === "string"
                          ? value.alias
                          : "";
                normalizedMotions[key] = {
                    file,
                    alias:
                        typeof value.alias === "string" && value.alias.trim()
                            ? value.alias
                            : file,
                    category:
                        typeof value.category === "string" ? value.category : "",
                };
            });
        }

        return {
            modelUrl: typeof raw?.modelUrl === "string" ? raw.modelUrl : "",
            motions: normalizedMotions,
            expressions:
                raw?.expressions && typeof raw.expressions === "object"
                    ? raw.expressions
                    : {},
            expressionAliases:
                raw?.expressionAliases &&
                typeof raw.expressionAliases === "object"
                    ? raw.expressionAliases
                    : {},
            settings: {
                scale:
                    typeof raw?.settings?.scale === "number"
                        ? raw.settings.scale
                        : 0.12,
                x: typeof raw?.settings?.x === "number" ? raw.settings.x : 0,
                y: typeof raw?.settings?.y === "number" ? raw.settings.y : 0,
                offsetY:
                    typeof raw?.settings?.offsetY === "number"
                        ? raw.settings.offsetY
                        : 0,
                sensitivity:
                    typeof raw?.settings?.sensitivity === "number"
                        ? raw.settings.sensitivity
                        : 1.0,
                angleYGain:
                    typeof raw?.settings?.angleYGain === "number"
                        ? raw.settings.angleYGain
                        : 1.0,
                angleYOffset:
                    typeof raw?.settings?.angleYOffset === "number"
                        ? raw.settings.angleYOffset
                        : 0,
                angleYMin:
                    typeof raw?.settings?.angleYMin === "number"
                        ? raw.settings.angleYMin
                        : -90,
                angleYMax:
                    typeof raw?.settings?.angleYMax === "number"
                        ? raw.settings.angleYMax
                        : 90,
                angleZGain:
                    typeof raw?.settings?.angleZGain === "number"
                        ? raw.settings.angleZGain
                        : 1.0,
                angleZOffset:
                    typeof raw?.settings?.angleZOffset === "number"
                        ? raw.settings.angleZOffset
                        : 0,
                angleZMin:
                    typeof raw?.settings?.angleZMin === "number"
                        ? raw.settings.angleZMin
                        : -90,
                angleZMax:
                    typeof raw?.settings?.angleZMax === "number"
                        ? raw.settings.angleZMax
                        : 90,
                bodyXGain:
                    typeof raw?.settings?.bodyXGain === "number"
                        ? raw.settings.bodyXGain
                        : 1.0,
                bodyYGain:
                    typeof raw?.settings?.bodyYGain === "number"
                        ? raw.settings.bodyYGain
                        : 1.0,
                bodyZGain:
                    typeof raw?.settings?.bodyZGain === "number"
                        ? raw.settings.bodyZGain
                        : 1.0,
                bodyXOffset:
                    typeof raw?.settings?.bodyXOffset === "number"
                        ? raw.settings.bodyXOffset
                        : 0,
                bodyYOffset:
                    typeof raw?.settings?.bodyYOffset === "number"
                        ? raw.settings.bodyYOffset
                        : 0,
                bodyZOffset:
                    typeof raw?.settings?.bodyZOffset === "number"
                        ? raw.settings.bodyZOffset
                        : 0,
                bodyXMin:
                    typeof raw?.settings?.bodyXMin === "number"
                        ? raw.settings.bodyXMin
                        : -90,
                bodyXMax:
                    typeof raw?.settings?.bodyXMax === "number"
                        ? raw.settings.bodyXMax
                        : 90,
                bodyYMin:
                    typeof raw?.settings?.bodyYMin === "number"
                        ? raw.settings.bodyYMin
                        : -90,
                bodyYMax:
                    typeof raw?.settings?.bodyYMax === "number"
                        ? raw.settings.bodyYMax
                        : 90,
                bodyZMin:
                    typeof raw?.settings?.bodyZMin === "number"
                        ? raw.settings.bodyZMin
                        : -90,
                bodyZMax:
                    typeof raw?.settings?.bodyZMax === "number"
                        ? raw.settings.bodyZMax
                        : 90,
            },
        };
    }

    function getBridgeKey(id: string) {
        return `${LIVE2D_EDITOR_BRIDGE_PREFIX}${id}`;
    }

    function saveBridgeConfigAndReturn() {
        const personaId = persona?.id || $page.url.searchParams.get("c") || "";
        if (!personaId) {
            toast.error("Persona ID not found");
            return;
        }

        const payload = {
            version: 1,
            updatedAt: Date.now(),
            config: pxlState,
            sceneFields: {
                expression_map: sceneExpressionMap,
                motion_list: sceneMotionList,
                permanent_expressions: scenePermanentExpressions,
                // backward-compatible keys
                live2d_expression_map: sceneExpressionMap,
                live2d_motion_list: sceneMotionList,
                live2d_permanent_expressions: scenePermanentExpressions,
            },
        };
        localStorage.setItem(getBridgeKey(personaId), JSON.stringify(payload));
        toast.success("Live2D settings saved");
        goto(returnPath);
    }

    function goBackWithoutSaving() {
        goto(returnPath);
    }

    function playExpression(expr: string) {
        if (viewerRef) viewerRef.triggerExpression(expr);
    }

    function playMotion(group: string, index: number, file?: string) {
        if (viewerRef) {
            console.log("Debug: Triggering", group, index, file || "");
            viewerRef.triggerMotion(group, index, file);
        }
    }

    function setRuntimeEmotion(emotion: string) {
        if (viewerRef) viewerRef.setEmotion(emotion);
    }

    function playRuntimeGesture(gesture: string) {
        if (viewerRef) viewerRef.playGesture(gesture);
    }

    function applySensitivity(value: number) {
        const clamped = Math.max(0.1, Math.min(2.0, value));
        pxlState.settings.sensitivity = clamped;
        pxlState = pxlState;
        if (viewerRef) viewerRef.setSensitivity(clamped);
    }

    function applyHeadCalibration() {
        if (!viewerRef) return;
        viewerRef.setHeadCalibration({
            angleYGain: pxlState.settings.angleYGain,
            angleYOffset: pxlState.settings.angleYOffset,
            angleYMin: pxlState.settings.angleYMin,
            angleYMax: pxlState.settings.angleYMax,
            angleZGain: pxlState.settings.angleZGain,
            angleZOffset: pxlState.settings.angleZOffset,
            angleZMin: pxlState.settings.angleZMin,
            angleZMax: pxlState.settings.angleZMax,
        });
    }

    function applyBodyCalibration() {
        if (!viewerRef) return;
        viewerRef.setBodyCalibration({
            bodyXGain: pxlState.settings.bodyXGain,
            bodyYGain: pxlState.settings.bodyYGain,
            bodyZGain: pxlState.settings.bodyZGain,
            bodyXOffset: pxlState.settings.bodyXOffset,
            bodyYOffset: pxlState.settings.bodyYOffset,
            bodyZOffset: pxlState.settings.bodyZOffset,
            bodyXMin: pxlState.settings.bodyXMin,
            bodyXMax: pxlState.settings.bodyXMax,
            bodyYMin: pxlState.settings.bodyYMin,
            bodyYMax: pxlState.settings.bodyYMax,
            bodyZMin: pxlState.settings.bodyZMin,
            bodyZMax: pxlState.settings.bodyZMax,
        });
    }

    function applyCalibrationField(
        key:
            | "angleYGain"
            | "angleYOffset"
            | "angleYMin"
            | "angleYMax"
            | "angleZGain"
            | "angleZOffset"
            | "angleZMin"
            | "angleZMax",
        value: number,
    ) {
        pxlState.settings[key] = value;

        if (pxlState.settings.angleYMin > pxlState.settings.angleYMax) {
            const tmp = pxlState.settings.angleYMin;
            pxlState.settings.angleYMin = pxlState.settings.angleYMax;
            pxlState.settings.angleYMax = tmp;
        }
        if (pxlState.settings.angleZMin > pxlState.settings.angleZMax) {
            const tmp = pxlState.settings.angleZMin;
            pxlState.settings.angleZMin = pxlState.settings.angleZMax;
            pxlState.settings.angleZMax = tmp;
        }

        pxlState = pxlState;
        applyHeadCalibration();
    }

    function applyBodyCalibrationField(
        key:
            | "bodyXGain"
            | "bodyYGain"
            | "bodyZGain"
            | "bodyXOffset"
            | "bodyYOffset"
            | "bodyZOffset"
            | "bodyXMin"
            | "bodyXMax"
            | "bodyYMin"
            | "bodyYMax"
            | "bodyZMin"
            | "bodyZMax",
        value: number,
    ) {
        pxlState.settings[key] = value;

        if (pxlState.settings.bodyXMin > pxlState.settings.bodyXMax) {
            const tmp = pxlState.settings.bodyXMin;
            pxlState.settings.bodyXMin = pxlState.settings.bodyXMax;
            pxlState.settings.bodyXMax = tmp;
        }
        if (pxlState.settings.bodyYMin > pxlState.settings.bodyYMax) {
            const tmp = pxlState.settings.bodyYMin;
            pxlState.settings.bodyYMin = pxlState.settings.bodyYMax;
            pxlState.settings.bodyYMax = tmp;
        }
        if (pxlState.settings.bodyZMin > pxlState.settings.bodyZMax) {
            const tmp = pxlState.settings.bodyZMin;
            pxlState.settings.bodyZMin = pxlState.settings.bodyZMax;
            pxlState.settings.bodyZMax = tmp;
        }

        pxlState = pxlState;
        applyBodyCalibration();
    }

    async function playAudioUrl(audioUrl: string) {
        if (!viewerRef) {
            toast.error("Model not loaded");
            return;
        }
        try {
            await viewerRef.speak(audioUrl);
        } catch (err) {
            toast.error("Audio playback error");
            console.error(err);
        }
    }

    function addAudioFiles(files: FileList | null) {
        if (!files || files.length === 0) return;

        const nextItems: UploadedAudioItem[] = [];
        Array.from(files).forEach((file) => {
            const blobUrl = URL.createObjectURL(file);
            nextItems.push({
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                name: file.name,
                url: blobUrl,
            });
        });

        uploadedAudios = [...uploadedAudios, ...nextItems];
        toast.success(`${nextItems.length} audio file(s) added`);
    }

    function removeUploadedAudio(id: string) {
        const target = uploadedAudios.find((item) => item.id === id);
        if (target) {
            URL.revokeObjectURL(target.url);
        }
        uploadedAudios = uploadedAudios.filter((item) => item.id !== id);
    }

    async function load_persona(id: string) {
        isLoading = true;
        try {
            const p = await loadPersonaOriginal(id);
            persona = p;
            loadSceneFieldsFromPersona(p);
            const bridgeRaw = localStorage.getItem(getBridgeKey(id));
            if (bridgeRaw) {
                try {
                    const bridge = JSON.parse(bridgeRaw);
                    if (bridge?.config) {
                        pxlState = normalizePxlState(bridge.config);
                    }
                    if (bridge?.sceneFields && typeof bridge.sceneFields === "object") {
                        const sf = bridge.sceneFields;
                        if (sf.live2d_expression_map && typeof sf.live2d_expression_map === "object") {
                            sceneExpressionMap = {
                                ...sceneExpressionMap,
                                ...sf.live2d_expression_map,
                            };
                        }
                        if (Array.isArray(sf.live2d_motion_list)) {
                            sceneMotionList = sf.live2d_motion_list.filter(
                                (m: any) => m && typeof m === "object",
                            );
                        }
                        if (Array.isArray(sf.live2d_permanent_expressions)) {
                            scenePermanentExpressions =
                                sf.live2d_permanent_expressions.filter(
                                    (v: any) => typeof v === "string",
                                );
                        }
                    }
                } catch (e) {
                    console.warn("Failed to parse local bridge data", e);
                }
            }

            if (p.live2d_model_url) {
                modelUrl = p.live2d_model_url;
                pxlState.modelUrl = modelUrl;
                renderViewer = false;
                viewerKey++;
                setTimeout(() => (renderViewer = true), 50);
            } else {
                toast.warning("This Persona does not have a Live2D URL.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load Persona.");
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        const returnQuery = $page.url.searchParams.get("return");
        if (returnQuery && returnQuery.trim()) {
            returnPath = returnQuery;
        }

        const id = $page.url.searchParams.get("c");
        if (id) {
            load_persona(id);
        }
    });

    function assignExpression(expr: string, emotion: string) {
        for (const [key, val] of Object.entries(sceneExpressionMap)) {
            if (val === expr) {
                sceneExpressionMap[key as EmotionMapKey] = "";
            }
        }
        if (emotion) {
            sceneExpressionMap[emotion as EmotionMapKey] = expr;
        }
        pxlState.expressions = { ...sceneExpressionMap };
        pxlState = pxlState;
    }

    function isMappedTo(expr: string, emotion: string): boolean {
        return sceneExpressionMap[emotion as EmotionMapKey] === expr;
    }

    function getExpressionAlias(expr: string): string {
        return pxlState.expressionAliases[expr] ?? expr;
    }

    function setExpressionAlias(expr: string, alias: string) {
        pxlState.expressionAliases[expr] = alias.trim() || expr;
        pxlState = pxlState;
    }

    function getMotionKey(m: Live2DMotionInfo) {
        return `${m.group}_${m.index}`;
    }

    function normalizeMotionFileKey(file: string): string {
        return (file.split("/").pop() || file).toLowerCase();
    }

    function getMotionAliasByFile(file: string): string {
        const normalized = normalizeMotionFileKey(file);
        for (const value of Object.values(pxlState.motions)) {
            if (!value?.file) continue;
            if (normalizeMotionFileKey(value.file) !== normalized) continue;
            const alias = (value.alias || "").trim();
            if (alias && alias !== value.file) return alias;
            return value.file.split("/").pop() || value.file;
        }
        return file.split("/").pop() || file;
    }

    function getExpressionDisplayName(expr: string): string {
        return getExpressionAlias(expr) || expr;
    }

    function addSceneMotion() {
        const firstMotion = availableMotions[0]?.file || "";
        const firstExpr = availableExpressions[0] || "";
        const defaultFile = firstMotion || firstExpr;
        sceneMotionList = [...sceneMotionList, { name: "", file: defaultFile, desc: "" }];
    }

    function removeSceneMotion(index: number) {
        sceneMotionList = sceneMotionList.filter((_, i) => i !== index);
    }

    function toggleScenePermanentExpression(expr: string) {
        if (scenePermanentExpressions.includes(expr)) {
            scenePermanentExpressions = scenePermanentExpressions.filter((e) => e !== expr);
        } else {
            scenePermanentExpressions = [...scenePermanentExpressions, expr];
        }
    }

    function loadSceneFieldsFromPersona(p: Persona) {
        let cfg: any = null;
        if (p.live2d_config && typeof p.live2d_config === "object") {
            cfg = p.live2d_config;
        } else if (typeof p.live2d_config === "string") {
            try {
                cfg = JSON.parse(p.live2d_config);
            } catch {
                cfg = null;
            }
        }
        if (cfg) {
            const expressionMap =
                cfg.expression_map && typeof cfg.expression_map === "object"
                    ? cfg.expression_map
                    : cfg.live2d_expression_map &&
                        typeof cfg.live2d_expression_map === "object"
                      ? cfg.live2d_expression_map
                      : null;
            if (expressionMap) {
                sceneExpressionMap = {
                    ...sceneExpressionMap,
                    ...expressionMap,
                };
            }

            const motionList = Array.isArray(cfg.motion_list)
                ? cfg.motion_list
                : Array.isArray(cfg.live2d_motion_list)
                  ? cfg.live2d_motion_list
                  : null;
            if (motionList) {
                sceneMotionList = motionList.filter(
                    (m: any) => m && typeof m === "object",
                );
            }

            const permanentExpressions = Array.isArray(cfg.permanent_expressions)
                ? cfg.permanent_expressions
                : Array.isArray(cfg.live2d_permanent_expressions)
                  ? cfg.live2d_permanent_expressions
                  : null;
            if (permanentExpressions) {
                scenePermanentExpressions = permanentExpressions.filter(
                    (v: any) => typeof v === "string",
                );
            }

            const editorConfig =
                cfg.editor_config && typeof cfg.editor_config === "object"
                    ? cfg.editor_config
                    : cfg.live2d_editor_config &&
                        typeof cfg.live2d_editor_config === "object"
                      ? cfg.live2d_editor_config
                      : null;
            if (editorConfig) {
                pxlState = normalizePxlState(editorConfig);
            }
        }

        if (!p.first_scene?.trim()) return;
        try {
            const obj = JSON.parse(p.first_scene);
            if (obj?.live2d_expression_map && typeof obj.live2d_expression_map === "object") {
                sceneExpressionMap = {
                    ...sceneExpressionMap,
                    ...obj.live2d_expression_map,
                };
            }
            if (Array.isArray(obj?.live2d_motion_list)) {
                sceneMotionList = obj.live2d_motion_list.filter((m: any) => m && typeof m === "object");
            }
            if (Array.isArray(obj?.live2d_permanent_expressions)) {
                scenePermanentExpressions = obj.live2d_permanent_expressions.filter(
                    (v: any) => typeof v === "string",
                );
            }
            if (obj?.live2d_editor_config && typeof obj.live2d_editor_config === "object") {
                pxlState = normalizePxlState(obj.live2d_editor_config);
            }
        } catch {
            // Keep editor defaults when first_scene is not JSON
        }
    }

    onDestroy(() => {
        uploadedAudios.forEach((audio) => URL.revokeObjectURL(audio.url));
    });
</script>

<div class="sandbox-container">
    <!-- Left Panel: Purely for the Viewer -->
    <div class="center-panel">
        {#if renderViewer}
            {#key viewerKey}
                <div class="viewer-wrapper">
                    <PxlAdvancedViewer
                        bind:this={viewerRef}
                        {modelUrl}
                        scale={pxlState.settings.scale}
                        onMetadataLoaded={(detail) => {
                            availableExpressions = detail.expressions;
                            availableMotions = detail.motions;

                            // Initialize state slots for new motions
                            availableMotions.forEach((m: any) => {
                                const key = getMotionKey(m);
                                if (!pxlState.motions[key]) {
                                    pxlState.motions[key] = {
                                        file: m.file,
                                        alias: m.file, // Start via setting alias as the filename
                                        category: "",
                                    };
                                } else if (!pxlState.motions[key].file) {
                                    pxlState.motions[key].file = m.file;
                                }
                            });
                            availableExpressions.forEach((expr: string) => {
                                if (!pxlState.expressionAliases[expr]) {
                                    pxlState.expressionAliases[expr] = expr;
                                }
                            });
                            pxlState.expressions = { ...sceneExpressionMap };
                            viewerRef?.setSensitivity(
                                pxlState.settings.sensitivity,
                            );
                            applyHeadCalibration();
                            applyBodyCalibration();
                            pxlState = pxlState; // reactivity
                        }}
                    />
                </div>
            {/key}
        {/if}
    </div>

    <!-- Right Panel: All Controls Consolidated -->
    <div class="control-panel">
        <div class="panel-header">
            <div class="header-top">
                <h2>Advanced Live2D Editor</h2>
                <div class="header-actions">
                    <button class="secondary" on:click={goBackWithoutSaving}
                        >Back</button
                    >
                    <button on:click={saveBridgeConfigAndReturn}
                        >Save & Return</button
                    >
                </div>
            </div>
            {#if isLoading}
                <div class="loading-state">Loading Persona Data...</div>
            {:else if persona}
                <div class="persona-info">
                    <div class="p-name">{persona.name}</div>
                    <span class="type-badge">{persona.personaType}</span>
                </div>
            {/if}
        </div>

        <div class="tabs">
            <button
                class="tab {activeTab === 'motions' ? 'active' : ''}"
                on:click={() => (activeTab = "motions")}>Motions</button
            >
            <button
                class="tab {activeTab === 'expressions' ? 'active' : ''}"
                on:click={() => (activeTab = "expressions")}>Expr</button
            >
            <button
                class="tab {activeTab === 'mapping' ? 'active' : ''}"
                on:click={() => (activeTab = "mapping")}>AI Map</button
            >
            <button
                class="tab {activeTab === 'audio' ? 'active' : ''}"
                on:click={() => (activeTab = "audio")}>Audio</button
            >
            <button
                class="tab {activeTab === 'runtime' ? 'active' : ''}"
                on:click={() => (activeTab = "runtime")}>Runtime</button
            >
        </div>

        <div class="tab-content">
            {#if activeTab === "motions"}
                <div class="list">
                    {#if availableMotions.length === 0}
                        <p class="empty-msg">
                            No motions found or model not loaded.
                        </p>
                    {/if}
                    {#each availableMotions as motion}
                        <div class="asset-item">
                            <div class="asset-info">
                                <span class="filename" title={motion.file}
                                    >{motion.group} [{motion.index}]</span
                                >
                                <button
                                    class="play-btn"
                                    on:click={() =>
                                        playMotion(
                                            motion.group,
                                            motion.index,
                                            motion.file,
                                        )}
                                    >▶ Play</button
                                >
                            </div>
                            <div class="mapping-inputs">
                                <input
                                    type="text"
                                    placeholder="Alias (e.g. idle_happy)"
                                    bind:value={
                                        pxlState.motions[getMotionKey(motion)]
                                            .alias
                                    }
                                />
                                <select
                                    bind:value={
                                        pxlState.motions[getMotionKey(motion)]
                                            .category
                                    }
                                >
                                    <option value="">No Category</option>
                                    <option value="idle">Idle</option>
                                    <option value="reaction">Reaction</option>
                                    <option value="special">Special</option>
                                </select>
                            </div>
                        </div>
                    {/each}
                </div>
            {:else if activeTab === "expressions"}
                <div class="list">
                    {#if availableExpressions.length === 0}
                        <p class="empty-msg">
                            No expressions found or model not loaded.
                        </p>
                    {/if}
                    {#each availableExpressions as expr}
                        <div class="asset-item">
                            <div class="asset-info">
                                <span class="filename" title={expr}>{expr}</span
                                >
                                <button
                                    class="play-btn"
                                    on:click={() => playExpression(expr)}
                                    >▶ Play</button
                                >
                            </div>
                            <div class="mapping-inputs align-center">
                                <input
                                    type="text"
                                    placeholder="Alias (e.g. smile_soft)"
                                    value={getExpressionAlias(expr)}
                                    on:input={(e) =>
                                        setExpressionAlias(
                                            expr,
                                            e.currentTarget.value,
                                        )}
                                />
                                <span class="label">Emotion:</span>
                                <select
                                    on:change={(e) =>
                                        assignExpression(
                                            expr,
                                            e.currentTarget.value,
                                        )}
                                >
                                    <option
                                        value=""
                                        selected={!Object.values(sceneExpressionMap).includes(expr)}
                                        >Unmapped</option
                                    >
                                    <option
                                        value="ELATED"
                                        selected={isMappedTo(expr, "ELATED")}
                                        >ELATED</option
                                    >
                                    <option
                                        value="GENTLE"
                                        selected={isMappedTo(expr, "GENTLE")}
                                        >GENTLE</option
                                    >
                                    <option
                                        value="STERN"
                                        selected={isMappedTo(expr, "STERN")}
                                        >STERN</option
                                    >
                                    <option
                                        value="DEPRESSED"
                                        selected={isMappedTo(expr, "DEPRESSED")}
                                        >DEPRESSED</option
                                    >
                                    <option
                                        value="TENSE"
                                        selected={isMappedTo(expr, "TENSE")}
                                        >TENSE</option
                                    >
                                    <option
                                        value="ASTONISHED"
                                        selected={isMappedTo(expr, "ASTONISHED")}
                                        >ASTONISHED</option
                                    >
                                    <option
                                        value="CALM"
                                        selected={isMappedTo(expr, "CALM")}
                                        >CALM</option
                                    >
                                </select>
                            </div>
                        </div>
                    {/each}
                </div>
            {:else if activeTab === "mapping"}
                <div class="settings-panel">
                    <div class="runtime-section">
                        <h4>Expression Mapping</h4>
                        <div class="calib-grid">
                            {#each emotionMapKeys as emotion}
                                <label class="calib-item">
                                    <span>{emotion}</span>
                                    <select
                                        value={sceneExpressionMap[emotion]}
                                        on:change={(e) =>
                                            assignExpression(
                                                e.currentTarget.value,
                                                emotion,
                                            )}
                                    >
                                        <option value="">(None)</option>
                                        {#each availableExpressions as expr}
                                            <option value={expr}
                                                >{getExpressionDisplayName(
                                                    expr,
                                                )}</option
                                            >
                                        {/each}
                                    </select>
                                </label>
                            {/each}
                        </div>
                    </div>

                    <div class="runtime-section">
                        <h4>Permanent Expressions</h4>
                        <div class="list">
                            {#each availableExpressions as expr}
                                <label class="asset-item">
                                    <input
                                        type="checkbox"
                                        checked={scenePermanentExpressions.includes(expr)}
                                        on:change={() =>
                                            toggleScenePermanentExpression(
                                                expr,
                                            )}
                                    />
                                    <span class="filename"
                                        >{getExpressionDisplayName(expr)}</span
                                    >
                                </label>
                            {/each}
                        </div>
                    </div>

                    <div class="runtime-section">
                        <div class="asset-info">
                            <h4>Animation List</h4>
                            <button class="secondary" on:click={addSceneMotion}
                                >+ Add</button
                            >
                        </div>
                        <div class="list">
                            {#each sceneMotionList as item, i}
                                <div class="asset-item">
                                    <div class="mapping-inputs">
                                        <input
                                            type="text"
                                            placeholder="Name"
                                            bind:value={item.name}
                                        />
                                        <select bind:value={item.file}>
                                            <option value="">Select Action</option>
                                            {#if availableMotions.length > 0}
                                                <optgroup label="Motions">
                                                    {#each availableMotions as motion}
                                                        <option value={motion.file}
                                                            >{getMotionAliasByFile(
                                                                motion.file,
                                                            )}</option
                                                        >
                                                    {/each}
                                                </optgroup>
                                            {/if}
                                            {#if availableExpressions.length > 0}
                                                <optgroup label="Expressions">
                                                    {#each availableExpressions as expr}
                                                        <option value={expr}
                                                            >{getExpressionDisplayName(
                                                                expr,
                                                            )} (Expression)</option
                                                        >
                                                    {/each}
                                                </optgroup>
                                            {/if}
                                        </select>
                                    </div>
                                    <div class="mapping-inputs">
                                        <input
                                            type="text"
                                            placeholder="Description"
                                            bind:value={item.desc}
                                        />
                                        <button
                                            class="audio-remove-btn"
                                            on:click={() => removeSceneMotion(i)}
                                            >Remove</button
                                        >
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            {:else if activeTab === "audio"}
                <div class="audio-panel">
                    <h3>Test Lip-Sync</h3>
                    <p class="desc">
                        Select a local audio file (.wav, .mp3) to test lip sync.
                        This does not upload the file anywhere.
                    </p>

                    <div class="file-drop-area">
                        <input
                            type="file"
                            accept="audio/*"
                            multiple
                            on:change={(e) => {
                                addAudioFiles(e.currentTarget.files);
                                e.currentTarget.value = "";
                            }}
                        />
                        <span>Click to Add Audio Files</span>
                    </div>

                    <div class="uploaded-audio-list">
                        {#if uploadedAudios.length === 0}
                            <p class="empty-msg">No audio files added yet.</p>
                        {:else}
                            {#each uploadedAudios as audio}
                                <div class="audio-item">
                                    <button
                                        class="audio-play-btn"
                                        on:click={() => playAudioUrl(audio.url)}
                                        >▶ {audio.name}</button
                                    >
                                    <button
                                        class="audio-remove-btn"
                                        on:click={() =>
                                            removeUploadedAudio(audio.id)}
                                        >Remove</button
                                    >
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>
            {:else if activeTab === "runtime"}
                <div class="runtime-panel">
                    <h3>Runtime Controls</h3>
                    <p class="desc">
                        Test emotion, gesture, and global sensitivity in real
                        time.
                    </p>

                    <div class="runtime-section">
                        <h4>Global Sensitivity</h4>
                        <div class="sensitivity-row">
                            <input
                                type="range"
                                min="0.1"
                                max="2"
                                step="0.1"
                                value={pxlState.settings.sensitivity}
                                on:input={(e) =>
                                    applySensitivity(
                                        Number(e.currentTarget.value),
                                    )}
                            />
                            <span>{pxlState.settings.sensitivity.toFixed(1)}x</span>
                        </div>
                    </div>

                    <div class="runtime-section">
                        <h4>Head Calibration (Y/Z)</h4>
                        <div class="calib-grid">
                            <label class="calib-item">
                                <span>Y Gain</span>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="2"
                                    step="0.05"
                                    value={pxlState.settings.angleYGain}
                                    on:input={(e) =>
                                        applyCalibrationField(
                                            "angleYGain",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.angleYGain.toFixed(2)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Y Offset</span>
                                <input
                                    type="range"
                                    min="-30"
                                    max="30"
                                    step="1"
                                    value={pxlState.settings.angleYOffset}
                                    on:input={(e) =>
                                        applyCalibrationField(
                                            "angleYOffset",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.angleYOffset.toFixed(0)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Y Min</span>
                                <input
                                    type="range"
                                    min="-90"
                                    max="0"
                                    step="1"
                                    value={pxlState.settings.angleYMin}
                                    on:input={(e) =>
                                        applyCalibrationField(
                                            "angleYMin",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.angleYMin.toFixed(0)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Y Max</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="90"
                                    step="1"
                                    value={pxlState.settings.angleYMax}
                                    on:input={(e) =>
                                        applyCalibrationField(
                                            "angleYMax",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.angleYMax.toFixed(0)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Z Gain</span>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="2"
                                    step="0.05"
                                    value={pxlState.settings.angleZGain}
                                    on:input={(e) =>
                                        applyCalibrationField(
                                            "angleZGain",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.angleZGain.toFixed(2)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Z Offset</span>
                                <input
                                    type="range"
                                    min="-30"
                                    max="30"
                                    step="1"
                                    value={pxlState.settings.angleZOffset}
                                    on:input={(e) =>
                                        applyCalibrationField(
                                            "angleZOffset",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.angleZOffset.toFixed(0)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Z Min</span>
                                <input
                                    type="range"
                                    min="-90"
                                    max="0"
                                    step="1"
                                    value={pxlState.settings.angleZMin}
                                    on:input={(e) =>
                                        applyCalibrationField(
                                            "angleZMin",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.angleZMin.toFixed(0)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Z Max</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="90"
                                    step="1"
                                    value={pxlState.settings.angleZMax}
                                    on:input={(e) =>
                                        applyCalibrationField(
                                            "angleZMax",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.angleZMax.toFixed(0)}</small>
                            </label>
                        </div>
                    </div>

                    <div class="runtime-section">
                        <h4>Body Calibration (X/Y/Z)</h4>
                        <div class="calib-grid">
                            <label class="calib-item">
                                <span>Body X Gain</span>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="2"
                                    step="0.05"
                                    value={pxlState.settings.bodyXGain}
                                    on:input={(e) =>
                                        applyBodyCalibrationField(
                                            "bodyXGain",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.bodyXGain.toFixed(2)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Body X Offset</span>
                                <input
                                    type="range"
                                    min="-30"
                                    max="30"
                                    step="1"
                                    value={pxlState.settings.bodyXOffset}
                                    on:input={(e) =>
                                        applyBodyCalibrationField(
                                            "bodyXOffset",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.bodyXOffset.toFixed(0)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Body X Min</span>
                                <input
                                    type="range"
                                    min="-90"
                                    max="0"
                                    step="1"
                                    value={pxlState.settings.bodyXMin}
                                    on:input={(e) =>
                                        applyBodyCalibrationField(
                                            "bodyXMin",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.bodyXMin.toFixed(0)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Body X Max</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="90"
                                    step="1"
                                    value={pxlState.settings.bodyXMax}
                                    on:input={(e) =>
                                        applyBodyCalibrationField(
                                            "bodyXMax",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.bodyXMax.toFixed(0)}</small>
                            </label>

                            <label class="calib-item">
                                <span>Body Y Gain</span>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="2"
                                    step="0.05"
                                    value={pxlState.settings.bodyYGain}
                                    on:input={(e) =>
                                        applyBodyCalibrationField(
                                            "bodyYGain",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.bodyYGain.toFixed(2)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Body Y Offset</span>
                                <input
                                    type="range"
                                    min="-30"
                                    max="30"
                                    step="1"
                                    value={pxlState.settings.bodyYOffset}
                                    on:input={(e) =>
                                        applyBodyCalibrationField(
                                            "bodyYOffset",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.bodyYOffset.toFixed(0)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Body Y Min</span>
                                <input
                                    type="range"
                                    min="-90"
                                    max="0"
                                    step="1"
                                    value={pxlState.settings.bodyYMin}
                                    on:input={(e) =>
                                        applyBodyCalibrationField(
                                            "bodyYMin",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.bodyYMin.toFixed(0)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Body Y Max</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="90"
                                    step="1"
                                    value={pxlState.settings.bodyYMax}
                                    on:input={(e) =>
                                        applyBodyCalibrationField(
                                            "bodyYMax",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.bodyYMax.toFixed(0)}</small>
                            </label>

                            <label class="calib-item">
                                <span>Body Z Gain</span>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="2"
                                    step="0.05"
                                    value={pxlState.settings.bodyZGain}
                                    on:input={(e) =>
                                        applyBodyCalibrationField(
                                            "bodyZGain",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.bodyZGain.toFixed(2)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Body Z Offset</span>
                                <input
                                    type="range"
                                    min="-30"
                                    max="30"
                                    step="1"
                                    value={pxlState.settings.bodyZOffset}
                                    on:input={(e) =>
                                        applyBodyCalibrationField(
                                            "bodyZOffset",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.bodyZOffset.toFixed(0)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Body Z Min</span>
                                <input
                                    type="range"
                                    min="-90"
                                    max="0"
                                    step="1"
                                    value={pxlState.settings.bodyZMin}
                                    on:input={(e) =>
                                        applyBodyCalibrationField(
                                            "bodyZMin",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.bodyZMin.toFixed(0)}</small>
                            </label>
                            <label class="calib-item">
                                <span>Body Z Max</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="90"
                                    step="1"
                                    value={pxlState.settings.bodyZMax}
                                    on:input={(e) =>
                                        applyBodyCalibrationField(
                                            "bodyZMax",
                                            Number(e.currentTarget.value),
                                        )}
                                />
                                <small>{pxlState.settings.bodyZMax.toFixed(0)}</small>
                            </label>
                        </div>
                    </div>

                    <div class="runtime-section">
                        <h4>Emotion States</h4>
                        <div class="runtime-grid">
                            {#each emotionOptions as emo}
                                <button
                                    class="runtime-btn"
                                    on:click={() => setRuntimeEmotion(emo)}
                                >
                                    {emo}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <div class="runtime-section">
                        <h4>Gestures</h4>
                        <div class="runtime-grid">
                            {#each gestureOptions as gesture}
                                <button
                                    class="runtime-btn"
                                    on:click={() => playRuntimeGesture(gesture)}
                                >
                                    {gesture}
                                </button>
                            {/each}
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .sandbox-container {
        display: flex;
        height: 100vh;
        width: 100vw;
        background: #111;
        color: white;
        font-family: "Inter", sans-serif;
    }

    .center-panel {
        flex: 1;
        position: relative;
        overflow: hidden;
        background: radial-gradient(circle at center, #2a2a35 0%, #111 100%);
    }

    .viewer-wrapper {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
    }

    .control-panel {
        width: 420px;
        background: #1a1a1a;
        display: flex;
        flex-direction: column;
        border-left: 1px solid #333;
        z-index: 10;
        box-shadow: -4px 0 15px rgba(0, 0, 0, 0.3);
    }
    .panel-header {
        padding: 1.5rem;
        background: #111;
        border-bottom: 1px solid #222;
    }
    .panel-header h2 {
        margin: 0 0 1rem 0;
        font-size: 1.25rem;
        color: #eee;
    }
    .header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.8rem;
    }
    .header-actions {
        display: flex;
        gap: 0.4rem;
    }

    .persona-info {
        background: #252525;
        padding: 0.8rem 1rem;
        border-radius: 8px;
        border: 1px solid #3a3a3a;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .persona-info .p-name {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 500;
        color: #ddd;
    }
    .type-badge {
        background: #6a00ff;
        color: white;
        padding: 0.2rem 0.5rem;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
    }
    .loading-state {
        color: #888;
        font-size: 0.9rem;
        font-style: italic;
    }

    .settings-panel {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding: 0.5rem 0;
    }
    input,
    select {
        background: #2a2a2a;
        color: white;
        border: 1px solid #444;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        font-size: 0.9rem;
        outline: none;
        transition: border-color 0.2s;
    }
    input:focus,
    select:focus {
        border-color: #6a00ff;
    }

    button {
        background: #6a00ff;
        color: white;
        border: none;
        padding: 0.6rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s ease;
    }
    button:hover {
        background: #8b3dff;
        transform: translateY(-1px);
    }
    button.secondary {
        background: #333;
        font-weight: 400;
        padding: 0.4rem 0.8rem;
        font-size: 0.85rem;
    }
    button.secondary:hover {
        background: #444;
    }

    .tabs {
        display: flex;
        background: #111;
        border-bottom: 1px solid #333;
    }
    .tab {
        flex: 1;
        background: transparent;
        color: #888;
        border-radius: 0;
        padding: 0.8rem 0;
        font-size: 0.9rem;
        font-weight: 500;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
    }
    .tab:hover {
        background: #1a1a1a;
        color: #ddd;
        transform: none;
    }
    .tab.active {
        color: #fff;
        border-bottom-color: #6a00ff;
        background: #1a1a1a;
    }

    .tab-content {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
    }

    .list {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
    }
    .asset-item {
        background: #252525;
        border: 1px solid #383838;
        border-radius: 8px;
        padding: 0.8rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        transition: border-color 0.2s;
    }
    .asset-item:hover {
        border-color: #555;
    }
    .asset-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .filename {
        font-size: 0.85rem;
        color: #ddd;
        word-break: break-all;
        padding-right: 1rem;
    }
    .play-btn {
        background: rgba(106, 0, 255, 0.15);
        color: #a766ff;
        padding: 0.3rem 0.6rem;
        font-size: 0.8rem;
        white-space: nowrap;
    }
    .play-btn:hover {
        background: rgba(106, 0, 255, 0.3);
    }
    .align-center {
        align-items: center;
    }
    .mapping-inputs .label {
        font-size: 0.8rem;
        color: #888;
        white-space: nowrap;
    }
    .mapping-inputs {
        display: flex;
        gap: 0.5rem;
    }
    .mapping-inputs input {
        flex: 2;
        padding: 0.4rem;
        font-size: 0.8rem;
    }
    .mapping-inputs select {
        flex: 1;
        padding: 0.4rem;
        font-size: 0.8rem;
    }
    .empty-msg {
        color: #666;
        text-align: center;
        margin-top: 2rem;
        font-size: 0.9rem;
    }

    .audio-panel {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .audio-panel h3 {
        margin: 0;
        font-size: 1.1rem;
        color: #eee;
    }
    .audio-panel .desc {
        font-size: 0.85rem;
        color: #888;
        line-height: 1.4;
        margin: 0;
    }
    .file-drop-area {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 120px;
        border: 2px dashed #444;
        border-radius: 8px;
        transition:
            border-color 0.2s,
            background 0.2s;
        background: #222;
    }
    .file-drop-area:hover {
        border-color: #6a00ff;
        background: #2a2a2a;
    }
    .file-drop-area input[type="file"] {
        position: absolute;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
    }
    .file-drop-area span {
        color: #aaa;
        font-weight: 500;
        pointer-events: none;
    }

    .uploaded-audio-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .audio-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: #252525;
        border: 1px solid #383838;
        border-radius: 8px;
        padding: 0.4rem;
    }

    .audio-play-btn {
        flex: 1;
        text-align: left;
        background: rgba(106, 0, 255, 0.2);
        color: #ddd;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .audio-play-btn:hover {
        background: rgba(106, 0, 255, 0.35);
    }

    .audio-remove-btn {
        background: #333;
        color: #ccc;
        padding: 0.45rem 0.65rem;
        font-size: 0.8rem;
    }

    .audio-remove-btn:hover {
        background: #444;
        color: #fff;
    }

    .runtime-panel {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .runtime-panel h3 {
        margin: 0;
        font-size: 1.1rem;
        color: #eee;
    }

    .runtime-panel .desc {
        margin: 0;
        font-size: 0.85rem;
        color: #888;
        line-height: 1.4;
    }

    .runtime-section {
        background: #252525;
        border: 1px solid #383838;
        border-radius: 8px;
        padding: 0.8rem;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .runtime-section h4 {
        margin: 0;
        font-size: 0.9rem;
        color: #ddd;
    }

    .sensitivity-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }

    .sensitivity-row input[type="range"] {
        flex: 1;
    }

    .sensitivity-row span {
        min-width: 42px;
        text-align: right;
        color: #bbb;
        font-size: 0.85rem;
    }

    .runtime-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.5rem;
    }

    .runtime-btn {
        background: #333;
        color: #ddd;
        border: 1px solid #444;
        padding: 0.5rem 0.6rem;
        font-size: 0.8rem;
    }

    .runtime-btn:hover {
        background: #454545;
    }

    .calib-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.6rem;
    }

    .calib-item {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.78rem;
        color: #bbb;
    }

    .calib-item small {
        color: #999;
        text-align: right;
    }
</style>

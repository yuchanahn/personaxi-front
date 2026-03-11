<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount, onDestroy } from "svelte";
    import { page } from "$app/stores";
    import { t } from "svelte-i18n";
    import { get } from "svelte/store";

    import { st_user } from "$lib/stores/user";
    import { toast } from "$lib/stores/toast";
    import { chatSessions } from "$lib/stores/chatSessions";
    import { api } from "$lib/api";
    import {
        loadPersonaOriginal,
        savePersona,
        fetchAndSetAssetTypes,
    } from "$lib/api/edit_persona";
    import { loreApi } from "$lib/api/lore";
    import type { Persona } from "$lib/types";

    import LoadingAnimation from "$lib/components/utils/LoadingAnimation.svelte";
    import FirstCreationRewardModal from "$lib/components/modal/FirstCreationRewardModal.svelte";

    import StepWizard from "$lib/components/edit3/StepWizard.svelte";
    import StepTypeSelect from "$lib/components/edit3/StepTypeSelect.svelte";
    import StepBasicInfo from "$lib/components/edit3/StepBasicInfo.svelte";
    import StepMedia from "$lib/components/edit3/StepMedia.svelte";
    import StepPrompt from "$lib/components/edit3/StepPrompt.svelte";
    import StepReview from "$lib/components/edit3/StepReview.svelte";

    // ── State ──
    let originalPersona: Persona | null = null;
    let persona: Persona = createEmptyPersona();
    let currentStep = 0;
    let error = "";
    let loading = false;
    let showSuccess = false;

    // Template & Instruction State
    const kintsugiTemplateId = "kintsugi_v1";
    let selectedTemplate = "custom";
    let singleInstruction = "";
    let k_description = "";
    let k_personality = "";
    let k_userPersona = "";
    let k_scenario = "";

    // Live2D/3D Helpers
    let availableExpressions: string[] = [];
    let availableMotions: string[] = [];
    let firstSceneJson = "";
    let allVoices: any[] = [];
    let selectedVoiceId = "";
    let pendingLoreLinks = new Set<string>();

    let last_id: string | null = null;
    let showRewardModal = false;
    let hasReceivedFirstCreationReward =
        get(st_user)?.data.hasReceivedFirstCreationReward ?? false;

    // Auto-save timer
    let autoSaveInterval: ReturnType<typeof setInterval>;
    const AUTO_SAVE_KEY = "edit3_draft";
const LIVE2D_EDITOR_BRIDGE_PREFIX = "live2d_editor_config_bridge:";
    const DEFAULT_LIVE2D_GESTURE_ANIM_LIST = `[NOD] : Nodding (Permission, Agreement)
[SHAKE] : Shaking head (Denial, Refusal)
[TILT] : Tilting head (Question, Doubt)
[FIDGET] : Fidgeting (Anxiety, Restlessness)
[SIGH] : Sighing (Relief, Disappointment, Tiredness)
[LOOK_DOWN] : Looking down (Shame, Submission, Sadness)
[CLOSE_EYES] : Closing eyes (Thinking, Refusal, Sleepy)
[WINK] : Winking (Teasing, Secret, Agreement)
[STICK_TONGUE] : Sticking tongue out (Teasing, Disgust)
[SQUINT] : Squinting (Suspicion, Focus, Glare)
[LOOK_UP_THINK] : Looking up (Thinking, Remembering)
[FLINCH] : Flinching (Surprise, Fear, Pain)
[PANT] : Panting (Exhaustion, Excitement, Heat)`;
    const DEFAULT_LIVE2D_GESTURE_LINES = new Set(
        DEFAULT_LIVE2D_GESTURE_ANIM_LIST.split("\n").map((line) => line.trim()),
    );

    function stripDefaultLive2DGestureLines(text: string): string {
        if (!text) return "";
        const lines = text
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => !!line);
        const customOnly = lines.filter(
            (line) => !DEFAULT_LIVE2D_GESTURE_LINES.has(line),
        );
        return customOnly.join("\n").trim();
    }

    $: stepLabels = [
        $t("edit3.steps.type"),
        $t("edit3.steps.basicInfo"),
        $t("edit3.steps.media"),
        $t("edit3.steps.prompt"),
        $t("edit3.steps.review"),
    ];

    // ── Reactive ──
    $: selectedVoice = allVoices.find((v) => v._id === selectedVoiceId);
    $: if (selectedVoiceId) {
        persona.voice_id = selectedVoiceId;
    } else {
        persona.voice_id = "";
    }

    $: if (persona.contentType === "story") {
        persona.personaType = "2D";
    }

    $: validationErrors = getValidationErrors(
        persona,
        singleInstruction,
        selectedTemplate,
        kintsugiTemplateId,
        k_description,
    );
    $: canProceed = validateCurrentStep(
        currentStep,
        persona,
        singleInstruction,
        selectedTemplate,
        kintsugiTemplateId,
        k_description,
    );

    // ── Functions ──
    function getLive2DBridgeKey(personaId: string): string {
        return `${LIVE2D_EDITOR_BRIDGE_PREFIX}${personaId}`;
    }

    function mergeLive2DConfig(
        existingConfig: any,
        config: any,
        sceneFields?: Record<string, any>,
    ): Record<string, any> {
        const obj: Record<string, any> =
            existingConfig && typeof existingConfig === "object"
                ? { ...existingConfig }
                : {};

        obj.editor_config = config;
        obj.version = 1;
        obj.updatedAt = Date.now();

        if (sceneFields && typeof sceneFields === "object") {
            const expressionMap =
                sceneFields.expression_map &&
                typeof sceneFields.expression_map === "object"
                    ? sceneFields.expression_map
                    : sceneFields.live2d_expression_map &&
                        typeof sceneFields.live2d_expression_map === "object"
                      ? sceneFields.live2d_expression_map
                      : null;
            if (expressionMap) obj.expression_map = expressionMap;

            const motionList = Array.isArray(sceneFields.motion_list)
                ? sceneFields.motion_list
                : Array.isArray(sceneFields.live2d_motion_list)
                  ? sceneFields.live2d_motion_list
                  : null;
            if (motionList) obj.motion_list = motionList;

            const permanentExpressions = Array.isArray(
                sceneFields.permanent_expressions,
            )
                ? sceneFields.permanent_expressions
                : Array.isArray(sceneFields.live2d_permanent_expressions)
                  ? sceneFields.live2d_permanent_expressions
                  : null;
            if (permanentExpressions) {
                obj.permanent_expressions = permanentExpressions;
            }
        }

        return obj;
    }

    function compactLive2DEditorConfig(config: any): any {
        if (!config || typeof config !== "object") return config;

        const out: Record<string, any> = {};

        if (typeof config.modelUrl === "string" && config.modelUrl.trim()) {
            out.modelUrl = config.modelUrl.trim();
        }

        if (config.settings && typeof config.settings === "object") {
            out.settings = config.settings;
        }

        if (config.expressions && typeof config.expressions === "object") {
            const mapped = Object.fromEntries(
                Object.entries(config.expressions).filter(
                    ([, v]) => typeof v === "string" && v.trim().length > 0,
                ),
            );
            if (Object.keys(mapped).length > 0) out.expressions = mapped;
        }

        if (
            config.expressionAliases &&
            typeof config.expressionAliases === "object"
        ) {
            const aliases: Record<string, string> = {};
            Object.entries(config.expressionAliases).forEach(([k, v]) => {
                if (typeof k !== "string" || typeof v !== "string") return;
                if (v.trim() && v.trim() !== k.trim()) {
                    aliases[k] = v.trim();
                }
            });
            if (Object.keys(aliases).length > 0) out.expressionAliases = aliases;
        }

        if (config.motions && typeof config.motions === "object") {
            const motions: Record<
                string,
                { file: string; alias?: string; category?: string }
            > = {};
            Object.entries(config.motions).forEach(([k, v]: [string, any]) => {
                if (!v || typeof v !== "object") return;
                const file = typeof v.file === "string" ? v.file.trim() : "";
                if (!file) return;
                const alias =
                    typeof v.alias === "string" ? v.alias.trim() : "";
                const category =
                    typeof v.category === "string" ? v.category.trim() : "";
                const base = file.split("/").pop() || file;
                const isDefaultAlias =
                    !alias ||
                    alias.toLowerCase() === file.toLowerCase() ||
                    alias.toLowerCase() === base.toLowerCase();

                if (!isDefaultAlias || category) {
                    motions[k] = {
                        file,
                        ...(isDefaultAlias ? {} : { alias }),
                        ...(category ? { category } : {}),
                    };
                }
            });
            if (Object.keys(motions).length > 0) out.motions = motions;
        }

        return out;
    }

    function applyLive2DEditorBridgeIfExists(p: Persona) {
        if (typeof window === "undefined" || !p?.id) return;

        const key = getLive2DBridgeKey(p.id);
        const raw = localStorage.getItem(key);
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw);
            const config = compactLive2DEditorConfig(parsed?.config ?? parsed);
            const sceneFields =
                parsed?.sceneFields && typeof parsed.sceneFields === "object"
                    ? parsed.sceneFields
                    : {};
            const merged = mergeLive2DConfig(
                p.live2d_config,
                config,
                sceneFields,
            );

            p.live2d_config = merged;
            if (typeof config?.modelUrl === "string" && config.modelUrl.trim()) {
                p.live2d_model_url = config.modelUrl.trim();
            }
        } catch (e) {
            console.warn("Failed to apply Live2D editor bridge", e);
        }
    }

    function ensureLive2DAnimListInFirstScene(p: Persona) {
        const normalizedType = (p.personaType || "").trim().toLowerCase();
        const isLive2DType =
            normalizedType === "2.5d" || normalizedType === "live2d";
        if (!isLive2DType || !p.first_scene?.trim()) return;

        try {
            const parsed = JSON.parse(p.first_scene);
            if (!parsed || typeof parsed !== "object") return;

            const currentAnimList =
                typeof parsed.anim_list === "string"
                    ? parsed.anim_list.trim()
                    : "";
            const customAnimList = stripDefaultLive2DGestureLines(currentAnimList);
            parsed.anim_list = [customAnimList, DEFAULT_LIVE2D_GESTURE_ANIM_LIST]
                .filter((v) => !!v)
                .join("\n");
            p.first_scene = JSON.stringify(parsed, null, 2);
        } catch {
            // Keep original if first_scene is not valid JSON.
        }
    }

    function createEmptyPersona(): Persona {
        return {
            id: "",
            owner_id: [],
            name: "",
            one_liner: "",
            personaType: "",
            contentType: "character",
            instructions: [],
            promptExamples: [],
            tags: [],
            feedback: { view: 0 },
            voice_id: "",
            vrm_url: "",
            model_background_url: "",
            portrait_url: "",
            image_metadatas: [],
            image_count: 0,
            visibility: "private",
            created_at: "",
            updated_at: "",
            creator_name: "",
            first_scene: "",
            live2d_config: {},
            greeting: "",
            likes_count: 0,
            dislikes_count: 0,
            chat_count: 0,
            interactiveUIEnabled: false,
        };
    }

    function getValidationErrors(
        p: Persona,
        instruction: string,
        template: string,
        kintsugiId: string,
        kDesc: string,
    ): string[] {
        const errors: string[] = [];
        const normalizedType = (p.personaType || "").trim().toLowerCase();
        const isLive2DType =
            normalizedType === "2.5d" || normalizedType === "live2d";
        const is3DType =
            normalizedType === "3d" || normalizedType === "vrm3d";
        const isAvatarType = isLive2DType || is3DType;
        const hasLive2DModel = !!p.live2d_model_url?.trim();
        const hasVrmModel = !!p.vrm_url?.trim();
        if (!p.personaType)
            errors.push(get(t)("edit3.validation.typeRequired"));
        if (!p.name.trim())
            errors.push(get(t)("edit3.validation.nameRequired"));
        if (!p.greeting.trim())
            errors.push(get(t)("edit3.validation.greetingRequired"));
        if (!p.portrait_url?.trim())
            errors.push(get(t)("editPage.validation.allFieldsRequired"));
        if (!p.first_scene.trim())
            errors.push(get(t)("edit3.validation.firstSceneRequired"));
        if (template === kintsugiId) {
            if (!kDesc.trim())
                errors.push(get(t)("edit3.validation.kintsugiDescRequired"));
        } else if (!isAvatarType) {
            if (!instruction.trim())
                errors.push(get(t)("edit3.validation.instructionRequired"));
        }
        if (isLive2DType && !hasLive2DModel) {
            errors.push(get(t)("edit3.validation.live2dModelRequired"));
        }
        if (is3DType && !hasVrmModel) {
            errors.push(get(t)("edit3.validation.vrmModelRequired"));
        }
        if (p.tags.filter((id) => parseInt(id) < 1000).length === 0)
            errors.push(get(t)("edit3.validation.tagsRequired"));
        return errors;
    }

    function validateCurrentStep(
        step: number,
        p: Persona,
        instruction: string,
        template: string,
        kintsugiId: string,
        kDesc: string,
    ): boolean {
        const normalizedType = (p.personaType || "").trim().toLowerCase();
        const isLive2DType =
            normalizedType === "2.5d" || normalizedType === "live2d";
        const is3DType =
            normalizedType === "3d" || normalizedType === "vrm3d";
        const isAvatarType = isLive2DType || is3DType;
        const hasLive2DModel = !!p.live2d_model_url?.trim();
        const hasVrmModel = !!p.vrm_url?.trim();

        switch (step) {
            case 0:
                return !!p.personaType;
            case 1:
                return !!p.name.trim() && !!p.greeting.trim();
            case 2:
                return true; // Media is optional
            case 3:
                if (template === kintsugiId) return !!kDesc.trim();
                return !!p.first_scene.trim() && (isAvatarType || !!instruction.trim());
            case 4:
                return (
                    p.tags.filter((id) => parseInt(id) < 1000).length > 0 &&
                    !(isLive2DType && !hasLive2DModel) &&
                    !(is3DType && !hasVrmModel)
                );
            default:
                return true;
        }
    }

    function handleStepChange(
        e: CustomEvent<{ step: number; direction: number }>,
    ) {
        currentStep = e.detail.step;
        saveDraft();
    }

    function handleValidationFail() {
        toast.warning(get(t)("edit3.validation.fillRequiredFirst"));
    }

    // ── Load Persona ──
    async function load_persona(id: string) {
        try {
            const p = await loadPersonaOriginal(id);
            originalPersona = JSON.parse(JSON.stringify(p));

            // Parse Instructions for Templates
            if (p.instructions.length > 1 && p.instructions[1]) {
                const templateIdentifier = p.instructions[1];
                if (templateIdentifier === "conversation") {
                    selectedTemplate = "conversation";
                    singleInstruction = p.instructions[0] || "";
                } else if (templateIdentifier === "simulation") {
                    selectedTemplate = "simulation";
                    singleInstruction = p.instructions[0] || "";
                } else if (templateIdentifier === kintsugiTemplateId) {
                    selectedTemplate = kintsugiTemplateId;
                    try {
                        const data = JSON.parse(p.instructions[0] || "{}");
                        k_description = data.description || "";
                        k_personality = data.personality || "";
                        k_userPersona = data.userPersona || "";
                        k_scenario = data.scenario || "";
                    } catch (e) {
                        console.error("Kintsugi JSON parse failed", e);
                        k_description = p.instructions[0] || "";
                    }
                } else {
                    selectedTemplate = "custom";
                    singleInstruction = p.instructions[0] || "";
                }
            } else {
                selectedTemplate = "custom";
                singleInstruction = p.instructions[0] || "";
            }

            if (p.voice_id) selectedVoiceId = p.voice_id;
            else selectedVoiceId = "";

            if (p.personaType === "3D" && p.first_scene) {
                firstSceneJson = p.first_scene;
            }

            if (p.image_metadatas && p.image_metadatas.length > 0) {
                const metadatasWithType = await fetchAndSetAssetTypes(
                    p.image_metadatas,
                );
                p.image_metadatas = metadatasWithType;
            } else {
                p.image_metadatas = [];
            }

            if (!(p.contentType === "character" || p.contentType === "story")) {
                p.contentType = "character";
            }

            applyLive2DEditorBridgeIfExists(p);

            persona = p;
            if (!persona.one_liner) persona.one_liner = "";

            if (
                persona.live2d_model_url &&
                (persona.personaType === "2.5D" || persona.personaType === "2D")
            ) {
                loadLive2DMetadata(persona.live2d_model_url);
            }

            return p;
        } catch (err) {
            console.error("Failed to load persona:", err);
            toast.error("Failed to load persona");
        }
    }

    async function loadLive2DMetadata(url: string) {
        if (!url) return;
        try {
            const cryptoModule = await import("$lib/utils/crypto");
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch model3.json");

            let data;
            if (url.includes("uohepkqmwbstbmnkoqju.supabase.co")) {
                const buffer = await response.arrayBuffer();

                try {
                    const plainText = new TextDecoder().decode(buffer);
                    data = JSON.parse(plainText);
                    console.log(
                        "[Live2D Viewer] Legacy unencrypted model detected in edit3.",
                    );
                } catch (e) {
                    const decryptedBuffer =
                        await cryptoModule.xorEncryptDecrypt(buffer);
                    const jsonStr = new TextDecoder().decode(decryptedBuffer);
                    data = JSON.parse(jsonStr);
                }
            } else {
                data = await response.json();
            }

            let rawExprs: any[] = [];
            if (data.FileReferences?.Expressions)
                rawExprs = data.FileReferences.Expressions;
            else if (data.expressions) rawExprs = data.expressions;

            if (Array.isArray(rawExprs)) {
                const exprs = rawExprs
                    .map((e: any) => {
                        if (typeof e === "string") return e;
                        const name = e.Name || e.name || e.Id || e.id;
                        const file = e.File || e.file;
                        return (
                            name ||
                            (file
                                ? file
                                      .split("/")
                                      .pop()
                                      .replace(".exp3.json", "")
                                : "")
                        );
                    })
                    .filter((n: string) => n);
                availableExpressions = Array.from(new Set(exprs));
            }

            let rawMotions: any = {};
            if (data.FileReferences?.Motions)
                rawMotions = data.FileReferences.Motions;
            else if (data.motions) rawMotions = data.motions;

            const files: string[] = [];
            Object.values(rawMotions).forEach((group: any) => {
                if (Array.isArray(group)) {
                    group.forEach((m: any) => {
                        const f = m.File || m.file;
                        if (f) files.push(f);
                    });
                }
            });
            const uniqueMotions: string[] = [];
            const seenMotionKeys = new Set<string>();
            files.forEach((f) => {
                const key = f.replace(/\\/g, "/").toLowerCase();
                if (seenMotionKeys.has(key)) return;
                seenMotionKeys.add(key);
                uniqueMotions.push(f);
            });
            availableMotions = uniqueMotions;
        } catch (e) {
            console.warn("Failed to load Live2D metadata:", e);
        }
    }

    // ── URL Change Watcher ──
    $: {
        const id = $page.url.searchParams.get("c");
        if (id && id !== last_id) {
            last_id = id;
            if (id !== persona.id) load_persona(id);
        }
    }

    // ── Save ──
    async function handleSave() {
        if (loading || showSuccess) return;
        error = "";

        // Assemble instructions
        let finalInstructions: string[] = [];

        if (selectedTemplate === kintsugiTemplateId) {
            if (k_description.length > 1000) {
                error = $t("editPage.validation.kintsugiDescLimit");
                toast.error(error);
                return;
            }
            const kintsugiJson = JSON.stringify({
                description: k_description,
                personality: k_personality,
                userPersona: k_userPersona,
                scenario: k_scenario,
            });
            finalInstructions.push(kintsugiJson);
        } else {
            finalInstructions.push(singleInstruction);
            if (singleInstruction.length > 3000) {
                error = $t("editPage.validation.instructionsLimitExceeded");
                toast.error(error);
                return;
            }
            const normalizedType = (persona.personaType || "").trim().toLowerCase();
            const isAvatarType =
                normalizedType === "2.5d" ||
                normalizedType === "live2d" ||
                normalizedType === "3d" ||
                normalizedType === "vrm3d";
            if (!isAvatarType && !singleInstruction.trim()) {
                error = $t("editPage.validation.allFieldsRequired");
                toast.error(error);
                return;
            }
        }

        if (selectedTemplate === "conversation")
            finalInstructions.push("conversation");
        else if (selectedTemplate === "simulation")
            finalInstructions.push("simulation");
        else if (selectedTemplate === kintsugiTemplateId)
            finalInstructions.push(kintsugiTemplateId);
        else finalInstructions.push("custom");

        persona.instructions = finalInstructions;
        ensureLive2DAnimListInFirstScene(persona);

        // Validation
        if (
            !persona.name.trim() ||
            !persona.personaType.trim() ||
            !persona.portrait_url?.trim() ||
            !persona.greeting.trim() ||
            !persona.first_scene.trim() ||
            persona.tags.length === 0
        ) {
            error = $t("editPage.validation.allFieldsRequired");
            toast.error(error);
            return;
        }
        const normalizedType = (persona.personaType || "").trim().toLowerCase();
        const isLive2DType =
            normalizedType === "2.5d" || normalizedType === "live2d";
        const is3DType = normalizedType === "3d" || normalizedType === "vrm3d";

        if (isLive2DType && !persona.live2d_model_url?.trim()) {
            error = $t("edit3.validation.live2dModelRequired");
            toast.error(error);
            return;
        }
        if (is3DType && !persona.vrm_url?.trim()) {
            error = $t("edit3.validation.vrmModelRequired");
            toast.error(error);
            return;
        }
        const firstSceneLimit = isLive2DType || is3DType ? 7500 : 2500;
        if (
            persona.greeting.length > 200 ||
            persona.first_scene.length > firstSceneLimit
        ) {
            error = $t("editPage.validation.charLimitExceeded");
            toast.error(error);
            return;
        }
        if (
            persona.promptExamples.some((ex) => ex.length > 200) ||
            persona.promptExamples.length > 10
        ) {
            error = $t("editPage.validation.promptExamplesLimitExceeded");
            toast.error(error);
            return;
        }

        loading = true;

        try {
            const id: string | null = await savePersona(persona);
            if (id) {
                if (persona.id) {
                    localStorage.removeItem(getLive2DBridgeKey(persona.id));
                }
                localStorage.removeItem(getLive2DBridgeKey(id));

                // Handle pending lore links if new persona
                if (!persona.id && pendingLoreLinks.size > 0) {
                    try {
                        await Promise.all(
                            Array.from(pendingLoreLinks).map((loreId) =>
                                loreApi.linkPersona(id, loreId, false),
                            ),
                        );
                    } catch (e) {
                        console.error("Failed to link lorebooks", e);
                    }
                }

                showSuccess = true;
                toast.success(get(t)("edit3.toast.saveSuccess"));
                clearDraft();

                setTimeout(() => (showSuccess = false), 2000);

                if (!persona.id) {
                    goto(`/edit3?c=${id}`, { replaceState: true });
                    if (hasReceivedFirstCreationReward) {
                        showRewardModal = true;
                        hasReceivedFirstCreationReward = false;
                    }
                } else {
                    load_persona(id);
                }
            }
        } catch (e: any) {
            error = $t("editPage.errorSaveFailed", {
                values: { message: e.message },
            });
            toast.error(error);
        } finally {
            loading = false;
        }
    }

    // ── Auto-save Draft ──
    function saveDraft() {
        if (persona.id) return; // Only for new personas
        try {
            const draft = {
                persona,
                selectedTemplate,
                singleInstruction,
                k_description,
                k_personality,
                k_userPersona,
                k_scenario,
                firstSceneJson,
                selectedVoiceId,
                currentStep,
                savedAt: Date.now(),
            };
            localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(draft));
        } catch (e) {
            // Silently fail
        }
    }

    function loadDraft() {
        try {
            const raw = localStorage.getItem(AUTO_SAVE_KEY);
            if (!raw) return false;

            const draft = JSON.parse(raw);
            // Check if draft is less than 24 hours old
            if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
                clearDraft();
                return false;
            }

            persona = { ...createEmptyPersona(), ...draft.persona };
            selectedTemplate = draft.selectedTemplate || "custom";
            singleInstruction = draft.singleInstruction || "";
            k_description = draft.k_description || "";
            k_personality = draft.k_personality || "";
            k_userPersona = draft.k_userPersona || "";
            k_scenario = draft.k_scenario || "";
            firstSceneJson = draft.firstSceneJson || "";
            selectedVoiceId = draft.selectedVoiceId || "";
            const restoredStep = Number(draft.currentStep);
            if (Number.isFinite(restoredStep)) {
                currentStep = Math.max(0, Math.min(4, Math.floor(restoredStep)));
            } else {
                currentStep = 0;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function clearDraft() {
        localStorage.removeItem(AUTO_SAVE_KEY);
    }

    // ── Lifecycle ──
    onMount(async () => {
        if (!(await api.isLoggedIn())) {
            goto("/login");
            return;
        }

        // Load voices
        try {
            const response = await fetch("/voices2.json");
            if (response.ok) {
                const data = await response.json();
                allVoices = data.items;
            }
        } catch (e) {
            console.error("Failed to load voices.json", e);
        }

        // Check for existing draft (only for new persona)
        const id = $page.url.searchParams.get("c");
        if (!id) {
            const hasDraft = loadDraft();
            if (hasDraft) {
                toast.info(get(t)("edit3.toast.draftLoaded"));
            }
        }

        // Auto-save every 30s
        autoSaveInterval = setInterval(saveDraft, 30000);
    });

    onDestroy(() => {
        if (autoSaveInterval) clearInterval(autoSaveInterval);
    });
</script>

<div class="edit3-page">
    <StepWizard
        {currentStep}
        totalSteps={5}
        {stepLabels}
        {canProceed}
        isSaving={loading}
        on:stepChange={handleStepChange}
        on:validationFail={handleValidationFail}
        on:save={handleSave}
    >
        {#if currentStep === 0}
            <StepTypeSelect bind:persona />
        {:else if currentStep === 1}
            <StepBasicInfo bind:persona />
        {:else if currentStep === 2}
            <StepMedia
                bind:persona
                {originalPersona}
                {allVoices}
                bind:selectedVoiceId
                on:metadataLoaded={(e) => {
                    availableExpressions = e.detail.expressions;
                    availableMotions = e.detail.motions;
                }}
            />
        {:else if currentStep === 3}
            <StepPrompt
                bind:persona
                bind:selectedTemplate
                bind:singleInstruction
                bind:k_description
                bind:k_personality
                bind:k_userPersona
                bind:k_scenario
                bind:firstSceneJson
                {availableExpressions}
                {availableMotions}
                {kintsugiTemplateId}
                bind:pendingLoreLinks
            />
        {:else if currentStep === 4}
            <StepReview bind:persona {validationErrors} />
        {/if}

        <!-- Desktop right panel: next step -->
        <svelte:fragment slot="next">
            {#if currentStep + 1 === 1}
                <StepBasicInfo bind:persona />
            {:else if currentStep + 1 === 2}
                <StepMedia
                    bind:persona
                    {originalPersona}
                    {allVoices}
                    bind:selectedVoiceId
                    on:metadataLoaded={(e) => {
                        availableExpressions = e.detail.expressions;
                        availableMotions = e.detail.motions;
                    }}
                />
            {:else if currentStep + 1 === 3}
                <StepPrompt
                    bind:persona
                    bind:selectedTemplate
                    bind:singleInstruction
                    bind:k_description
                    bind:k_personality
                    bind:k_userPersona
                    bind:k_scenario
                    bind:firstSceneJson
                    {availableExpressions}
                    {availableMotions}
                    {kintsugiTemplateId}
                    bind:pendingLoreLinks
                />
            {:else if currentStep + 1 === 4}
                <StepReview bind:persona {validationErrors} />
            {/if}
        </svelte:fragment>
    </StepWizard>
</div>

<LoadingAnimation isOpen={loading} />
<FirstCreationRewardModal bind:isOpen={showRewardModal} />

<style>
    .edit3-page {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--background);
        color: var(--foreground);
    }
</style>

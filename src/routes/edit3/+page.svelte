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

    // ── Step Labels ──
    const stepLabels = [
        "캐릭터 타입",
        "기본 정보",
        "미디어 & 에셋",
        "프롬프트",
        "태그 & 검토",
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
            portrait_url: "",
            image_metadatas: [],
            image_count: 0,
            visibility: "private",
            created_at: "",
            updated_at: "",
            creator_name: "",
            first_scene: "",
            greeting: "",
            likes_count: 0,
            dislikes_count: 0,
            chat_count: 0,
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
        if (!p.personaType) errors.push("캐릭터 타입을 선택해주세요.");
        if (!p.name.trim()) errors.push("캐릭터 이름을 입력해주세요.");
        if (!p.greeting.trim()) errors.push("인사말을 입력해주세요.");
        if (!p.first_scene.trim()) errors.push("첫 장면을 작성해주세요.");
        if (template === kintsugiId) {
            if (!kDesc.trim())
                errors.push("Kintsugi 설명(Description)을 입력해주세요.");
        } else {
            if (!instruction.trim()) errors.push("지시사항을 입력해주세요.");
        }
        if (p.tags.filter((id) => parseInt(id) < 1000).length === 0)
            errors.push("카테고리 태그를 최소 1개 선택해주세요.");
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
        switch (step) {
            case 0:
                return !!p.personaType;
            case 1:
                return !!p.name.trim() && !!p.greeting.trim();
            case 2:
                return true; // Media is optional
            case 3:
                if (template === kintsugiId) return !!kDesc.trim();
                return !!p.first_scene.trim() && !!instruction.trim();
            case 4:
                return p.tags.filter((id) => parseInt(id) < 1000).length > 0;
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
        toast.warning("필수 항목을 먼저 입력해주세요.");
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
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch model3.json");
            const data = await response.json();

            let rawExprs: any[] = [];
            if (data.FileReferences?.Expressions)
                rawExprs = data.FileReferences.Expressions;
            else if (data.expressions) rawExprs = data.expressions;

            if (Array.isArray(rawExprs)) {
                availableExpressions = rawExprs
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
            availableMotions = files;
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
            if (!singleInstruction.trim()) {
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

        // Validation
        if (
            !persona.name.trim() ||
            !persona.personaType.trim() ||
            !persona.greeting.trim() ||
            !persona.first_scene.trim() ||
            persona.tags.length === 0
        ) {
            error = $t("editPage.validation.allFieldsRequired");
            toast.error(error);
            return;
        }
        if (
            persona.greeting.length > 200 ||
            persona.first_scene.length > 2500
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
                toast.success("저장 완료!");
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
            currentStep = draft.currentStep || 0;
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
                toast.info("이전에 작성 중이던 캐릭터를 불러왔습니다.");
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

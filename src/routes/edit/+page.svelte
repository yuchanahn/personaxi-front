<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
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
    import type { Persona } from "$lib/types";

    import LoadingAnimation from "$lib/components/utils/LoadingAnimation.svelte";
    import FirstCreationRewardModal from "$lib/components/modal/FirstCreationRewardModal.svelte";

    import EditHeader from "$lib/components/edit/EditHeader.svelte";
    import BasicInfoForm from "$lib/components/edit/BasicInfoForm.svelte";
    import MediaUploadForm from "$lib/components/edit/MediaUploadForm.svelte";
    import AiSettingsForm from "$lib/components/edit/AiSettingsForm.svelte";
    import TagSelector from "$lib/components/edit/TagSelector.svelte";

    let originalPersona: Persona | null = null;
    let persona: Persona = {
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

    let error = "";
    let loading = false;
    let showSuccess = false;
    let uploadProgress = 0;

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

    let previousPersonaType = "";
    let last_id: string | null = null;
    let showRewardModal = false;
    let hasReceivedFirstCreationReward =
        get(st_user)?.data.hasReceivedFirstCreationReward ?? false;

    // Reactive Statements
    $: selectedVoice = allVoices.find((v) => v._id === selectedVoiceId);
    $: if (selectedVoiceId) {
        persona.voice_id = selectedVoiceId;
    } else {
        persona.voice_id = "";
    }

    $: if (persona.contentType === "story") {
        persona.personaType = "2D";
    }

    // Load Persona Logic
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
            previousPersonaType = persona.personaType;

            // Note: MediaUploadForm handles its own preview states, but binds to persona
            // Live2D metadata loading is handled by child component if needed,
            // but we might need to trigger it.
            // The original code called `loadLive2DMetadata` here.
            // Since `MediaUploadForm` doesn't automatically load metadata on mount for existing URL,
            // we might miss expressions/motions for "AiSettings".
            // Actually `AiSettings` needs `availableExpressions`.
            // The logic for loading metadata from URL should probably be in `+page`
            // or we accept that it loads when file is uploaded,
            // BUT for existing personas, we need to load it.
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

            // Extract Expressions
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

            // Extract Motions
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

    // URL Change Watcher
    $: {
        const id = $page.url.searchParams.get("c");
        if (id && id !== last_id) {
            last_id = id;
            if (id !== persona.id) load_persona(id);
        }
    }

    onMount(async () => {
        if (!(await api.isLoggedIn())) {
            goto("/login");
            return;
        }

        try {
            const response = await fetch("/voices2.json");
            if (response.ok) {
                const data = await response.json();
                allVoices = data.items;
            }
        } catch (e) {
            console.error("Failed to load voices.json", e);
        }
    });

    async function handleSave() {
        if (loading || showSuccess) return;
        error = "";

        // Validation & Instruction assembly
        let finalInstructions = [];

        if (selectedTemplate === kintsugiTemplateId) {
            if (k_description.length > 1000) {
                error = $t("editPage.validation.kintsugiDescLimit");
                return;
            }
            if (k_personality.length > 1000) {
                error = $t("editPage.validation.kintsugiPersonalityLimit");
                return;
            }
            if (k_userPersona.length > 800) {
                error = $t("editPage.validation.kintsugiUserPersonaLimit");
                return;
            }
            if (k_scenario.length > 200) {
                error = $t("editPage.validation.kintsugiScenarioLimit");
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
                return;
            }
            if (!singleInstruction.trim()) {
                error = $t("editPage.validation.allFieldsRequired");
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

        if (
            !persona.name.trim() ||
            !persona.personaType.trim() ||
            !persona.greeting.trim() ||
            !persona.first_scene.trim() ||
            persona.tags.length === 0
        ) {
            error = $t("editPage.validation.allFieldsRequired");
            return;
        }
        if (
            persona.greeting.length > 200 ||
            persona.first_scene.length > 2500
        ) {
            error = $t("editPage.validation.charLimitExceeded");
            return;
        }
        if (
            persona.promptExamples.some((ex) => ex.length > 200) ||
            persona.promptExamples.length > 10
        ) {
            error = $t("editPage.validation.promptExamplesLimitExceeded");
            return;
        }

        loading = true;
        uploadProgress = 0;

        try {
            const id: string | null = await savePersona(persona);
            if (id) {
                showSuccess = true;
                setTimeout(() => (showSuccess = false), 2000);

                if (!persona.id) {
                    goto(`/edit?c=${id}`, { replaceState: true });
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
            if (typeof window !== "undefined")
                window.scrollTo({ top: 0, behavior: "smooth" });
        } finally {
            loading = false;
        }
    }

    function handleStartChat() {
        if (!persona.id) {
            toast.error("저장 후 대화할 수 있습니다.");
            return;
        }
        let llmType = "gemini-flash-lite";
        chatSessions.update((sessions) => {
            const existingSession = sessions.find((s) => s.id === persona?.id);
            if (existingSession && existingSession.llmType)
                llmType = existingSession.llmType;
            return sessions;
        });
        if (persona?.personaType === "3D" || persona?.personaType === "2.5D") {
            llmType = "gemini-flash-lite";
        }

        if (persona?.personaType === "2D" || persona?.personaType === "2d") {
            goto(`/2d?c=${persona.id}&llmType=${llmType}`);
        } else if (persona?.personaType === "3D") {
            goto(`/character?c=${persona.id}&llmType=${llmType}`);
        } else if (persona?.personaType === "2.5D") {
            goto(`/live2d?c=${persona.id}&llmType=${llmType}`);
        } else {
            toast.error(`Unknown Persona Type: ${persona?.personaType}`);
        }
    }
</script>

<div class="container">
    <EditHeader
        {persona}
        {loading}
        {showSuccess}
        {uploadProgress}
        onSave={handleSave}
        onStartChat={handleStartChat}
    />

    {#if error}
        <p class="error">{error}</p>
    {/if}

    <div class="scrollable-content">
        <div class="form-grid">
            <div class="form-column">
                <BasicInfoForm bind:persona bind:previousPersonaType />

                <MediaUploadForm
                    bind:persona
                    {originalPersona}
                    {allVoices}
                    bind:selectedVoiceId
                    on:metadataLoaded={(e) => {
                        availableExpressions = e.detail.expressions;
                        availableMotions = e.detail.motions;
                    }}
                />
            </div>

            <div class="form-column">
                <AiSettingsForm
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
                >
                    <div slot="tags">
                        <TagSelector bind:persona />
                    </div>
                </AiSettingsForm>
            </div>
        </div>
    </div>
</div>

<!-- Mobile-only save button -->
<button
    class="mobile-save-button"
    type="button"
    disabled={loading || showSuccess}
    on:click={handleSave}
>
    {#if loading}
        <span
            >{$t("editPage.saveButtonLoading")} ({Math.round(
                uploadProgress,
            )}%)</span
        >
    {:else if showSuccess}
        <span>{$t("editPage.saveButtonSuccess")}</span>
    {:else}
        <span>{$t("editPage.saveButton")}</span>
    {/if}
</button>

<LoadingAnimation isOpen={loading} />
<FirstCreationRewardModal bind:isOpen={showRewardModal} />

<style>
    .container {
        height: 100%;
        display: flex;
        flex-direction: column;
        background-color: var(--background);
        color: var(--foreground);
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1.5rem;
        box-sizing: border-box;
    }

    .scrollable-content {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
        padding-top: 1.5rem;
    }
    .scrollable-content::-webkit-scrollbar {
        width: 8px;
    }
    .scrollable-content::-webkit-scrollbar-track {
        background: transparent;
    }
    .scrollable-content::-webkit-scrollbar-thumb {
        background: var(--muted-foreground);
        border-radius: 4px;
    }
    .scrollable-content::-webkit-scrollbar-thumb:hover {
        background: var(--foreground-alt);
    }

    .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 1.5rem;
        align-items: start;
    }

    .form-column {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .error {
        color: var(--destructive);
        background-color: hsla(var(--destructive), 0.1);
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
    }

    .mobile-save-button {
        display: none;
    }

    @media (max-width: 768px) {
        .container {
            padding-bottom: 80px;
        }
        .mobile-save-button {
            display: block;
            position: fixed;
            bottom: calc(70px + env(safe-area-inset-bottom));
            left: 0;
            right: 0;
            width: 100%;
            padding: 1rem;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            background: var(--primary-gradient);
            border: none;
            border-top: 1px solid var(--border);
            color: var(--primary-foreground);
            z-index: 10001;
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
            background-size: 200% 200%;
            animation: gradient-animation 3s ease infinite;
        }
        .mobile-save-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .container {
            padding-bottom: calc(160px + env(safe-area-inset-bottom));
        }
    }
</style>

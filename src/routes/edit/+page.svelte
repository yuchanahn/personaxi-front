<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import type { ImageMetadata, Persona, PersonaFeedback } from "$lib/types";
    import { page } from "$app/stores";
    import {
        getUploadUrl,
        loadPersona,
        savePersona,
        uploadFileWithProgress,
    } from "$lib/api/edit_persona";
    import LoadingAnimation from "$lib/components/utils/LoadingAnimation.svelte";
    import { number, t } from "svelte-i18n";
    import FirstCreationRewardModal from "$lib/components/modal/FirstCreationRewardModal.svelte";
    import { st_user } from "$lib/stores/user";
    import { get } from "svelte/store";

    let vrmFile: File | null = null;

    let persona: Persona = {
        id: "",
        owner_id: [],
        name: "",
        personaType: "",
        instructions: [],
        promptExamples: [],
        tags: [],

        feedback: {
            view: 0,
        },
        voice_id: "",
        vrm_url: "", // Add this
        portrait_url: "", // Add this
        image_metadatas: [], // Add this
        visibility: "private", // Add this, default to private
        created_at: "",
        updated_at: "",
        creator_name: "",
        first_scene: "",
        greeting: "",
        likes_count: 0,
        dislikes_count: 0,
        chat_count: 0,
    };

    let instruction = "";
    let promptExample = "";
    let tags = "";
    let error = "";
    let last_id: string | null = null;

    let allVoices: any[] = []; // ElevenLabs에서 받아온 전체 목소리 목록
    let selectedVoiceId = ""; // 사용자가 선택한 voice_id

    $: selectedVoice = allVoices.find((v) => v.voice_id === selectedVoiceId);
    $: if (selectedVoiceId) {
        persona.voice_id = selectedVoiceId;
    } else {
        persona.voice_id = "";
    }

    function load_persona(id: string) {
        loadPersona(id).then((p) => {
            persona = p;
            if (p.voice_id !== "") {
                selectedVoiceId = p.voice_id;
            } else {
                selectedVoiceId = "";
            }
            portraitPreview = p.portrait_url;
        });
    }

    $: {
        const id = $page.url.searchParams.get("c");
        if (id !== last_id) {
            last_id = id;
            if (id) load_persona(id);
        }
    }

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            vrmFile = input.files[0];

            uploadVrmFile();
        }
    }

    let portraitFile: File | null = null;
    let portraitPreview: string | null = null;

    function handleProfileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            portraitFile = input.files[0];
            portraitPreview = URL.createObjectURL(portraitFile);
            uploadPortraitFile();
        }
    }

    onMount(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get("c");
        if (id) {
            load_persona(id);
        }

        try {
            const response = await fetch("/voices.json"); // static/voices.json
            if (response.ok) {
                const data = await response.json();
                allVoices = data.voices;
            }
        } catch (e) {
            console.error("Failed to load voices.json", e);
        }
    });

    function addInstruction() {
        if (instruction.trim() !== "") {
            persona.instructions = [
                ...persona.instructions,
                "\n" + instruction,
            ];
            instruction = "";
        }
    }

    function addPromptExample() {
        if (promptExample.trim()) {
            persona.promptExamples = [
                ...persona.promptExamples,
                promptExample.trim(),
            ];
            promptExample = "";
        }
    }

    function addTag() {
        const newTags = tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag !== "");

        if (newTags.length > 0) {
            persona.tags = [...persona.tags, ...newTags];
            tags = "";
        }
    }

    function removeInstruction(index: number) {
        persona.instructions = persona.instructions.filter(
            (_, i) => i !== index,
        );
    }

    function removePromptExample(index: number) {
        persona.promptExamples = persona.promptExamples.filter(
            (_, i) => i !== index,
        );
    }

    function removeTag(index: number) {
        persona.tags = persona.tags.filter((_, i) => i !== index);
    }

    let loading = false;
    let showSuccess = false;
    let uploadProgress = 0;

    let showRewardModal = false;
    let hasReceivedFirstCreationReward =
        get(st_user)?.data.hasReceivedFirstCreationReward ?? false;

    function removeAssetByIndex(indexToRemove: number) {
        persona.image_metadatas = persona.image_metadatas.filter(
            (_, index) => index !== indexToRemove,
        );
    }

    async function handleAssetFileChange(event: Event, assetId: number) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const file = input.files[0];
            await uploadAssetFile(assetId, file);
        }
    }

    let assets_progress: Map<number, number> = new Map();
    let vrm_progress: number = 0;
    let portrait_progress: number = 0;

    async function handleMultipleAssetFiles(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            Array.from(input.files).forEach(async (file) => {
                const asset: ImageMetadata = {
                    url: "",
                    description: file.name,
                };
                if (persona.image_metadatas == null) {
                    persona.image_metadatas = [];
                }

                persona.image_metadatas.push(asset);
                await uploadAssetFile(persona.image_metadatas.length - 1, file);
            });
        }
    }

    const supabaseURL =
        "https://uohepkqmwbstbmnkoqju.supabase.co/storage/v1/object/public/personaxi-assets/";

    async function uploadAssetFile(assetId: number, file: File) {
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await getUploadUrl("asset");
                if (!response.ok) {
                    throw new Error(
                        `Server error on getting URL: ${response.status}`,
                    );
                }
                const { signedURL, fileName } = await response.json();

                if (attempt === 1) {
                    persona.image_metadatas[assetId].url =
                        URL.createObjectURL(file);
                    persona.image_metadatas = [...persona.image_metadatas];
                }

                await uploadFileWithProgress(signedURL, file, (percent) => {
                    assets_progress.set(assetId, percent);
                    assets_progress = assets_progress;
                });

                assets_progress.delete(assetId);
                assets_progress = assets_progress;
                persona.image_metadatas[assetId].url =
                    `${supabaseURL}${fileName}`;

                console.log(
                    `✅ ${file.name} uploaded successfully on attempt ${attempt}`,
                );

                return;
            } catch (e: any) {
                console.warn(
                    `Attempt ${attempt} for ${file.name} failed: ${e.message}`,
                );

                if (attempt === MAX_RETRIES) {
                    error = `File upload failed for ${file.name} after ${MAX_RETRIES} attempts.`;
                    console.error("Giving up on upload for", file.name);
                } else {
                    await new Promise((res) => setTimeout(res, 500));
                }
            }
        }
    }

    async function uploadVrmFile() {
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await getUploadUrl("vrm");
                if (!response.ok) {
                    throw new Error(
                        `Server error on getting URL: ${response.status}`,
                    );
                }
                const { signedURL, fileName } = await response.json();

                vrm_progress = 0.01;

                await uploadFileWithProgress(signedURL, vrmFile!, (percent) => {
                    vrm_progress = Math.round(percent);
                });
                persona.vrm_url = `${supabaseURL}${fileName}`;
                vrm_progress = 0;

                console.log(
                    `✅ ${vrmFile!.name} uploaded successfully on attempt ${attempt}`,
                );

                return;
            } catch (e: any) {
                console.warn(
                    `Attempt ${attempt} for ${vrmFile!.name} failed: ${e.message}`,
                );

                if (attempt === MAX_RETRIES) {
                    error = `File upload failed for ${vrmFile!.name} after ${MAX_RETRIES} attempts.`;
                    console.error("Giving up on upload for", vrmFile!.name);
                } else {
                    await new Promise((res) => setTimeout(res, 500));
                }
            }
        }
    }

    async function uploadPortraitFile() {
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await getUploadUrl("portrait");
                if (!response.ok) {
                    throw new Error(
                        `Server error on getting URL: ${response.status}`,
                    );
                }
                const { signedURL, fileName } = await response.json();

                portrait_progress = 0.01;

                await uploadFileWithProgress(
                    signedURL,
                    portraitFile!,
                    (percent) => {
                        portrait_progress = Math.round(percent);
                    },
                );
                persona.portrait_url = `${supabaseURL}${fileName}`;
                portraitPreview = `${supabaseURL}${fileName}`;
                portrait_progress = 0;

                console.log(
                    `✅ ${portraitFile!.name} uploaded successfully on attempt ${attempt}`,
                );

                return;
            } catch (e: any) {
                console.warn(
                    `Attempt ${attempt} for ${portraitFile!.name} failed: ${e.message}`,
                );

                if (attempt === MAX_RETRIES) {
                    error = `File upload failed for ${portraitFile!.name} after ${MAX_RETRIES} attempts.`;
                    console.error(
                        "Giving up on upload for",
                        portraitFile!.name,
                    );
                } else {
                    await new Promise((res) => setTimeout(res, 500));
                }
            }
        }
    }
</script>

<div class="container">
    <div class="header">
        <h1>{$t("editPage.title")}</h1>
        <button
            class="save-button"
            type="submit"
            on:click={async () => {
                if (loading || showSuccess) return;

                error = "";

                if (
                    !persona.name.trim() ||
                    !persona.personaType.trim() ||
                    !persona.greeting.trim() ||
                    !persona.first_scene.trim() ||
                    persona.instructions.length === 0 ||
                    persona.promptExamples.length === 0 ||
                    persona.tags.length === 0
                ) {
                    error = $t("editPage.validation.allFieldsRequired");
                    return;
                }

                if (
                    persona.greeting.length > 200 ||
                    persona.first_scene.length > 500
                ) {
                    error = $t("editPage.validation.charLimitExceeded");
                    return;
                }

                if (
                    persona.instructions.some((inst) => inst.length > 200) ||
                    persona.instructions.length > 10
                ) {
                    error = $t("editPage.validation.instructionsLimitExceeded");
                    return;
                }

                if (
                    persona.promptExamples.some((ex) => ex.length > 200) ||
                    persona.promptExamples.length > 10
                ) {
                    error = $t(
                        "editPage.validation.promptExamplesLimitExceeded",
                    );
                    return;
                }

                if (
                    persona.greeting.length > 200 ||
                    persona.first_scene.length > 500
                ) {
                    error = "소개 또는 첫 장면의 글자 수를 초과했습니다.";
                    return;
                }

                if (
                    persona.instructions.some((inst) => inst.length > 200) ||
                    persona.instructions.length > 10
                ) {
                    error = "지침의 글자 수를 초과했거나 10개를 초과했습니다.";
                    return;
                }

                if (
                    persona.promptExamples.some((ex) => ex.length > 200) ||
                    persona.promptExamples.length > 10
                ) {
                    error = $t(
                        "editPage.validation.promptExamplesLimitExceeded",
                    );
                    return;
                }

                loading = true;
                uploadProgress = 0; // 저장 시작 시 진행률 초기화

                try {
                    const id: string | null = await savePersona(persona);

                    if (id) {
                        showSuccess = true;

                        setTimeout(() => {
                            showSuccess = false;
                        }, 2000);

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
                } finally {
                    loading = false;
                }
            }}
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
    </div>
    {#if error}
        <p class="error">{error}</p>
    {/if}
    <div class="scrollable-content">
        <div class="form-grid">
            <div class="form-column">
                <div class="form-section-card">
                    <h2>{$t("editPage.basicInfo")}</h2>
                    <div class="form-group">
                        <label for="name">{$t("editPage.nameLabel")}</label>
                        <input
                            id="name"
                            bind:value={persona.name}
                            required
                            placeholder={$t("editPage.namePlaceholder")}
                        />
                    </div>
                    <div class="form-group">
                        <label for="greeting"
                            >{$t("editPage.greetingLabel", {
                                default: $t("editPage.greetingLabelDefault"),
                            })}</label
                        >
                        <p class="description">
                            {$t("editPage.greetingDescription", {
                                default: $t(
                                    "editPage.greetingDescriptionDefault",
                                ),
                            })}
                        </p>
                        <textarea
                            id="greeting"
                            bind:value={persona.greeting}
                            placeholder={$t("editPage.greetingPlaceholder", {
                                default: $t(
                                    "editPage.greetingPlaceholderDefault",
                                ),
                            })}
                            rows="3"
                            maxlength="200"
                        ></textarea>
                        <div
                            class="char-counter"
                            class:warning={persona.greeting.length > 160}
                            class:error={persona.greeting.length >= 200}
                        >
                            {persona.greeting.length} / 200
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="personaType"
                            >{$t("editPage.typeLabel")}</label
                        >
                        <select
                            id="personaType"
                            bind:value={persona.personaType}
                            required
                        >
                            <option value="" disabled
                                >{$t("editPage.typeSelectDefault")}</option
                            >
                            <option value="3D">3D</option>
                            <option value="2D">2D</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="visibility"
                            >{$t("editPage.visibilityLabel")}</label
                        >
                        <select
                            id="visibility"
                            bind:value={persona.visibility}
                            required
                        >
                            <option value="public"
                                >{$t("editPage.public")}</option
                            >
                            <option value="private"
                                >{$t("editPage.private")}</option
                            >
                        </select>
                    </div>
                </div>

                <div class="form-section-card">
                    <h2>{$t("editPage.mediaFiles")}</h2>
                    <div class="form-group">
                        <label for="portrait"
                            >{$t("editPage.profileImageLabel")}</label
                        >
                        <div class="file-input-container">
                            <label for="portrait-file" class="file-input-label">
                                <span>{$t("editPage.fileSelect")}</span>
                            </label>
                            <input
                                id="portrait-file"
                                type="file"
                                accept="image/*"
                                on:change={handleProfileChange}
                                class="file-input-hidden"
                            />
                            {#if portraitFile}
                                <span class="file-name"
                                    >{portraitFile.name}</span
                                >
                            {/if}
                        </div>
                        {#if portraitPreview}
                            <img
                                src={portraitPreview}
                                alt="Profile preview"
                                class="preview-image"
                            />
                        {/if}

                        {#if persona.personaType == "2D"}
                            <div class="form-group asset-section">
                                <h3 class="asset-title">
                                    {$t("editPage.assetSectionTitle")}
                                </h3>
                                <p class="description">
                                    {$t("editPage.assetSectionDescription")}
                                </p>

                                <div class="asset-card-list">
                                    {#each persona.image_metadatas as asset, index}
                                        <div class="asset-card">
                                            <div class="asset-image-uploader">
                                                {#if asset.url !== ""}
                                                    <img
                                                        src={asset.url}
                                                        alt="에셋 미리보기"
                                                        class="asset-preview-image"
                                                    />
                                                {/if}
                                                {#if assets_progress.has(index)}
                                                    <div
                                                        class="progress-bar-overlay"
                                                    >
                                                        <div
                                                            class="progress-bar"
                                                            style="width: {assets_progress.get(
                                                                index,
                                                            )}%"
                                                        ></div>
                                                    </div>
                                                {/if}
                                                <label
                                                    for="asset-file-{index}"
                                                    class="file-input-label small"
                                                >
                                                    <span
                                                        >{$t(
                                                            "editPage.imageSelect",
                                                        )}</span
                                                    >
                                                </label>
                                                <input
                                                    id="asset-file-{index}"
                                                    type="file"
                                                    accept="image/*"
                                                    class="file-input-hidden"
                                                    on:change={(e) =>
                                                        handleAssetFileChange(
                                                            e,
                                                            index,
                                                        )}
                                                />
                                            </div>
                                            <div class="asset-details">
                                                <textarea
                                                    class="asset-description-input"
                                                    placeholder={$t(
                                                        "editPage.assetDescriptionPlaceholder",
                                                    )}
                                                    rows="3"
                                                    bind:value={
                                                        asset.description
                                                    }
                                                ></textarea>
                                                <button
                                                    class="btn-remove asset-remove"
                                                    on:click={() =>
                                                        removeAssetByIndex(
                                                            index,
                                                        )}
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        </div>
                                    {/each}
                                </div>

                                <div class="asset-actions">
                                    <label
                                        for="multiple-asset-upload"
                                        class="btn btn-secondary"
                                    >
                                        {$t("editPage.addAssetButton")}
                                    </label>
                                    <input
                                        id="multiple-asset-upload"
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        class="file-input-hidden"
                                        on:change={handleMultipleAssetFiles}
                                    />
                                </div>
                            </div>
                        {/if}
                    </div>

                    {#if persona.personaType == "3D"}
                        <div class="form-group">
                            <label for="vrm"
                                >{$t("editPage.vrmFileLabel")}</label
                            >
                            <div class="file-input-container">
                                <label for="vrm-file" class="file-input-label">
                                    <span>{$t("editPage.fileSelect")}</span>
                                </label>
                                <input
                                    id="vrm-file"
                                    type="file"
                                    accept=".vrm"
                                    on:change={handleFileChange}
                                    class="file-input-hidden"
                                />
                                {#if vrmFile}
                                    <span class="file-name">{vrmFile.name}</span
                                    >
                                {/if}
                                {#if vrm_progress > 0}
                                    {vrm_progress}%
                                {/if}
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="voice-select"
                                >{$t("editPage.voiceLabel")}</label
                            >
                            <p class="description">
                                {$t("editPage.voiceDescription")}
                            </p>
                            {#if allVoices.length > 0}
                                <div class="voice-selector">
                                    <select
                                        id="voice-select"
                                        bind:value={selectedVoiceId}
                                    >
                                        <option value="" disabled
                                            >{$t(
                                                "editPage.voiceSelectDefault",
                                            )}</option
                                        >
                                        {#each allVoices as voice (voice.voice_id)}
                                            <option value={voice.voice_id}
                                                >{voice.name}</option
                                            >
                                        {/each}
                                    </select>

                                    {#if selectedVoice}
                                        {#key selectedVoice.voice_id}
                                            <audio
                                                controls
                                                src={selectedVoice.preview_url}
                                            >
                                                Your browser does not support
                                                the audio element.
                                            </audio>
                                        {/key}
                                    {/if}
                                </div>
                            {:else}
                                <p>{$t("editPage.voiceLoading")}</p>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>

            <div class="form-column">
                <div class="form-section-card">
                    <h2>{$t("editPage.aiSettings")}</h2>
                    <div class="form-group">
                        <label for="first_scene"
                            >{$t("editPage.firstSceneLabel")}</label
                        >
                        <p class="description">
                            {$t("editPage.firstSceneDescription")}
                        </p>
                        <textarea
                            id="first_scene"
                            bind:value={persona.first_scene}
                            placeholder={$t("editPage.firstScenePlaceholder")}
                            rows="5"
                            maxlength="500"
                        ></textarea>
                        <div
                            class="char-counter"
                            class:warning={persona.first_scene.length > 400}
                            class:error={persona.first_scene.length >= 500}
                        >
                            {persona.first_scene.length} / 500
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="instruction-input"
                            >{$t("editPage.instructionsLabel")}</label
                        >
                        <p class="description">
                            {$t("editPage.instructionsDescription")}
                        </p>
                        <div class="input-group">
                            <!-- svelte-ignore element_invalid_self_closing_tag -->
                            <textarea
                                id="instruction-input"
                                bind:value={instruction}
                                placeholder={$t(
                                    "editPage.instructionsPlaceholder",
                                )}
                                rows="3"
                                maxlength="200"
                            />
                            <button
                                type="button"
                                class="btn btn-secondary"
                                class:btn-add-emphasis={instruction.length > 0}
                                on:click={addInstruction}
                                disabled={persona.instructions.length >= 10}
                                >{$t("editPage.addButton")}</button
                            >
                        </div>
                        <div
                            class="char-counter"
                            class:warning={instruction.length > 160}
                            class:error={instruction.length >= 200}
                        >
                            {instruction.length} / 200 | {persona.instructions
                                .length} / 10
                        </div>
                        <ul class="item-list">
                            {#each persona.instructions as inst, i}
                                <li class="item">
                                    <span class="item-text">{inst}</span>
                                    <button
                                        type="button"
                                        class="btn-remove"
                                        on:click={() => removeInstruction(i)}
                                        >&times;</button
                                    >
                                </li>
                            {/each}
                        </ul>
                    </div>
                    <div class="form-group">
                        <label for="prompt-example-input"
                            >{$t("editPage.promptExamplesLabel")}</label
                        >
                        <p class="description">
                            {$t("editPage.promptExamplesDescription")}
                        </p>
                        <div class="input-group">
                            <input
                                id="prompt-example-input"
                                bind:value={promptExample}
                                placeholder={$t(
                                    "editPage.promptExamplesPlaceholder",
                                )}
                                maxlength="200"
                            />
                            <button
                                type="button"
                                class="btn btn-secondary"
                                on:click={addPromptExample}
                                disabled={persona.promptExamples.length >= 10}
                                >{$t("editPage.addButton")}</button
                            >
                        </div>
                        <div
                            class="char-counter"
                            class:warning={promptExample.length > 160}
                            class:error={promptExample.length >= 200}
                        >
                            {promptExample.length} / 200 | {persona
                                .promptExamples.length} / 10
                        </div>
                        <ul class="item-list">
                            {#each persona.promptExamples as prompt, i}
                                <li class="item">
                                    <span class="item-text">{prompt}</span>
                                    <button
                                        type="button"
                                        class="btn-remove"
                                        on:click={() => removePromptExample(i)}
                                        >&times;</button
                                    >
                                </li>
                            {/each}
                        </ul>
                    </div>
                    <div class="form-group">
                        <label for="tags-input"
                            >{$t("editPage.tagsLabel")}</label
                        >
                        <p class="description">
                            {$t("editPage.tagsDescription")}
                        </p>
                        <div class="input-group">
                            <input
                                id="tags-input"
                                type="text"
                                bind:value={tags}
                                placeholder={$t("editPage.tagsPlaceholder")}
                                on:keydown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addTag();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                class="btn btn-secondary"
                                class:btn-add-emphasis={tags.length > 0}
                                on:click={addTag}
                                >{$t("editPage.addButton")}</button
                            >
                        </div>
                        <ul class="tag-list">
                            {#each persona.tags as tag, i}
                                <li class="tag-item">
                                    {tag}
                                    <button
                                        type="button"
                                        class="btn-remove"
                                        on:click={() => removeTag(i)}
                                        >&times;</button
                                    >
                                </li>
                            {/each}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
<LoadingAnimation isOpen={loading} />
<FirstCreationRewardModal bind:isOpen={showRewardModal} />

<style>
    /* === 기본 레이아웃 === */
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

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem 0;
        flex-shrink: 0;
        border-bottom: 1px solid var(--border);
    }

    .scrollable-content {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
        padding-top: 1.5rem;
    }
    /* 스크롤바 디자인 */
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

    /* === 2단 폼 레이아웃 === */
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

    .form-section-card {
        background-color: var(--card);
        border: 1px solid var(--border-card);
        border-radius: var(--radius-card);
        padding: 1.5rem;
    }
    .form-section-card h2 {
        margin-top: 0;
        margin-bottom: 1.5rem;
        font-size: 1.25rem;
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.75rem;
    }

    /* === 폼 요소 공통 스타일 === */
    .form-group {
        margin-bottom: 1.5rem;
    }
    .form-group:last-child {
        margin-bottom: 0;
    }
    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
    }
    .description {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        margin-top: -0.25rem;
        margin-bottom: 0.75rem;
    }
    input,
    select,
    textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-input);
        background: var(--input);
        color: var(--foreground);
        box-sizing: border-box;
        transition:
            border-color 0.2s,
            box-shadow 0.2s;
    }
    input:focus,
    select:focus,
    textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 2px var(--ring);
    }

    .input-group {
        display: flex;
        gap: 0.5rem;
    }
    .input-group > :first-child {
        flex: 1;
    }

    /* === 커스텀 파일 업로드 === */
    .file-input-hidden {
        display: none;
    }
    .file-input-container {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    .file-input-label {
        display: inline-block;
        padding: 0.6rem 1.2rem;
        background-color: var(--secondary);
        border: 1px solid var(--border);
        border-radius: var(--radius-button);
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .file-input-label:hover {
        background-color: var(--muted);
    }
    .file-name {
        font-size: 0.9rem;
        color: var(--muted-foreground);
    }
    .preview-image {
        margin-top: 1rem;
        max-width: 150px;
        max-height: 150px;
        border-radius: var(--radius-input);
        object-fit: cover;
        border: 1px solid var(--border);
    }

    /* === 동적 아이템 리스트 === */
    .item-list {
        list-style: none;
        padding: 0;
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        background: var(--muted);
        padding: 0.75rem;
        border-radius: var(--radius-card-sm);
        font-size: 0.9rem;
        line-height: 1.5;
        word-break: break-word;
    }
    .item-text {
        white-space: pre-wrap;
    }

    .tag-list {
        list-style: none;
        padding: 0;
        margin-top: 1rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .tag-item {
        background-color: var(--secondary);
        color: var(--secondary-foreground);
        padding: 0.3rem 0.8rem;
        border-radius: 16px;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
    }

    /* === 버튼 === */
    .btn {
        padding: 0.6rem 1.2rem;
        font-size: 0.9rem;
        font-weight: 600;
        border: 1px solid var(--border);
        border-radius: var(--radius-button);
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-secondary {
        background: var(--secondary);
        color: var(--secondary-foreground);
    }
    .btn-secondary:hover:not(:disabled) {
        opacity: 0.9;
    }

    .btn-add-emphasis {
        animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 hsl(260 90% 68% / 0.7);
            border-color: hsl(260 90% 68% / 0.8);
        }
        70% {
            box-shadow: 0 0 0 8px hsl(260 90% 68% / 0);
            border-color: hsl(260 90% 68% / 1);
        }
        100% {
            box-shadow: 0 0 0 0 hsl(260 90% 68% / 0);
            border-color: hsl(260 90% 68% / 0.8);
        }
    }

    .btn-remove {
        background: none;
        border: none;
        color: var(--muted-foreground);
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
        padding: 0 0.25rem;
    }
    .btn-remove:hover {
        color: var(--destructive);
    }

    .save-button {
        padding: 0.6rem 1.2rem;
        font-size: 0.9rem;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        background: var(--primary-gradient);
        border: 1px solid var(--primary-gradient);
        color: var(--primary-foreground);

        background-size: 200% 200%;
        animation: gradient-animation 3s ease infinite;
    }
    .save-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .save-button:hover:not(:disabled) {
        opacity: 0.9;
    }

    .error {
        color: var(--destructive);
        background-color: hsla(var(--destructive), 0.1);
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
    }

    .save-button.success {
        background: #28a745; /* 이건 성공 상태를 위한 특별한 색이라 그대로 둬도 좋아! */
        border-color: #28a745;
    }

    .char-counter {
        font-size: 0.8rem;
        color: var(--muted-foreground);
        text-align: right;
        margin-top: 0.25rem;
    }
    .char-counter.warning {
        color: orange;
    }
    .char-counter.error {
        color: var(--destructive);
    }

    .voice-selector {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .voice-selector select {
        flex: 1;
    }

    .voice-selector audio {
        height: 42px;
    }

    .voice-selector audio::-webkit-media-controls-panel {
        background-color: var(--muted);
        color: var(--foreground);
    }
    .voice-selector audio::-webkit-media-controls-play-button,
    .voice-selector audio::-webkit-media-controls-timeline,
    .voice-selector audio::-webkit-media-controls-current-time-display,
    .voice-selector audio::-webkit-media-controls-time-remaining-display,
    .voice-selector audio::-webkit-media-controls-volume-slider,
    .voice-selector audio::-webkit-media-controls-mute-button {
        filter: invert(1) grayscale(1) brightness(1.5);
    }

    .asset-section {
        border-top: 1px solid var(--border);
        margin-top: 1.5rem;
        padding-top: 1.5rem;
    }

    .asset-title {
        font-size: 1.1rem;
        margin: 0 0 0.5rem 0;
    }

    .asset-card-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .asset-card {
        display: flex;
        gap: 1rem;
        background-color: var(--muted);
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid var(--border);
    }

    .asset-image-uploader {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 120px;
        height: 120px;
        flex-shrink: 0;
        background-color: var(--background);
        border-radius: 6px;
        position: relative;
        overflow: hidden;
    }

    .asset-preview-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 6px;
    }

    .file-input-label.small {
        padding: 0.4rem 0.8rem;
        font-size: 0.8rem;
        position: absolute;
        bottom: 8px;
    }

    .asset-details {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        position: relative;
    }

    .asset-description-input {
        flex-grow: 1;
        resize: vertical;
    }

    .asset-remove {
        position: absolute;
        top: -8px;
        right: -8px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background-color: var(--card);
    }

    .asset-actions {
        display: flex;
        gap: 0.5rem;
    }

    .progress-bar-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: flex-start;
    }

    .progress-bar {
        width: 0%;
        height: 5px;
        background-color: var(--primary);
        transition: width 0.2s ease-in-out;
    }
</style>

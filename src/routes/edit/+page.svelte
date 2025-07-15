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
            like: 0,
            dislike: 0,
            view: 0,
        },
        voice_id: "",
        vrm_url: "", // Add this
        portrait_url: "", // Add this
        image_metadatas: [], // Add this
        visibility: "private", // Add this, default to private
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

                if (!persona.name.trim() || !persona.personaType) {
                    error = $t("editPage.errorRequired");
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
                    } else {
                        console.log("ID 보낸거 맞냐?? 쓰바? ㅋㅋ ");
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
                        <label for="visibility">공개 여부</label>
                        <select
                            id="visibility"
                            bind:value={persona.visibility}
                            required
                        >
                            <option value="public">공개</option>
                            <option value="private">비공개</option>
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
                                    에셋 (상황별 이미지)
                                </h3>
                                <p class="description">
                                    채팅 중 특정 상황에 맞는 이미지를 표시할 수
                                    있습니다.
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
                                                    <span>이미지 선택</span>
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
                                                    placeholder="이미지 상황 설명 (예: 웃는 얼굴, 슬픈 표정)"
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
                                        + 에셋 추가
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
                            />
                            <button
                                type="button"
                                class="btn btn-secondary"
                                on:click={addInstruction}
                                >{$t("editPage.addButton")}</button
                            >
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
                            />
                            <button
                                type="button"
                                class="btn btn-secondary"
                                on:click={addPromptExample}
                                >{$t("editPage.addButton")}</button
                            >
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
    :root {
        --bg-primary: #121212;
        --bg-secondary: #1e1e1e;
        --bg-tertiary: #2a2a2a;
        --text-primary: #e0e0e0;
        --text-secondary: #a0a0a0;
        --border-color: #333;
        --accent-primary: #4a90e2;
        --accent-danger: #e24a4a;
    }

    /* === 기본 레이아웃 === */
    .container {
        height: 100vh;
        display: flex;
        flex-direction: column;
        background-color: var(--bg-primary);
        color: var(--text-primary);
        max-width: 1200px; /* 최대 너비 조정 */
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
        border-bottom: 1px solid var(--border-color);
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
        background: #555;
        border-radius: 4px;
    }
    .scrollable-content::-webkit-scrollbar-thumb:hover {
        background: #777;
    }

    /* === 2단 폼 레이아웃 === */
    .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 1.5rem;
        align-items: start;
    }

    .form-column {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .form-section-card {
        background-color: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 1.5rem;
    }
    .form-section-card h2 {
        margin-top: 0;
        margin-bottom: 1.5rem;
        font-size: 1.25rem;
        border-bottom: 1px solid var(--border-color);
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
        color: var(--text-secondary);
        margin-top: -0.25rem;
        margin-bottom: 0.75rem;
    }
    input,
    select,
    textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-tertiary);
        color: var(--text-primary);
        box-sizing: border-box;
        transition:
            border-color 0.2s,
            box-shadow 0.2s;
    }
    input:focus,
    select:focus,
    textarea:focus {
        outline: none;
        border-color: var(--accent-primary);
        box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.3);
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
        background-color: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .file-input-label:hover {
        background-color: #3c3c3c;
    }
    .file-name {
        font-size: 0.9rem;
        color: var(--text-secondary);
    }
    .preview-image {
        margin-top: 1rem;
        max-width: 150px;
        max-height: 150px;
        border-radius: 8px;
        object-fit: cover;
        border: 1px solid var(--border-color);
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
        background: var(--bg-tertiary);
        padding: 0.75rem;
        border-radius: 6px;
        font-size: 0.9rem;
        line-height: 1.5;
        word-break: break-word;
    }
    .item-text {
        white-space: pre-wrap; /* 줄바꿈 문자 표시 */
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
        background-color: var(--bg-tertiary);
        color: var(--text-primary);
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
        border: 1px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
    }
    .btn-primary {
        background: var(--accent-primary);
        border-color: var(--accent-primary);
        color: white;
    }
    .btn-primary:hover:not(:disabled) {
        background: #62a2e9;
    }

    .btn-secondary {
        background: var(--bg-tertiary);
        color: var(--text-primary);
    }
    .btn-secondary:hover:not(:disabled) {
        background: #3c3c3c;
    }

    .btn-remove {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
        padding: 0 0.25rem;
    }
    .btn-remove:hover {
        color: var(--accent-danger);
    }

    .save-button {
        /* .btn, .btn-primary 스타일 상속 */
        padding: 0.6rem 1.2rem;
        font-size: 0.9rem;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        background: var(--accent-primary);
        border: 1px solid var(--accent-primary);
        color: white;
    }
    .save-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .save-button:hover:not(:disabled) {
        background: #62a2e9;
        border-color: #62a2e9;
    }

    .error {
        color: var(--accent-danger);
        background-color: rgba(226, 74, 74, 0.1);
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
    }

    /* 기존 .save-button 관련 스타일 아래에 추가 */
    .save-button.success {
        background: #28a745; /* 성공 시 초록색 배경 */
        border-color: #28a745;
    }

    .save-button:disabled {
        opacity: 0.8; /* 로딩 중일 때 버튼 약간 투명하게 */
        cursor: wait; /* 커서 모양 변경 */
    }

    /* style 블록 맨 아래에 추가 */

    .voice-selector {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .voice-selector select {
        flex: 1;
    }

    .voice-selector audio {
        height: 42px; /* select 태그 높이와 비슷하게 맞춤 */
    }

    /* 오디오 플레이어 컨트롤을 어두운 테마에 맞게 조정 */
    .voice-selector audio::-webkit-media-controls-panel {
        background-color: var(--bg-tertiary);
        color: var(--text-primary);
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
        border-top: 1px solid var(--border-color);
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
        background-color: var(--bg-tertiary);
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid var(--border-color);
    }

    .asset-image-uploader {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 120px;
        height: 120px;
        flex-shrink: 0;
        background-color: var(--bg-primary);
        border-radius: 6px;
        position: relative;
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
        /* 미리보기가 있을 때만 보이도록, 혹은 항상 보이도록 조절 가능 */
    }

    .asset-details {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        position: relative;
    }

    .asset-description-input {
        flex-grow: 1; /* 남은 공간을 모두 차지 */
        resize: vertical; /* 세로 크기만 조절 가능 */
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
        background-color: var(--bg-tertiary);
    }

    .asset-actions {
        display: flex;
        gap: 0.5rem;
    }

    .progress-bar-container {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 5px;
        background-color: rgba(0, 0, 0, 0.5);
        border-bottom-left-radius: 6px;
        border-bottom-right-radius: 6px;
        overflow: hidden;
    }
    .asset-image-uploader {
        /* position: relative; 가 이미 있으니 그대로 활용 */
        overflow: hidden; /* 자식 요소가 튀어나가지 않게 */
    }

    .progress-bar-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.6); /* 반투명 검은 배경 */
        display: flex;
        align-items: flex-start; /* 프로그레스 바를 상단에 위치시킴 */
    }

    .progress-bar {
        width: 0%; /* 기본 넓이는 0 */
        height: 5px; /* 프로그레스 바 두께 */
        background-color: var(--accent-primary); /* 테마의 accent 색상 사용 */
        transition: width 0.2s ease-in-out; /* 넓이가 변할 때 부드럽게 애니메이션 */
    }

    .upload-success,
    .upload-error {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 2rem;
        font-weight: bold;
        color: white;
        background-color: rgba(0, 0, 0, 0.7);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .upload-success {
        background-color: rgba(40, 167, 69, 0.7); /* Green */
    }

    .upload-error {
        background-color: rgba(220, 53, 69, 0.7); /* Red */
    }
</style>

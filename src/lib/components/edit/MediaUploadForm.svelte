<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import AssetPreview from "$lib/components/AssetPreview.svelte";
    import { toast } from "$lib/stores/toast";
    import { confirmStore } from "$lib/stores/confirm";
    import { validateVRMLicense } from "$lib/utils/editPageUtils";
    import { extractFirstFrame, checkVideoDuration } from "$lib/utils/media";
    import { FFmpegManager } from "$lib/utils/ffmpeg";
    import {
        getUploadUrl,
        uploadFileWithProgress,
        uploadLive2DZip,
    } from "$lib/api/edit_persona";
    import type { ImageMetadata, Persona } from "$lib/types";

    export let persona: Persona;
    export let originalPersona: Persona | null;
    export let allVoices: any[] = [];
    export let selectedVoiceId: string;

    const supabaseURL = "/storage/v1/object/public/personaxi-assets/";

    let vrmFile: File | null = null;
    let live2dFile: File | null = null;
    let portraitFile: File | null = null;
    let portraitImageFile: File | null = null;
    let portraitPreview: string | null = null;
    let portraitPreviewType: "image" | "video" | undefined = undefined;
    let vrmInput: HTMLInputElement;

    let live2d_progress = 0;
    let vrm_progress = 0;
    let portrait_progress = 0;
    let compression_progress = 0;
    let isCompressing = false;
    let assets_progress: Map<number, number> = new Map();
    let error = "";
    let copiedState = new Map<number, boolean>();

    // Initial portrait preview from persona
    $: if (persona.portrait_url && !portraitPreview) {
        portraitPreview = persona.portrait_url;
        // Leave portraitPreviewType undefined to let AssetPreview fetch type for remote URL
    }

    async function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            vrmFile = input.files[0];

            const isValid = await validateVRMLicense(vrmFile);
            if (!isValid) {
                toast.error($t("editPage.vrmLicenseError"));
                input.value = ""; // Clear input
                vrmFile = null;
                return;
            }

            uploadVrmFile();
        }
    }

    async function handleProfileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const originalFile = input.files[0];
            portraitFile = originalFile;

            // Check if video
            if (originalFile.type.startsWith("video/")) {
                // 1. Duration Check (Max 5s)
                const { valid, duration } = await checkVideoDuration(
                    originalFile,
                    5,
                );
                if (!valid) {
                    if (duration > 5) {
                        toast.error(
                            `Video is too long (${duration.toFixed(1)}s). Max 5 seconds allowed.`,
                        );
                    } else {
                        toast.error("Failed to load video metadata.");
                    }
                    input.value = ""; // Reset input
                    return;
                }

                const frame = await extractFirstFrame(originalFile);
                if (frame) {
                    portraitImageFile = frame;
                    portraitPreview = URL.createObjectURL(frame);
                    portraitPreviewType = "image"; // Thumbnail is an image
                } else {
                    portraitPreview = URL.createObjectURL(originalFile);
                    portraitPreviewType = "video"; // Fallback to video
                }

                // Compress Video
                try {
                    isCompressing = true;
                    compression_progress = 0;
                    toast.info("Compressing video... Please wait.");

                    const compressed =
                        await FFmpegManager.getInstance().compressVideo(
                            originalFile,
                            (p) => {
                                compression_progress = p;
                            },
                        );

                    portraitFile = compressed; // Use compressed file for upload
                    toast.success("Compression complete!");
                } catch (e) {
                    console.error("Compression failed, using original:", e);
                    toast.error("Compression failed. Uploading original.");
                } finally {
                    isCompressing = false;
                    compression_progress = 0;
                }
            } else {
                portraitImageFile = null; // Reset if not video
                portraitPreview = URL.createObjectURL(originalFile);
                portraitPreviewType = "image";
            }

            uploadPortraitFile();
        }
    }

    async function uploadVrmFile() {
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Only delete if different from original
                const isTemp = persona.vrm_url !== originalPersona?.vrm_url;
                const oldUrl =
                    persona.vrm_url &&
                    !persona.vrm_url.startsWith("blob:") &&
                    isTemp
                        ? persona.vrm_url
                        : undefined;
                const response = await getUploadUrl("vrm", oldUrl);
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
                // Only delete if different from original
                const isTemp =
                    persona.portrait_url !== originalPersona?.portrait_url;
                const oldUrl =
                    persona.portrait_url &&
                    !persona.portrait_url.startsWith("blob:") &&
                    isTemp
                        ? persona.portrait_url
                        : undefined;
                const response = await getUploadUrl("portrait", oldUrl);
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
                // portraitPreview = `${supabaseURL}${fileName}`; // Already set to blob or previous, but update to confirm? Blob is fine for preview.
                portrait_progress = 0;

                // Upload static portrait if exists (e.g. video thumbnail)
                if (portraitImageFile) {
                    await uploadStaticPortrait(portraitImageFile);
                } else {
                    persona.static_portrait_url = persona.portrait_url;
                }

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

    async function uploadStaticPortrait(file: File) {
        try {
            const response = await getUploadUrl("asset", undefined);
            if (!response.ok) return;

            const { signedURL, fileName } = await response.json();

            await uploadFileWithProgress(signedURL, file, (p) => {});

            persona.static_portrait_url = `${supabaseURL}${fileName}`;
        } catch (e) {
            console.error("Failed to upload static portrait", e);
        }
    }

    async function handleLive2DUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        live2dFile = file;
        live2d_progress = 0;
        error = "";

        try {
            // Only delete if it's NOT the original file (i.e. it's a temp file)
            const oldUrl =
                persona.live2d_model_url !== originalPersona?.live2d_model_url
                    ? persona.live2d_model_url
                    : undefined;

            const result = await uploadLive2DZip(
                file,
                (percent) => {
                    live2d_progress = Math.round(percent);
                },
                oldUrl,
            );

            persona.live2d_model_url = result.model3_json_url;
            // Note: availableExpressions/Motions need to be passed up if used elsewhere,
            // but for now they are used in AiSettings which uses 'persona' data or we need to dispatch event?
            // Actually `availableExpressions` is a let variable in parent.
            // We should dispatch an event or bind it.
            // For simplicity, let's dispatch custom event for metadata update.
            dispatch("metadataLoaded", {
                expressions: result.expressions,
                motions: result.motions,
            });
            // console.log("Live2D Upload Success:", result);
        } catch (e: any) {
            console.error("Live2D Upload Error:", e);
            error = `Live2D upload failed: ${e.message}`;
            live2dFile = null;
        }
    }

    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    async function handleVRMUploadClick() {
        if (await confirmStore.ask($t("editPage.vrmLicenseWarning"))) {
            vrmInput.click();
        }
    }

    async function handleLive2DUploadClick() {
        if (await confirmStore.ask($t("editPage.licenseUploadWarning"))) {
            document.getElementById("live2d-file")?.click();
        }
    }

    async function handleMultipleAssetFiles(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            if (persona.image_metadatas.length + input.files.length > 40) {
                toast.warning("Maximum 40 images allowed.");
                return;
            }

            Array.from(input.files).forEach(async (file) => {
                const asset: ImageMetadata = {
                    url: "",
                    description: file.name,
                };
                if (persona.image_metadatas == null) {
                    persona.image_metadatas = [];
                }

                persona.image_metadatas.push(asset);
                // Force update for svelte reactivity
                persona = persona;
                await uploadAssetFile(persona.image_metadatas.length - 1, file);
            });
        }
    }

    async function handleAssetFileChange(event: Event, assetId: number) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const file = input.files[0];
            await uploadAssetFile(assetId, file);
        }
    }

    async function uploadAssetFile(assetId: number, file: File) {
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const currentUrl = persona.image_metadatas[assetId]?.url;
                const originalUrl =
                    originalPersona?.image_metadatas?.[assetId]?.url;
                const isTemp = currentUrl !== originalUrl;
                const oldUrl =
                    currentUrl && !currentUrl.startsWith("blob:") && isTemp
                        ? currentUrl
                        : undefined;
                const response = await getUploadUrl("asset", oldUrl);
                if (!response.ok) {
                    throw new Error(
                        `Server error on getting URL: ${response.status}`,
                    );
                }
                const { signedURL, fileName } = await response.json();

                if (attempt === 1) {
                    persona.image_metadatas[assetId].url =
                        URL.createObjectURL(file);
                    persona.image_metadatas[assetId].type =
                        file.type.startsWith("video/") ? "video" : "image";
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
                persona.image_metadatas[assetId].type = file.type.startsWith(
                    "video/",
                )
                    ? "video"
                    : "image";

                return;
            } catch (e: any) {
                console.warn(
                    `Attempt ${attempt} for ${file.name} failed: ${e.message}`,
                );

                if (attempt === MAX_RETRIES) {
                    // error handle
                } else {
                    await new Promise((res) => setTimeout(res, 500));
                }
            }
        }
    }

    async function copyAssetTag(index: number) {
        const tag = `<img ${index}>`;
        try {
            await navigator.clipboard.writeText(tag);
            copiedState.set(index, true);
            copiedState = copiedState;

            setTimeout(() => {
                copiedState.set(index, false);
                copiedState = copiedState;
            }, 2000);
        } catch (err) {
            console.error("클립보드 복사 실패:", err);
        }
    }

    function removeAssetByIndex(indexToRemove: number) {
        persona.image_metadatas = persona.image_metadatas.filter(
            (_, index) => index !== indexToRemove,
        );
    }
</script>

<div class="form-section-card">
    <h2>{$t("editPage.mediaFiles")}</h2>
    <div class="form-group">
        <label for="portrait">{$t("editPage.profileImageLabel")}</label>
        <div class="file-input-container">
            <label for="portrait-file" class="file-input-label">
                <span>{$t("editPage.fileSelect")}</span>
            </label>
            <input
                id="portrait-file"
                type="file"
                accept="image/*, video/*"
                on:change={handleProfileChange}
                class="file-input-hidden"
            />
            {#if portraitFile}
                <span class="file-name">{portraitFile.name}</span>
            {/if}
            {#if isCompressing}
                <div class="upload-status">
                    <Icon
                        icon="line-md:loading-twotone-loop"
                        width="24"
                        height="24"
                    />
                    <span>Compressing Video... {compression_progress}%</span>
                </div>
            {:else if portrait_progress > 0}
                <div class="upload-status">
                    <span>Uploading... {portrait_progress}%</span>
                </div>
            {/if}
        </div>
        {#if portraitPreview}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="portrait-preview clickable" class:has-id={!!persona.id}>
                <AssetPreview
                    asset={{
                        url: portraitPreview,
                        description: "",
                        type: portraitPreviewType,
                    }}
                />
            </div>
        {/if}

        {#if persona.personaType == "2.5D" && persona.contentType !== "story"}
            <div class="form-group asset-section">
                <h3 class="asset-title">Live2D Model Upload</h3>
                <p class="description">
                    Upload your Live2D model ZIP file (must contain
                    model3.json).
                </p>

                <div class="file-input-container">
                    <button
                        type="button"
                        class="file-input-label"
                        on:click={handleLive2DUploadClick}
                    >
                        <span>{$t("editPage.fileSelect")}</span>
                    </button>
                    <input
                        id="live2d-file"
                        type="file"
                        accept=".zip"
                        on:change={handleLive2DUpload}
                        class="file-input-hidden"
                    />
                    {#if live2dFile}
                        <span class="file-name">{live2dFile.name}</span>
                    {/if}
                </div>

                {#if live2d_progress > 0 && live2d_progress < 100}
                    <div
                        class="progress-bar-container"
                        style="margin-top: 10px; height: 5px; background: #eee; border-radius: 3px; overflow: hidden;"
                    >
                        <div
                            class="progress-bar"
                            style="width: {live2d_progress}%; height: 100%; background: var(--primary);"
                        ></div>
                    </div>
                {/if}

                {#if persona.live2d_model_url}
                    <div
                        class="success-message"
                        style="margin-top: 10px; color: green;"
                    >
                        ✅ Live2D Model Uploaded!
                    </div>
                {/if}
            </div>
        {/if}

        {#if persona.personaType == "2D"}
            <div class="form-group asset-section">
                <h3 class="asset-title">
                    {$t("editPage.assetSectionTitle")} ({persona.image_metadatas
                        .length} / 40)
                </h3>
                <p class="description">
                    {$t("editPage.assetSectionDescription")}
                </p>

                <div class="asset-card-list">
                    {#each persona.image_metadatas as asset, index}
                        <div class="asset-card">
                            <div class="asset-image-uploader">
                                {#if asset.url !== ""}
                                    <AssetPreview {asset} />
                                {/if}
                                {#if assets_progress.has(index)}
                                    <div class="progress-bar-overlay">
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
                                    <span>{$t("editPage.imageSelect")}</span>
                                </label>
                                <input
                                    id="asset-file-{index}"
                                    type="file"
                                    accept="image/*, video/*"
                                    class="file-input-hidden"
                                    on:change={(e) =>
                                        handleAssetFileChange(e, index)}
                                />
                            </div>
                            <div class="asset-details">
                                <textarea
                                    class="asset-description-input"
                                    placeholder={$t(
                                        "editPage.assetDescriptionPlaceholder",
                                    )}
                                    rows="3"
                                    bind:value={asset.description}
                                ></textarea>

                                <div class="asset-card-actions">
                                    <div class="secret-toggle-group">
                                        <label class="toggle-switch small">
                                            <input
                                                type="checkbox"
                                                bind:checked={asset.is_secret}
                                            />
                                            <span class="slider"></span>
                                        </label>
                                        <span class="secret-label"
                                            >{$t(
                                                "editPage.assets.secretLabel",
                                            )}</span
                                        >
                                        <div class="tooltip-icon small">
                                            <Icon icon="ph:question-bold" />
                                            <div class="tooltip-text">
                                                {$t(
                                                    "editPage.assets.secretTooltip",
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        class="btn btn-secondary btn-copy"
                                        on:click={() => copyAssetTag(index)}
                                    >
                                        {#if copiedState.get(index)}
                                            <span
                                                >{$t(
                                                    "editPage.assets.copySuccess",
                                                )}</span
                                            >
                                        {:else}
                                            <span
                                                >{$t(
                                                    "editPage.assets.copy",
                                                )}</span
                                            >
                                        {/if}
                                    </button>
                                    <button
                                        class="btn-remove asset-remove"
                                        on:click={() =>
                                            removeAssetByIndex(index)}
                                    >
                                        &times;
                                    </button>
                                </div>
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
                        accept="image/*, video/*"
                        class="file-input-hidden"
                        on:change={handleMultipleAssetFiles}
                    />
                </div>
            </div>
        {/if}
    </div>

    {#if persona.personaType == "3D" && persona.contentType !== "story"}
        <div class="form-group">
            <label for="vrm">{$t("editPage.vrmFileLabel")}</label>
            <div class="file-input-container">
                <button
                    type="button"
                    class="btn btn-secondary file-input-label"
                    on:click={handleVRMUploadClick}
                >
                    <span>{$t("editPage.fileSelect")}</span>
                </button>
                <input
                    id="vrm-file"
                    type="file"
                    accept=".vrm"
                    on:change={handleFileChange}
                    class="file-input-hidden"
                    bind:this={vrmInput}
                />
                {#if vrmFile}
                    <span class="file-name">{vrmFile.name}</span>
                {/if}
                {#if vrm_progress > 0}
                    {vrm_progress}%
                {/if}
            </div>
        </div>
    {/if}

    {#if (persona.personaType == "3D" || persona.personaType == "2.5D") && persona.contentType !== "story"}
        <div class="form-group">
            <label for="voice-select">{$t("editPage.voiceLabel")}</label>
            <p class="description">
                {$t("editPage.voiceDescription")}
            </p>
            {#if allVoices.length > 0}
                <div class="voice-selector">
                    <select id="voice-select" bind:value={selectedVoiceId}>
                        <option value="" disabled
                            >{$t("editPage.voiceSelectDefault")}</option
                        >
                        {#each allVoices as voice (voice._id)}
                            <option value={voice._id}
                                >{voice.title} - {voice.description}</option
                            >
                        {/each}
                    </select>
                </div>
            {:else}
                <p>{$t("editPage.voiceLoading")}</p>
            {/if}
        </div>
    {/if}
</div>

<style>
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
    .file-input-hidden {
        display: none;
    }
    .file-name {
        font-size: 0.9rem;
        color: var(--muted-foreground);
    }
    .upload-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        color: var(--muted-foreground);
    }
    .portrait-preview {
        margin-top: 1rem;
        width: 150px;
        height: 150px;
        border-radius: var(--radius-input);
        object-fit: cover;
        border: 1px solid var(--border);
        overflow: hidden;
    }
    .portrait-preview.clickable {
        cursor: pointer;
        position: relative;
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
    .progress-bar {
        width: 0%;
        height: 5px;
        background-color: var(--primary);
        transition: width 0.2s ease-in-out;
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
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-input);
        background: var(--input);
        color: var(--foreground);
        box-sizing: border-box;
    }
    .asset-description-input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 2px var(--ring);
    }
    .asset-card-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }
    .secret-toggle-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background-color: var(--background);
        padding: 0.3rem 0.6rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        white-space: nowrap;
    }
    .toggle-switch.small {
        width: 28px;
        height: 16px;
        position: relative;
        display: inline-block;
    }
    .toggle-switch.small input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--muted);
        transition: 0.4s;
        border-radius: 20px;
    }
    .slider:before {
        position: absolute;
        content: "";
        height: 12px;
        width: 12px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        transition: 0.4s;
        border-radius: 50%;
    }
    input:checked + .slider {
        background-color: var(--primary);
    }
    input:checked + .slider:before {
        transform: translateX(12px);
    }
    .secret-label {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--secondary-foreground);
    }
    .tooltip-icon.small {
        margin-left: 0.1rem;
        font-size: 0.85rem;
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: help;
        color: var(--muted-foreground);
    }
    .tooltip-icon.small .tooltip-text {
        bottom: 150%;
        visibility: hidden;
        width: max-content;
        max-width: 250px;
        min-width: 150px;
        background-color: var(--popover);
        color: var(--popover-foreground);
        text-align: left;
        border-radius: 6px;
        padding: 0.8rem;
        position: absolute;
        z-index: 10;
        left: 50%;
        transform: translateX(-50%);
        opacity: 0;
        transition: opacity 0.2s;
        box-shadow: var(--shadow-popover);
        border: 1px solid var(--border);
        font-size: 0.85rem;
        pointer-events: none;
        word-wrap: break-word;
        white-space: normal;
    }
    .tooltip-icon.small:hover .tooltip-text {
        visibility: visible;
        opacity: 1;
    }
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
    .btn-copy {
        padding: 0.4rem 0.8rem;
        font-size: 0.8rem;
        flex-grow: 1;
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
    .voice-selector {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    select {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-input);
        background: var(--input);
        color: var(--foreground);
        box-sizing: border-box;
    }
    select:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 2px var(--ring);
    }
    @media (max-width: 480px) {
        .asset-card-actions {
            flex-direction: column;
            gap: 0.8rem;
            align-items: flex-end;
        }
        .secret-toggle-group {
            width: fit-content;
        }
        .btn-copy {
            width: 100%;
        }
    }
</style>

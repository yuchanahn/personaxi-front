<script lang="ts">
    import { api } from "$lib/api";
    import type { ImageMetadata, Persona } from "$lib/types";
    import AssetPreview from "../AssetPreview.svelte";
    import { createEventDispatcher, onMount } from "svelte";
    import { t } from "svelte-i18n";

    export let persona: Persona | null;
    export let metadata: ImageMetadata;
    export let index: number;

    const dispatch = createEventDispatcher();

    let currentMetadata: ImageMetadata = { ...metadata };
    let isLoading = false;
    let isError = false;
    let placeholderAspectRatio = "4 / 5";

    function setDefaultAspectRatio(target: ImageMetadata) {
        placeholderAspectRatio = target.type === "video" ? "16 / 9" : "4 / 5";
    }

    function updatePlaceholderAspectRatio(target: ImageMetadata) {
        setDefaultAspectRatio(target);

        if (!target.static_url || typeof Image === "undefined") return;

        const img = new Image();
        img.onload = () => {
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                placeholderAspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
            }
        };
        img.src = target.static_url;
    }

    async function unlockAsset() {
        if (!persona?.id) return;
        if (currentMetadata.url) return; // Already has URL

        isLoading = true;
        try {
            const res = await api.get(
                `/api/persona/asset?id=${persona.id}&index=${index}`,
            );
            if (res.ok) {
                const data = await res.json();
                if (data.url) {
                    currentMetadata = { ...currentMetadata, url: data.url };
                    currentMetadata.type = data.type;
                    console.log("Asset unlocked:", currentMetadata);
                }
            } else {
                console.warn("Failed to unlock asset:", res.status);
                isError = true;
            }
        } catch (e) {
            console.error("Error unlocking asset:", e);
            isError = true;
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        updatePlaceholderAspectRatio(currentMetadata);
        if (!currentMetadata.url && persona) {
            unlockAsset();
        }
    });

    // If metadata prop changes? (Likely strictly scoped to chat item, but good to be safe)
    // Reactively update currentMetadata if the prop changes and provides a new URL
    $: if (metadata && metadata.url && metadata.url !== currentMetadata.url) {
        currentMetadata = { ...metadata };
    }

    $: if (metadata?.static_url !== currentMetadata.static_url || metadata?.type !== currentMetadata.type) {
        updatePlaceholderAspectRatio(currentMetadata);
    }
</script>

<div class="chat-image-wrapper" style={`--chat-asset-ratio: ${placeholderAspectRatio};`}>
    {#if currentMetadata.url}
        <AssetPreview
            asset={currentMetadata}
            on:load={(e) => dispatch("load", e.detail)}
        />
    {:else if isLoading}
        <div class="placeholder-shell">
            <div class="loading-placeholder">
                <div class="spinner"></div>
                <span>{$t("chat.secretImage.loading")}</span>
            </div>
        </div>
    {:else if isError}
        <div class="placeholder-shell">
            <div class="error-placeholder" title={$t("chat.secretImage.error")}>
                {$t("chat.secretImage.error")}
            </div>
        </div>
    {:else}
        <!-- Fallback / Initial State -->
        <div class="placeholder-shell">
            <div class="locked-placeholder">
                {$t("chat.secretImage.locked")}
            </div>
        </div>
    {/if}
</div>

<style>
    .chat-image-wrapper {
        width: 100%;
        display: flex;
        justify-content: center;
    }

    .placeholder-shell {
        width: min(100%, 480px);
        aspect-ratio: var(--chat-asset-ratio, 4 / 5);
        border-radius: 14px;
        overflow: hidden;
    }

    .loading-placeholder,
    .error-placeholder,
    .locked-placeholder {
        width: 100%;
        height: 100%;
        background: var(--muted);
        border-radius: 14px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--muted-foreground);
        border: 1px dashed var(--border);
        gap: 0.5rem;
        font-size: 0.9em;
    }
    .error-placeholder {
        color: var(--destructive);
        border-color: var(--destructive);
        background: rgba(255, 0, 0, 0.05);
    }

    .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid var(--primary);
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* Override AssetPreview styles for Chat */
    .chat-image-wrapper :global(.brand-loading-card) {
        border-radius: 14px;
    }

    .chat-image-wrapper :global(.asset-preview-media) {
        width: auto !important;
        height: auto !important;
        max-width: 100%;
        max-height: 500px; /* Constrain vertical height on desktop */
        object-fit: contain !important;
    }

    @media (max-width: 768px) {
        .chat-image-wrapper :global(.asset-preview-media) {
            max-height: none; /* Allow taller on mobile */
            width: 100% !important;
        }
    }
</style>

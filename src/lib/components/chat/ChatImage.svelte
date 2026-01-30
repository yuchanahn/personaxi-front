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
        if (!currentMetadata.url && persona) {
            unlockAsset();
        }
    });

    // If metadata prop changes? (Likely strictly scoped to chat item, but good to be safe)
    // Reactively update currentMetadata if the prop changes and provides a new URL
    $: if (metadata && metadata.url && metadata.url !== currentMetadata.url) {
        currentMetadata = { ...metadata };
    }
</script>

<div class="chat-image-wrapper">
    {#if currentMetadata.url}
        <AssetPreview
            asset={currentMetadata}
            on:load={(e) => dispatch("load", e.detail)}
        />
    {:else if isLoading}
        <div class="loading-placeholder">
            <div class="spinner"></div>
            <span>{$t("chat.secretImage.loading")}</span>
        </div>
    {:else if isError}
        <div class="error-placeholder" title={$t("chat.secretImage.error")}>
            {$t("chat.secretImage.error")}
        </div>
    {:else}
        <!-- Fallback / Initial State -->
        <div class="locked-placeholder">
            {$t("chat.secretImage.locked")}
        </div>
    {/if}
</div>

<style>
    .chat-image-wrapper {
        width: 100%;
        display: flex;
        justify-content: center;
    }
    .loading-placeholder,
    .error-placeholder,
    .locked-placeholder {
        width: 200px;
        height: 200px;
        background: var(--muted);
        border-radius: 12px;
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

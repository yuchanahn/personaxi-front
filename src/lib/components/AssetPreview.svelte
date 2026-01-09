<script lang="ts">
    import { fetchAndSetAssetTypes } from "$lib/api/edit_persona";
    import type { ImageMetadata } from "$lib/types";
    import Icon from "@iconify/svelte";
    import { onDestroy } from "svelte";

    export let asset: ImageMetadata;

    let isFetching = false;
    let fetchAborted = false;

    // 컴포넌트 unmount 시 플래그 설정
    onDestroy(() => {
        fetchAborted = true;
    });

    $: {
        const shouldFetchType =
            asset &&
            !asset.type &&
            !(asset.is_secret && !asset.url) &&
            !isFetching;

        if (shouldFetchType) {
            isFetching = true;
            fetchAborted = false;

            (async () => {
                try {
                    const assetsWithType = await fetchAndSetAssetTypes([asset]);

                    // 컴포넌트가 unmount되었으면 업데이트 스킵
                    if (fetchAborted) return;

                    if (assetsWithType[0]?.type) {
                        asset = { ...asset, type: assetsWithType[0].type };
                    } else {
                        asset = { ...asset, type: "unknown" };
                    }
                } catch (error) {
                    console.error("Failed to fetch asset type:", error);
                    if (!fetchAborted) {
                        asset = { ...asset, type: "unknown" };
                    }
                } finally {
                    isFetching = false;
                }
            })();
        }
    }
</script>

{#if asset.is_secret && !asset.url}
    <div class="fallback secret">
        <Icon icon="ph:lock-key-duotone" width="48" height="48" />
        <p>Private Asset</p>
    </div>
{:else if asset.type === "image"}
    <img src={asset.url} alt="asset" class="asset-preview-media" />
{:else if asset.type === "video"}
    <video
        autoplay
        loop
        muted
        playsinline
        class="asset-preview-media gif-like-video"
    >
        <source src={asset.url} type="video/mp4" />
        <track kind="captions" />
        Your browser does not support the video tag.
    </video>
{:else if asset.type === "unknown"}
    <div class="fallback">
        <Icon icon="ph:file-duotone" width="48" height="48" />
        <p>Unknown file type</p>
    </div>
{:else}
    <div class="fallback">
        {#if asset.static_url}
            <img
                src={asset.static_url}
                alt="asset preview"
                class="asset-preview-media"
            />
        {:else}
            <div class="loading">
                <Icon
                    icon="ph:spinner-duotone"
                    width="32"
                    height="32"
                    class="spin"
                />
                <p>Loading...</p>
            </div>
        {/if}
    </div>
{/if}

<style>
    .asset-preview-media {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .gif-like-video {
        pointer-events: none;
    }

    .fallback {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 8px;
        text-align: center;
        font-size: 0.8rem;
        color: var(--muted-foreground);
        background-color: var(--secondary);
    }

    .secret {
        color: var(--muted-foreground);
    }

    .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }

    :global(.spin) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>

<script lang="ts">
    import { fetchAndSetAssetTypes } from "$lib/api/edit_persona";
    import type { ImageMetadata } from "$lib/types";
    import Icon from "@iconify/svelte";
    import { createEventDispatcher, onDestroy, onMount } from "svelte";

    export let asset: ImageMetadata;

    const dispatch = createEventDispatcher();

    let isFetching = false;
    let fetchAborted = false;

    // 캐시 키 접두사 (충돌 방지)
    const CACHE_PREFIX = "asset_type_cache:";

    onDestroy(() => {
        fetchAborted = true;
    });

    const getCachedType = (url: string): string | null => {
        return localStorage.getItem(CACHE_PREFIX + url);
    };

    const setCachedType = (url: string, type: string) => {
        localStorage.setItem(CACHE_PREFIX + url, type);
    };

    let videoEl: HTMLVideoElement | null = null;
    let videoReady = false;

    $: if (asset.type === "video" && videoEl && asset.url) {
        // Do NOT call videoEl.load() or videoEl.play() here.
        // On iOS, load() resets autoplay, and play() outside user gesture is blocked.
        // The autoplay attribute handles playback natively.
    }

    $: {
        const shouldFetchType =
            asset &&
            !asset.type &&
            !(asset.is_secret && !asset.url) &&
            !isFetching;

        // Reset video state when asset changes
        videoReady = false;

        if (shouldFetchType && asset.url) {
            const cachedType = getCachedType(asset.url);

            if (cachedType) {
                asset = { ...asset, type: cachedType as any };
            } else {
                isFetching = true;
                fetchAborted = false;

                (async () => {
                    try {
                        const assetsWithType = await fetchAndSetAssetTypes([
                            asset,
                        ]);

                        if (fetchAborted) return;

                        if (assetsWithType[0]?.type) {
                            const newType = assetsWithType[0].type;

                            // 성공 시 LocalStorage에 영구 저장
                            if (asset.url) {
                                setCachedType(asset.url, newType);
                            }
                            asset = { ...asset, type: newType };
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
    }
</script>

{#if asset.is_secret && !asset.url}
    <div class="fallback secret">
        <Icon icon="ph:lock-key-duotone" width="48" height="48" />
        <p>Private Asset</p>
    </div>
{:else if asset.type === "image"}
    <img
        src={asset.url}
        alt="asset"
        class="asset-preview-media"
        on:load={() => dispatch("load", { url: asset.url })}
        on:error={() => dispatch("error", { url: asset.url })}
    />
{:else if asset.type === "video"}
    <div class="video-container">
        {#if !videoReady}
            <img
                src={asset.static_url || "/placeholder-portrait.png"}
                alt="preview"
                class="asset-preview-media video-poster-layer"
            />
        {/if}
        <video
            src={asset.url}
            poster={asset.static_url || undefined}
            autoplay
            loop
            muted
            playsinline
            class="asset-preview-media gif-like-video"
            class:video-visible={videoReady}
            bind:this={videoEl}
            on:playing={() => {
                videoReady = true;
            }}
            on:loadeddata={() => dispatch("load", { url: asset.url })}
            on:error={() => dispatch("error", { url: asset.url })}
        >
            Your browser does not support the video tag.
        </video>
    </div>
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
        opacity: 0;
        transition: opacity 0.15s ease;
    }

    .gif-like-video.video-visible {
        opacity: 1;
    }

    .video-container {
        position: relative;
        width: 100%;
        height: 100%;
    }

    .video-poster-layer {
        position: absolute;
        inset: 0;
        z-index: 1;
    }

    .video-container video {
        position: relative;
        z-index: 2;
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

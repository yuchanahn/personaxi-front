<script lang="ts">
    import { fetchAndSetAssetTypes } from "$lib/api/edit_persona";
    import type { ImageMetadata } from "$lib/types";
    import Icon from "@iconify/svelte";
    import { onDestroy, onMount } from "svelte";

    export let asset: ImageMetadata;

    let isFetching = false;
    let fetchAborted = false;

    // 캐시 키 접두사 (충돌 방지)
    const CACHE_PREFIX = "asset_type_cache:";

    onDestroy(() => {
        fetchAborted = true;
    });

    // LocalStorage 헬퍼 함수
    const getCachedType = (url: string): string | null => {
        return localStorage.getItem(CACHE_PREFIX + url);
    };

    const setCachedType = (url: string, type: string) => {
        localStorage.setItem(CACHE_PREFIX + url, type);
    };

    let videoEl: HTMLVideoElement | null = null;

    $: if (asset.type === "video" && videoEl && asset.url) {
        videoEl.load();
        videoEl.play?.().catch(() => {});
    }

    $: {
        const shouldFetchType =
            asset &&
            !asset.type &&
            !(asset.is_secret && !asset.url) &&
            !isFetching;

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
    <img src={asset.url} alt="asset" class="asset-preview-media" />
{:else if asset.type === "video"}
    <video
        autoplay
        loop
        muted
        playsinline
        class="asset-preview-media gif-like-video"
        bind:this={videoEl}
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

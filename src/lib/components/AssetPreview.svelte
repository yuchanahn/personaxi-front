<script lang="ts">
    import { fetchAndSetAssetTypes } from "$lib/api/edit_persona";
    import type { ImageMetadata } from "$lib/types";
    import Icon from "@iconify/svelte";
    import { createEventDispatcher, onDestroy, onMount } from "svelte";

export let asset: ImageMetadata;
export let showVideoPosterFallback: boolean = false;
export let enableVideoPlayback: boolean = true;
export let useSimpleVideoLayout: boolean = false;

    const dispatch = createEventDispatcher();

    let isFetching = false;
    let fetchAborted = false;

    // 캐시 키 접두사 (충돌 방지)
    const CACHE_PREFIX = "asset_type_cache:";

    onDestroy(() => {
        fetchAborted = true;
    });

    const getCachedType = (url: string): string | null => {
        const cached = localStorage.getItem(CACHE_PREFIX + url);
        if (cached === "unknown") {
            localStorage.removeItem(CACHE_PREFIX + url);
            return null;
        }
        return cached;
    };

    const setCachedType = (url: string, type: string) => {
        if (type === "unknown") {
            localStorage.removeItem(CACHE_PREFIX + url);
            return;
        }
        localStorage.setItem(CACHE_PREFIX + url, type);
    };

    let videoEl: HTMLVideoElement | null = null;
    let videoReady = false;
    let lastAssetUrl = "";

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

        // Only reset video state when URL actually changes
        if (asset?.url && asset.url !== lastAssetUrl) {
            lastAssetUrl = asset.url;
            videoReady = false;
        }

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
    {#if useSimpleVideoLayout}
        <video
            src={asset.url}
            poster={asset.static_url || undefined}
            autoplay
            loop
            muted
            playsinline
            class="asset-preview-media gif-like-video gif-like-video--inline"
            bind:this={videoEl}
            on:loadeddata={() => dispatch("load", { url: asset.url })}
            on:error={() => dispatch("error", { url: asset.url })}
        >
            Your browser does not support the video tag.
        </video>
    {:else}
        <div class="video-container">
            {#if !enableVideoPlayback}
                {#if asset.static_url}
                    <img
                        src={asset.static_url}
                        alt="preview"
                        class="asset-preview-media"
                        on:load={() => dispatch("load", { url: asset.static_url })}
                        on:error={() => dispatch("error", { url: asset.static_url })}
                    />
                {:else}
                    <div class="brand-loading-card video-loading-layer" aria-hidden="true">
                        <div class="brand-grid-layer"></div>
                        <div class="brand-vignette"></div>
                        <div class="brand-scan-bar"></div>
                        <div class="brand-corner tl"></div>
                        <div class="brand-corner tr"></div>
                        <div class="brand-corner bl"></div>
                        <div class="brand-corner br"></div>
                        <div class="brand-loading-inner">
                            <img class="brand-loading-logo flicker" src="/logo.png" alt="PersonaXi" />
                            <div class="brand-loading-ring"></div>
                            <div class="brand-loading-title">LOADING</div>
                            <div class="brand-loading-subtitle">Syncing visual layer</div>
                            <div class="brand-loading-bar-wrap">
                                <div class="brand-loading-bar-fill"></div>
                            </div>
                        </div>
                    </div>
                {/if}
            {:else if !videoReady}
                {#if showVideoPosterFallback && asset.static_url}
                    <img
                        src={asset.static_url}
                        alt="preview"
                        class="asset-preview-media video-poster-layer"
                    />
                {:else}
                    <div class="brand-loading-card video-loading-layer" aria-hidden="true">
                        <div class="brand-grid-layer"></div>
                        <div class="brand-vignette"></div>
                        <div class="brand-scan-bar"></div>
                        <div class="brand-corner tl"></div>
                        <div class="brand-corner tr"></div>
                        <div class="brand-corner bl"></div>
                        <div class="brand-corner br"></div>
                        <div class="brand-loading-inner">
                            <img class="brand-loading-logo flicker" src="/logo.png" alt="PersonaXi" />
                            <div class="brand-loading-ring"></div>
                            <div class="brand-loading-title">LOADING</div>
                            <div class="brand-loading-subtitle">Syncing visual layer</div>
                            <div class="brand-loading-bar-wrap">
                                <div class="brand-loading-bar-fill"></div>
                            </div>
                        </div>
                    </div>
                {/if}
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
    {/if}
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
            <div class="brand-loading-card">
                <div class="brand-grid-layer"></div>
                <div class="brand-vignette"></div>
                <div class="brand-scan-bar"></div>
                <div class="brand-corner tl"></div>
                <div class="brand-corner tr"></div>
                <div class="brand-corner bl"></div>
                <div class="brand-corner br"></div>
                <div class="brand-loading-inner">
                    <img class="brand-loading-logo flicker" src="/logo.png" alt="PersonaXi" />
                    <div class="brand-loading-ring"></div>
                    <div class="brand-loading-title">LOADING</div>
                    <div class="brand-loading-subtitle">Syncing visual layer</div>
                    <div class="brand-loading-bar-wrap">
                        <div class="brand-loading-bar-fill"></div>
                    </div>
                </div>
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
        position: absolute;
        inset: 0;
        z-index: 2;
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
    }

    .gif-like-video.video-visible {
        opacity: 1;
    }

    .gif-like-video--inline {
        opacity: 1;
        position: static;
        inset: auto;
        transition: none;
    }

    .video-container {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        isolation: isolate;
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
    }

    .video-poster-layer {
        position: absolute;
        inset: 0;
        z-index: 1;
    }

    .video-loading-layer {
        position: absolute;
        inset: 0;
        z-index: 1;
    }

    .brand-loading-card {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: radial-gradient(
            ellipse at 30% 25%,
            #060d1f 0%,
            #130614 60%,
            #030509 100%
        );
        color: #a78bfa;
        text-align: center;
        padding: 16px;
        box-sizing: border-box;
    }

    .brand-grid-layer {
        position: absolute;
        inset: 0;
        background-image:
            linear-gradient(rgba(130, 100, 255, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(130, 100, 255, 0.06) 1px, transparent 1px);
        background-size: 28px 28px;
        pointer-events: none;
    }

    .brand-vignette {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at 50% 50%, transparent 40%, #030509 90%);
        pointer-events: none;
    }

    .brand-scan-bar {
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        z-index: 3;
        background: linear-gradient(90deg, transparent, rgba(180, 130, 255, 0.5), transparent);
        animation: brandScanMove 3s linear infinite;
    }

    .brand-loading-inner {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        padding: 20px;
        width: 100%;
    }

    .brand-loading-logo {
        width: min(32%, 96px);
        object-fit: contain;
        filter:
            brightness(0)
            saturate(100%)
            invert(75%)
            sepia(80%)
            saturate(500%)
            hue-rotate(260deg)
            brightness(125%);
    }

    .brand-loading-ring {
        position: absolute;
        bottom: 54px;
        width: 140px;
        height: 36px;
        border-radius: 50%;
        border: 1px solid rgba(180, 130, 255, 0.22);
    }

    .brand-loading-title {
        font-family: "Space Mono", monospace;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.14em;
        color: #a78bfa;
        text-shadow: 0 0 10px rgba(150, 100, 255, 0.6), 0 0 20px rgba(255, 100, 200, 0.25);
    }

    .brand-loading-subtitle {
        font-size: 11px;
        letter-spacing: 0.06em;
        color: #3d2060;
    }

    .brand-loading-bar-wrap {
        width: 100%;
        height: 2px;
        border-radius: 2px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.06);
    }

    .brand-loading-bar-fill {
        width: 40%;
        height: 100%;
        border-radius: 2px;
        background: linear-gradient(90deg, transparent, #a78bfa, #f472b6, transparent);
        box-shadow: 0 0 7px #a78bfa;
        animation: brandBarMove 2.5s ease-in-out infinite;
    }

    .brand-corner {
        position: absolute;
        width: 14px;
        height: 14px;
        border-style: solid;
        border-width: 0;
        border-color: rgba(180, 130, 255, 0.4);
        z-index: 4;
    }

    .brand-corner.tl {
        top: 12px;
        left: 12px;
        border-top-width: 1.5px;
        border-left-width: 1.5px;
        border-radius: 3px 0 0 0;
    }

    .brand-corner.tr {
        top: 12px;
        right: 12px;
        border-top-width: 1.5px;
        border-right-width: 1.5px;
        border-radius: 0 3px 0 0;
    }

    .brand-corner.bl {
        bottom: 12px;
        left: 12px;
        border-bottom-width: 1.5px;
        border-left-width: 1.5px;
        border-radius: 0 0 0 3px;
    }

    .brand-corner.br {
        bottom: 12px;
        right: 12px;
        border-bottom-width: 1.5px;
        border-right-width: 1.5px;
        border-radius: 0 0 3px 0;
    }

    .video-container video {
        position: absolute;
        inset: 0;
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

    .flicker {
        animation: brandFlicker 5s ease-in-out infinite;
    }

    @keyframes brandScanMove {
        0% { top: 5%; opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { top: 95%; opacity: 0; }
    }

    @keyframes brandBarMove {
        0% { transform: translateX(-200%); }
        100% { transform: translateX(400%); }
    }

    @keyframes brandFlicker {
        0%, 88%, 100% { opacity: 1; }
        90% { opacity: 0.35; }
        91% { opacity: 1; }
        94% { opacity: 0.55; }
        95% { opacity: 1; }
    }
</style>

<script lang="ts">
    import { fetchAndSetAssetTypes } from "$lib/api/edit_persona";
    import type { ImageMetadata } from "$lib/types";

    import Icon from "@iconify/svelte";

    export let asset: ImageMetadata;

    $: if (asset && !asset.type && !(asset.is_secret && !asset.url)) {
        (async () => {
            const assetsWithType = await fetchAndSetAssetTypes([asset]);
            //console.log("Fetched asset type:", assetsWithType);
            if (assetsWithType[0] && assetsWithType[0].type) {
                asset.type = assetsWithType[0].type;
                asset = asset;
            }
            if (!asset.type) {
                asset.type = "unknown";
                asset = asset;
            }
        })();
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
        <source src={asset.url} />
        this browser does not support the video tag.
    </video>
{:else if asset.type === "unknown"}
    <div class="fallback"></div>
{:else}
    <div class="fallback">
        <p>loading...</p>
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
        text-align: center;
        font-size: 0.8rem;
        color: var(--muted-foreground);
        background-color: var(--secondary);
    }

    .secret {
        gap: 8px;
        color: var(--muted-foreground);
    }
</style>

<script lang="ts">
    import type { ImageMetadata } from "$lib/types";

    // 부모로부터 asset 객체를 props로 받습니다.
    export let asset: ImageMetadata;
</script>

{#if asset.type === "image"}
    <img src={asset.url} alt="에셋 미리보기" class="asset-preview-media" />
{:else if asset.type === "video"}
    <video
        autoplay
        loop
        muted
        playsinline
        class="asset-preview-media gif-like-video"
    >
        <source src={asset.url} />
        이 브라우저는 비디오 태그를 지원하지 않습니다.
    </video>
{:else}
    <div class="fallback">
        <p>미리보기를<br />로드하는 중...</p>
    </div>
{/if}

<style>
    .asset-preview-media {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .gif-like-video {
        /* 클릭/터치 이벤트를 막아서 GIF처럼 만듭니다 */
        pointer-events: none;
    }

    .fallback {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        font-size: 0.8rem;
        color: var(--muted-foreground);
    }
</style>

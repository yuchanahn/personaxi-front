<script lang="ts">
    import AssetPreview from "$lib/components/AssetPreview.svelte";
    import type { ImageMetadata } from "$lib/types";

    const VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";

    let asset: ImageMetadata = {
        url: VIDEO_URL,
        description: "test",
        type: "video",
    };

    let log: string[] = [];
    function addLog(msg: string) {
        log = [msg, ...log];
    }
</script>

<div class="test-page">
    <h1>🔬 Track Element Test</h1>
    <p class="links">
        <a href="/test/chat2d">/test/chat2d</a>
        <span>2D 채팅 렌더 샌드박스</span>
    </p>

    <hr />

    <h2>F. video + track (src 없음) — D랑 같음</h2>
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
        src={VIDEO_URL}
        autoplay
        loop
        muted
        playsinline
        style="width:200px; border:2px solid red; border-radius:8px;"
        on:playing={() => addLog("F: playing ✅")}
    >
        <track kind="captions" />
    </video>

    <hr />

    <h2>G. video — track 없음</h2>
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
        src={VIDEO_URL}
        autoplay
        loop
        muted
        playsinline
        style="width:200px; border:2px solid green; border-radius:8px;"
        on:playing={() => addLog("G: playing ✅")}
    ></video>

    <hr />

    <h2>H. AssetPreview 컴포넌트</h2>
    <div
        style="width:200px; height:150px; border:2px solid purple; border-radius:8px; overflow:hidden;"
    >
        <AssetPreview
            {asset}
            on:load={() => addLog("H: load ✅")}
            on:error={() => addLog("H: error ❌")}
        />
    </div>

    <hr />

    <h2>📋 Log</h2>
    <div class="log-box">
        {#each log as entry}
            <div>{entry}</div>
        {/each}
        {#if log.length === 0}
            <div style="color:gray;">waiting...</div>
        {/if}
    </div>
</div>

<style>
    .test-page {
        padding: 16px;
        max-width: 500px;
        margin: 0 auto;
        font-family: system-ui;
    }
    h2 {
        font-size: 0.95rem;
        margin: 8px 0;
    }
    hr {
        border: none;
        border-top: 1px solid #ddd;
        margin: 12px 0;
    }
    video {
        display: block;
        margin: 4px 0;
    }
    .log-box {
        background: #f5f5f5;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 10px;
        font-size: 0.8rem;
        font-family: monospace;
    }
    .links {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        font-size: 0.9rem;
    }
    .links a {
        color: #2563eb;
        font-weight: 700;
    }
</style>

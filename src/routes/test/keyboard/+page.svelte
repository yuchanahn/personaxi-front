<script lang="ts">
    import { onMount } from "svelte";

    let initialHeight = 0;

    onMount(() => {
        initialHeight = window.innerHeight;
    });
</script>

<div class="app-wrapper" style:height="{initialHeight}px">
    <div class="bg-layer"></div>

    <header class="top-search-bar">
        <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="상단 고정 검색창 (점프 없음)" />
        </div>
    </header>

    <main class="scroll-area">
        <div class="content-padding">
            {#each Array(40) as _, i}
                <div class="card">본문 스크롤 테스트 데이터 {i + 1}</div>
            {/each}
        </div>
    </main>
</div>

<style>
    /* [핵심] Body 스크롤 완전 차단 */
    :global(html, body) {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden !important;
        position: fixed;
    }

    .app-wrapper {
        position: relative;
        display: flex;
        flex-direction: column;
        width: 100%;
        overflow: hidden;
    }

    .bg-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
        background-image: url("/chat_bg.png");
        background-size: cover;
        background-position: center;
    }

    /* [핵심 전략] 입력창을 최상단에 배치 */
    .top-search-bar {
        position: relative;
        z-index: 100;
        padding: 10px 16px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid #ddd;
    }

    .search-input-wrapper {
        display: flex;
        align-items: center;
        background: #f1f1f1;
        border-radius: 8px;
        padding: 0 12px;
    }

    input {
        flex: 1;
        height: 44px;
        border: none;
        background: transparent;
        font-size: 16px; /* iOS 줌 방지 필수 */
        outline: none;
        padding-left: 8px;
    }

    /* 본문 스크롤 영역 분리 */
    .scroll-area {
        flex: 1;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
    }

    .content-padding {
        padding: 16px;
    }

    .card {
        background: rgba(255, 255, 255, 0.7);
        margin-bottom: 12px;
        padding: 20px;
        border-radius: 12px;
        color: #333;
    }
</style>

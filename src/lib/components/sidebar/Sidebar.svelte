<script lang="ts">
    import ChatSidebar from "$lib/components/chat/ChatSidebar.svelte";
    import Icon from "@iconify/svelte";
    import { onMount } from "svelte";
    import { t } from "svelte-i18n";

    export let showSidebar: boolean = true;
    let isMobile: boolean = false;

    // 화면 크기를 감지하여 isMobile 상태를 업데이트합니다.
    onMount(() => {
        const mediaQuery = window.matchMedia("(max-width: 768px)");

        // 초기 로드 시 확인
        isMobile = mediaQuery.matches;

        // 화면 크기가 변경될 때마다 확인
        const updateMobileStatus = (e: MediaQueryListEvent) => {
            isMobile = e.matches;
        };
        mediaQuery.addEventListener("change", updateMobileStatus);

        // 'fullscreenchange' 이벤트를 감지하여 isFullscreen 상태를 동기화
        const updateFullscreenStatus = () => {
            isFullscreen = document.fullscreenElement != null;
        };
        document.addEventListener("fullscreenchange", updateFullscreenStatus);

        // 컴포넌트가 사라질 때 이벤트 리스너 제거
        return () => {
            mediaQuery.removeEventListener("change", updateMobileStatus);
            document.removeEventListener(
                "fullscreenchange",
                updateFullscreenStatus,
            );
        };
    });

    let isFullscreen = false; // 현재 전체화면 상태를 저장하는 변수

    // 전체화면 상태를 토글하는 함수
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            // 전체화면이 아니면, 전체화면으로 전환
            document.documentElement.requestFullscreen();
        } else {
            // 전체화면 상태이면, 전체화면 해제
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }
</script>

<div class="controls-wrapper" class:sidebar-open={showSidebar}>
    <button
        on:click={() => (showSidebar = !showSidebar)}
        title={showSidebar ? $t("sidebar.hide") : $t("sidebar.show")}
        class="control-button"
    >
        <Icon
            icon={showSidebar ? "ci:bar-left" : "ci:bar-right"}
            width="24"
            height="24"
        />
    </button>

    <button
        on:click={toggleFullscreen}
        title={isFullscreen ? $t("sidebar.exitFullscreen") : $t("sidebar.enterFullscreen")}
        class="control-button"
    >
        <Icon
            icon={isFullscreen
                ? "material-symbols:fullscreen-exit"
                : "material-symbols:fullscreen"}
            width="24"
            height="24"
        />
    </button>
</div>

{#if isMobile && showSidebar}
    <div class="sidebar-overlay" on:click={() => (showSidebar = false)} />
{/if}

<div class="sidebar" class:open={showSidebar}>
    <div class="sidebar-content">
        <ChatSidebar />
    </div>
    <div class="sidebar-footer">
        <a
            href="https://wind-chance-11f.notion.site/personaxi-com-228d058c022e80a1ae4ddf99878f5fbc?source=copy_link"
            target="_blank"
            rel="noopener noreferrer"
            class="sidebar-link"
        >
            <Icon icon="ph:book-open-duotone" width="24" height="24" />
            <span>{$t("sidebar.tutorial")}</span>
        </a>
        <a
            href="https://discord.gg/pyPb9Pp6"
            target="_blank"
            rel="noopener noreferrer"
            class="discord-link"
        >
            <Icon icon="ic:baseline-discord" width="24" height="24" />
            <span>{$t("sidebar.community")}</span>
        </a>
    </div>
</div>

<style>
    /* 기존 <style> 내용을 아래 코드로 전부 교체해주세요. */

    :root {
        --sidebar-width: 250px;
        --sidebar-transition-duration: 0.3s;
    }

    /* 사이드바 본체 스타일 */
    .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        height: 100vh;
        background: var(--color-surface, #fff); /* 기본값으로 흰색 지정 */
        transform: translateX(
            -100%
        ); /* 기본 상태(숨김)에서는 왼쪽 화면 밖으로 이동 */
        transition: transform var(--sidebar-transition-duration) ease;
        z-index: 20;
        width: var(--sidebar-width);

        /* ★★★ 아래 두 줄을 추가해주세요 ★★★ */
        display: flex;
        flex-direction: column;
    }

    .sidebar.open {
        transform: translateX(0); /* 열렸을 때 제자리로 이동 */
    }
    .sidebar-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
    }

    .sidebar-footer {
        /* 푸터도 마찬가지로 높이를 지정합니다. */
        height: 120px; /* 예시 높이 */
        flex-shrink: 0;
    }

    /* ★★★ 여기가 핵심 수정 부분입니다 ★★★ */
    .sidebar-content {
        /* flex: 1; 을 아래의 height 계산으로 교체합니다. */
        height: calc(
            100vh - 60px - 120px
        ); /* 전체 화면 높이 - (헤더 높이 + 푸터 높이) */
        overflow-y: auto;

        /* 스크롤바 스타일링 */
        scrollbar-width: thin;
        scrollbar-color: var(--color-accent) transparent;
    }

    .sidebar-content::-webkit-scrollbar {
        width: 8px;
    }
    .sidebar-content::-webkit-scrollbar-thumb {
        background-color: var(--color-accent);
        border-radius: 4px;
    }
    .sidebar-content::-webkit-scrollbar-track {
        background-color: transparent;
    }
    /* 토글 버튼 스타일 */
    .sidebar-toggle-button {
        position: fixed;
        top: 0.75rem;
        left: 10px; /* 기본(숨김) 상태에서의 위치 */
        z-index: 30;
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--color-text, #000); /* 기본값으로 검은색 지정 */
        transition: left var(--sidebar-transition-duration) ease;
        padding: 0;
        line-height: 1;
    }

    .sidebar-toggle-button.open {
        left: var(
            --sidebar-width - 40px
        ); /* 열렸을 때 사이드바 너비만큼 이동 */
    }

    /* 모바일용 오버레이 스타일 */
    .sidebar-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 15; /* 사이드바(20)보다는 아래, 콘텐츠보다는 위에 위치 */
    }

    .sidebar-footer {
        margin-top: auto; /* 메뉴 목록 맨 아래에 고정 */
        padding: 1rem;
        border-top: 1px solid var(--border-color, #eee); /* 상단 메뉴와 구분선 */
    }

    .discord-link {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        border-radius: 8px;
        color: var(--text-secondary, #666);
        text-decoration: none;
        font-weight: 600;
        transition:
            background-color 0.2s,
            color 0.2s;
    }

    .discord-link:hover {
        background-color: rgba(114, 137, 218, 0.1); /* 디스코드 보라색 계열 */
        color: #7289da;
    }

    /* 이 스타일을 기존 CSS에 추가하거나 .discord-link 등을 수정해서 사용하세요 */
    .sidebar-footer {
        margin-top: auto; /* 푸터를 항상 사이드바 맨 아래로 밀어냄 */
        padding: 1rem;
        border-top: 1px solid var(--border-color, #eee);
        display: flex;
        flex-direction: column; /* 링크들을 세로로 쌓음 */
        gap: 0.5rem; /* 링크 사이의 간격 */
    }

    .sidebar-link {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        border-radius: 8px;
        color: var(--text-secondary, #666);
        text-decoration: none;
        font-weight: 600;
        transition:
            background-color 0.2s,
            color 0.2s;
    }

    .sidebar-link:hover {
        background-color: var(
            --bg-tertiary,
            #f0f0f0
        ); /* 당신의 디자인 시스템에 맞는 색으로 변경 */
        color: var(--text-primary, #000);
    }

    .controls-wrapper {
        position: fixed;
        top: 0.75rem;
        left: 10px;
        z-index: 30;
        display: flex; /* 버튼들을 가로로 나란히 배치 */
        gap: 8px; /* 버튼 사이의 간격 */
        background-color: rgba(30, 30, 30, 0.5); /* 배경을 살짝 어둡게 */
        padding: 6px;
        border-radius: 8px;
        transition: left var(--sidebar-transition-duration) ease;
    }

    /* 사이드바가 열렸을 때 래퍼의 위치 이동 */
    .controls-wrapper.sidebar-open {
        left: calc(var(--sidebar-width) + 10px);
    }

    /* 공용 버튼 스타일 */
    .control-button {
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--color-text, #000);
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: background-color 0.2s ease;
    }

    .control-button:hover {
        background-color: rgba(255, 255, 255, 0.2);
    }

    /* ★★★ 모바일 반응형 스타일 (가장 중요) ★★★ */
    @media (max-width: 768px) {
        /* 모바일에서는 사이드바가 화면 전체를 덮도록 너비 변경 */
        .sidebar {
            width: 100%;
            /* 모바일에서 너비가 100%가 될 때, min-width가 의도치 않은 레이아웃 문제를
           일으킬 수 있으므로 필요 시 내부 컨텐츠 div의 스타일을 조정합니다. */
        }

        /* 모바일에서는 버튼이 사이드바 안쪽에 위치하도록 left 값 고정 */
        .sidebar-toggle-button.open {
            left: calc(100% - 40px);
        }
        /* 모바일에서는 버튼 그룹이 사이드바 너비만큼 이동 */
        .controls-wrapper.sidebar-open {
            left: calc(100% - 88px); /* (버튼 2개 너비 + 간격) 만큼을 뺀 값 */
        }
    }
</style>

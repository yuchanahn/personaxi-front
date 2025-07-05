<script lang="ts">
    import ChatSidebar from "$lib/components/chat/ChatSidebar.svelte";
    import Icon from "@iconify/svelte";
    import { onMount } from "svelte";

    let showSidebar: boolean = true;
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

        // 컴포넌트가 사라질 때 이벤트 리스너 제거
        return () => {
            mediaQuery.removeEventListener("change", updateMobileStatus);
        };
    });
</script>

<button
    on:click={() => (showSidebar = !showSidebar)}
    title={showSidebar ? "사이드바 숨기기" : "사이드바 보기"}
    aria-label={showSidebar ? "사이드바 숨기기" : "사이드바 보기"}
    class="sidebar-toggle-button"
    class:open={showSidebar}
>
    <Icon
        icon={showSidebar ? "ci:bar-left" : "ci:bar-right"}
        width="24"
        height="24"
    />
</button>

{#if isMobile && showSidebar}
    <div class="sidebar-overlay" on:click={() => (showSidebar = false)} />
{/if}

<div class="sidebar" class:open={showSidebar}>
    <div style="min-width: 250px;">
        <ChatSidebar />
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
    }

    .sidebar.open {
        transform: translateX(0); /* 열렸을 때 제자리로 이동 */
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
    }
</style>

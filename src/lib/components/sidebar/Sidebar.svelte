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
    <div class="sidebar-footer">
        <a
            href="https://wind-chance-11f.notion.site/personaxi-com-228d058c022e80a1ae4ddf99878f5fbc?source=copy_link"
            target="_blank"
            rel="noopener noreferrer"
            class="sidebar-link"
        >
            <Icon icon="ph:book-open-duotone" width="24" height="24" />
            <span>튜토리얼</span>
        </a>
        <a
            href="https://discord.gg/pyPb9Pp6"
            target="_blank"
            rel="noopener noreferrer"
            class="discord-link"
        >
            <Icon icon="ic:baseline-discord" width="24" height="24" />
            <span>커뮤니티 참여</span>
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

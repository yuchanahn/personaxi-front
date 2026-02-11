<script lang="ts">
    import ChatSidebar from "$lib/components/chat/ChatSidebar.svelte";
    import Icon from "@iconify/svelte";
    import { onMount } from "svelte";
    import { t } from "svelte-i18n";
    import { notificationStore } from "$lib/stores/notification";

    const { unreadCount } = notificationStore;

    export let showSidebar: boolean = true;
    let isMobile: boolean = false;

    onMount(() => {
        const mediaQuery = window.matchMedia("(max-width: 768px)");
        isMobile = mediaQuery.matches;

        const updateMobileStatus = (e: MediaQueryListEvent) => {
            isMobile = e.matches;
        };
        mediaQuery.addEventListener("change", updateMobileStatus);

        const updateFullscreenStatus = () => {
            isFullscreen = document.fullscreenElement != null;
        };
        document.addEventListener("fullscreenchange", updateFullscreenStatus);

        return () => {
            mediaQuery.removeEventListener("change", updateMobileStatus);
            document.removeEventListener(
                "fullscreenchange",
                updateFullscreenStatus,
            );
        };
    });

    let isFullscreen = false;

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
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
    <!-- <button
        on:click={toggleFullscreen}
        title={isFullscreen
            ? $t("sidebar.exitFullscreen")
            : $t("sidebar.enterFullscreen")}
        class="control-button"
    >
        <Icon
            icon={isFullscreen
                ? "material-symbols:fullscreen-exit"
                : "material-symbols:fullscreen"}
            width="24"
            height="24"
        />
    </button> -->
</div>

{#if isMobile && showSidebar}
    <div class="sidebar-overlay" on:click={() => (showSidebar = false)} />
{/if}

<div class="sidebar" class:open={showSidebar}>
    <div class="sidebar-header">
        <a href="/hub" class="sidebar-link">
            <Icon icon="ph:compass-duotone" width="24" height="24" />
            <span>{$t("chatSession.system.search")}</span>
        </a>
        <a href="/feed" class="sidebar-link">
            <Icon
                icon="material-symbols:smart-display-outline"
                width="24"
                height="24"
            />
            <span>{$t("chatSession.system.feed")}</span>
        </a>
        <a href="/edit" class="sidebar-link">
            <Icon icon="ph:plus-circle-duotone" width="24" height="24" />
            <span>{$t("chatSession.system.create")}</span>
        </a>

        <a href="/user/setting" class="sidebar-link relative">
            <Icon icon="ph:gear-duotone" width="24" height="24" />
            <span>{$t("chatSession.system.user")}</span>
            {#if $unreadCount > 0}
                <span
                    class="absolute top-2 left-6 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"
                ></span>
            {/if}
        </a>
    </div>

    <div class="sidebar-content">
        <ChatSidebar />
    </div>

    <div class="sidebar-footer">
        <!-- <a href="/install" class="sidebar-link">
            <Icon
                icon="material-symbols:download-rounded"
                width="24"
                height="24"
            />
            <span>{$t("sidebar.install")}</span>
        </a> -->
        <a href="/guide" class="sidebar-link">
            <Icon icon="ph:book-open-text-duotone" width="24" height="24" />
            <span>{$t("guide.tabGuide")}</span>
        </a>
        <a
            href="https://discord.gg/uJG9hWSrJx"
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
    :root {
        --sidebar-width: 250px;
        --sidebar-transition-duration: 0.3s;
        --sidebar-header-height: 220px; /* 이건 헤더 높이 */
        --sidebar-footer-height: 70px; /* Adjusted height after removing links */
    }

    /* 사이드바 본체 스타일 */
    .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        height: 100vh;
        background: var(--color-surface, #fff);
        transform: translateX(-100%);
        transition: transform var(--sidebar-transition-duration) ease;
        z-index: 20;
        width: var(--sidebar-width);
        display: flex;
        flex-direction: column;
    }

    .sidebar.open {
        transform: translateX(0);
    }
    .sidebar-header {
        height: var(--sidebar-header-height);
        flex-shrink: 0;
        padding: 1rem;
        border-bottom: 1px solid var(--border-color, #eee);
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
    }

    .sidebar-content {
        height: calc(
            100vh - 60px - var(--sidebar-header-height) -
                var(--sidebar-footer-height)
                /* 늘어난 푸터 높이만큼 자동 계산 */
        );
        overflow-y: auto;
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

    .sidebar-footer {
        height: var(--sidebar-footer-height);
        flex-shrink: 0;
        padding: 1rem;
        border-top: 1px solid var(--border-color, #eee);
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
    }

    /* 공용 링크 스타일 (기존과 동일) */
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
        background-color: var(--bg-tertiary, #f0f0f0);
        color: var(--text-primary, #000);
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
        background-color: rgba(114, 137, 218, 0.1);
        color: #7289da;
    }

    /* 컨트롤 버튼 관련 스타일 (기존과 동일) */
    .controls-wrapper {
        position: fixed;
        top: 0.75rem;
        left: 10px;
        z-index: 30;
        display: flex;
        gap: 8px;
        background-color: rgba(151, 151, 151, 0.5);
        padding: 6px;
        border-radius: 8px;
        transition: left var(--sidebar-transition-duration) ease;
    }
    .controls-wrapper.sidebar-open {
        left: calc(var(--sidebar-width) + 10px);
    }
    .control-button {
        background: transparent;
        border: none;
        cursor: pointer;
        color: #fff;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: background-color 0.2s ease;
    }

    /* 모바일 오버레이 스타일 (기존과 동일) */
    .sidebar-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 15;
    }

    /* 모바일 반응형 스타일 (기존과 동일) */
    @media (max-width: 768px) {
        .sidebar {
            width: 100%;
        }
        .controls-wrapper.sidebar-open {
            left: calc(100% - 88px);
        }
    }
</style>

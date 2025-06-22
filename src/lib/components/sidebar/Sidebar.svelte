<script lang="ts">
    import ChatSidebar from "$lib/components/chat/ChatSidebar.svelte";
    import Icon from "@iconify/svelte";

    let showSidebar: boolean = true;
    const fullSidebarWidth: number = 250;
    const peekWidth: number = 0;
    const buttonMargin: number = -40;

    $: currentSidebarWidth = showSidebar ? fullSidebarWidth : peekWidth;
</script>

<button
    on:click={() => {
        showSidebar = !showSidebar;
    }}
    title={showSidebar ? "사이드바 숨기기" : "사이드바 보기"}
    aria-label={showSidebar ? "사이드바 숨기기" : "사이드바 보기"}
    class="sidebar-toggle-button"
    style="
        position: fixed;
        top: 0.75rem;
        left: {currentSidebarWidth + buttonMargin}px;
        z-index: 30;
    "
>
    <Icon
        icon={showSidebar ? "ci:bar-left" : "ci:bar-right"}
        width="24"
        height="24"
    />
</button>

{#if !showSidebar}
    <button
        on:click={() => {
            showSidebar = !showSidebar;
        }}
        title={showSidebar ? "사이드바 숨기기" : "사이드바 보기"}
        aria-label={showSidebar ? "사이드바 숨기기" : "사이드바 보기"}
        class="sidebar-toggle-button"
        style="
        position: fixed;
        top: 0.75rem;
        left: 10px;
        z-index: 10;
    "
    >
        <Icon
            icon={showSidebar ? "ci:bar-left" : "ci:bar-right"}
            width="24"
            height="24"
        />
    </button>
{/if}

<div class="sidebar" style="width: {currentSidebarWidth}px;">
    <div class:collapsed={!showSidebar}>
        <ChatSidebar />
    </div>
</div>

<style>
    .sidebar {
        height: 100vh;
        background: var(--color-surface);
        transition: width 0.3s ease;
        overflow: hidden;
        z-index: 11;
        position: fixed;
        top: 0;
        left: 0;
    }

    .sidebar-toggle-button {
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--color-text);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: left 0.3s ease;
        padding: 0;
        line-height: 1;
    }

    /* collapsed sidebar 내부에서 텍스트 감춤 처리 */
    .collapsed * {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 0;
        z-index: 21;
    }

    .collapsed svg,
    .collapsed .icon {
        font-size: 20px;
        width: 100%;
        display: flex;
        justify-content: center;
    }
</style>

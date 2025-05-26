<script lang="ts">
    import ChatSidebar from "$lib/components/chat/ChatSidebar.svelte";
    import Icon from "@iconify/svelte";

    let showSidebar = true;
</script>

<div class="sidebar-toggle-floating">
    <button
        on:click={() => (showSidebar = !showSidebar)}
        class="sidebar-toggle-button"
        title={showSidebar ? "사이드바 숨기기" : "사이드바 보기"}
        aria-label="Toggle sidebar"
    >
        <Icon icon="ci:bar-left" width="24" height="24" />
    </button>
</div>

<div class="sidebar" class:collapsed={!showSidebar}>
    {#if showSidebar}
        <ChatSidebar />
    {/if}
</div>

<style>
    .sidebar {
        height: 100vh;
        width: 300px;
        background: var(--color-surface);
        transition: width 0.3s ease;
        overflow: hidden;
        z-index: 11;
    }
    .sidebar.collapsed {
        width: 0;
    }
    .sidebar-toggle-floating {
        position: fixed;
        top: 0.75rem;
        left: 0.75rem;
        z-index: 30;
    }
    .sidebar-toggle-button {
        background: transparent;
        border: none;
        font-size: 1.8rem;
        cursor: pointer;
        color: var(--color-text);
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>

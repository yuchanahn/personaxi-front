<script lang="ts">
  import ChatSidebar from "$lib/components/chat/ChatSidebar.svelte";
  import ChatWindow from "$lib/components/chat/ChatWindow.svelte";
  import ChatInput from "$lib/components/chat/ChatInput.svelte";

  import "$lib/styles/theme.css";

  import Icon from "@iconify/svelte";
  import ContentHub from "../portal/ContentHub.svelte";
  import { ViewContentHub } from "$lib/stores/flags";
  import VrmModelViewer from "../chat3D/VrmModelViewer.svelte";

  export let user: any;
  export let onSend: (text: string) => void;
  let showSidebar = true;
  let Character3D = true;
</script>

<!-- 토글 버튼 고정 -->
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

<div class="layout">
  <div class="sidebar" class:collapsed={!showSidebar}>
    {#if showSidebar}
      <ChatSidebar />
    {/if}
  </div>

  <div class="chat-container">
    {#if user}
      {#if $ViewContentHub}
        <ContentHub />
      {:else if Character3D}
      <div class="vrm-view">
        <VrmModelViewer />
      </div>
      {:else}
      <div class="chat-content">
        <ChatWindow />
        <ChatInput {onSend} />
        </div>
      {/if}
    {:else}
      <button
        on:click={() =>
          (window.location.href = "http://localhost:8080/auth/google/login")}
        >Google 로그인</button>
    {/if}
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    background: var(--color-bg);
    color: var(--color-text);
    font-family: "Segoe UI", sans-serif;
  }

  .vrm-view {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }


  .layout {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }
  .chat-container {
    z-index: 10;
  }
  .sidebar {
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
  .chat-container {

    flex-grow: 1;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .chat-content {
    position: relative; /* 💥 이게 꼭 있어야 함 */
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .chat-content :global(.chat-window) {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 5rem;
  }

  .chat-content :global(.chat-input-wrapper) {
    position: sticky;
    bottom: 0;
    background: var(--color-accent);
    padding: 1rem;
    z-index: 10;
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { loadChatHistory, sendPromptStream } from "$lib/api/chat";
  import ChatWindow from "$lib/components/chat/ChatWindow.svelte";
  import ChatInput from "$lib/components/chat/ChatInput.svelte";

  let lastSessionId: string | null = null;

  // 초기 로드
  onMount(() => {
    const sessionId = $page.url.searchParams.get("c");
    lastSessionId = sessionId;
    loadChatHistory(sessionId ?? "");
  });

  // 쿼리 파라미터 변경 감지
  $: {
    const sessionId = $page.url.searchParams.get("c");
    if (sessionId !== lastSessionId) {
      lastSessionId = sessionId;
      loadChatHistory(sessionId ?? "");
    }
  }

  const send = async (prompt: string) => {
    const sessionId = $page.url.searchParams.get("c");
    await sendPromptStream(sessionId ?? "", prompt, "character");
  };
</script>

<main>
  <div class="chat-container">
    <div class="chat-content">
      <ChatWindow cssid={lastSessionId ?? ""} />
      <ChatInput onSend={send} />
    </div>
  </div>
</main>

<style>
  .chat-container {
    flex-grow: 1;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .chat-content {
    position: relative;
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

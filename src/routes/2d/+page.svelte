<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { loadChatHistory, sendPromptStream } from "$lib/api/chat";
  import ChatWindow from "$lib/components/chat/ChatWindow.svelte";
  import ChatInput from "$lib/components/chat/ChatInput.svelte";
  import { loadPersona } from "$lib/api/edit_persona";
  import type { Persona } from "$lib/types";

  let lastSessionId: string | null = null;
  let persona: Persona | null = null;

  onMount(() => {
    const sessionId = $page.url.searchParams.get("c");
    lastSessionId = sessionId;
    loadChatHistory(sessionId ?? "");
    if (sessionId) {
      loadPersona(sessionId).then((p) => (persona = p));
    }
  });

  $: {
    const sessionId = $page.url.searchParams.get("c");
    if (sessionId !== lastSessionId) {
      lastSessionId = sessionId;
      loadChatHistory(sessionId ?? "");
      if (sessionId) {
        loadPersona(sessionId).then((p) => (persona = p));
      } else {
        persona = null;
      }
    }
  }

  const send = async (prompt: string) => {
    const sessionId = $page.url.searchParams.get("c");
    await sendPromptStream(sessionId ?? "", prompt, "character");
  };
</script>

<main class="chat-layout">
  {#if persona !== null}
    <div class="persona-container">
      <img
        src={`https://uohepkqmwbstbmnkoqju.supabase.co/storage/v1/object/public/portraits/${persona.owner_id[0]}/${persona.id}.portrait`}
        alt="portrait"
        class="portrait"
      />
    </div>
  {/if}

  <div class="chat-container">
    <ChatWindow cssid={lastSessionId ?? ""} />
    <ChatInput onSend={send} />
  </div>
</main>

<style>
  .chat-layout {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    /* 모바일 기본: 세로 배치 */
    flex-direction: column;
  }

  .persona-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1rem;
    background: #333333; /* 배경색을 추가하여 영역 구분 */
  }

  .portrait {
    max-width: 100%;
    object-fit: contain;
    /* 모바일에서는 이미지 높이 제한 */
    max-height: 200px;
  }

  .chat-container {
    flex: 1; /* 남은 공간 모두 차지 */
    display: flex;
    flex-direction: column;
    min-height: 0; /* flex 자식 요소의 높이 문제 방지 */
  }

  :global(.chat-window) {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    min-height: 0;
  }

  /* PC 화면 (768px 이상) */
  @media (min-width: 768px) {
    .chat-layout {
      /* 가로 배치로 변경 */
      flex-direction: row;
    }

    .persona-container {
      /* 왼쪽 영역 고정 너비 할당 */
      flex: 0 0 400px;
    }

    .portrait {
      /* PC에서는 이미지 높이 제한 늘리기 */
      max-height: 600px;
    }

    .chat-container {
      /* 오른쪽 영역이 남은 공간 모두 차지 */
      flex: 1;
    }
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { loadChatHistory, sendPromptStream } from "$lib/api/chat";
  import ChatWindow from "$lib/components/chat/ChatWindow.svelte";
  import ChatInput from "$lib/components/chat/ChatInput.svelte";
  import SettingsButton from "$lib/components/common/SettingsButton.svelte";
  import { loadPersona } from "$lib/api/edit_persona";
  import type { Persona } from "$lib/types";
  import SettingsModal from "$lib/components/modal/SettingModal.svelte";
  import { get } from "svelte/store";
  import { messages } from "$lib/stores/messages";

  let lastSessionId: string | null = null;
  let persona: Persona | null = null;

  const setupScene = () => {
    if (get(messages).length === 0) {
      if (persona?.first_scene) {
        messages.set([
          {
            role: "assistant",
            content:
              `<img src="${persona.portrait_url}" alt="장면 삽화" class="inserted-image">` +
              persona.first_scene,
          },
        ]);
      }
    }
  };

  onMount(() => {
    const sessionId = $page.url.searchParams.get("c");
    lastSessionId = sessionId;
    loadChatHistory(sessionId ?? "").then(() => {
      setupScene();
    });
    if (sessionId) {
      loadPersona(sessionId).then((p) => {
        persona = p;
        setupScene();
      });
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

  let isLoading = false;
  let isDisabled = false;
  const send = async (prompt: string) => {
    const sessionId = $page.url.searchParams.get("c");
    isLoading = true;
    isDisabled = true;
    await sendPromptStream(sessionId ?? "", prompt, "2d", () => {
      isDisabled = false;
    });
  };

  let isSettingsModalOpen = false;
</script>

{#if isSettingsModalOpen && persona}
  <SettingsModal
    {persona}
    isOpen={isSettingsModalOpen}
    on:close={() => (isSettingsModalOpen = false)}
  />
{/if}
<main class="chat-layout">
  <div class="settings-button-2d">
    <SettingsButton onClick={() => (isSettingsModalOpen = true)} />
  </div>

  <div class="chat-container">
    <ChatWindow cssid={lastSessionId ?? ""} {isLoading} {persona} />
    <ChatInput onSend={send} {isDisabled} />
  </div>
</main>

<style>
  .chat-layout {
    display: flex;
    height: 100%;
    width: 100vw;
    overflow: hidden;
    /* 모바일 기본: 세로 배치 */
    flex-direction: column;
  }

  .chat-container {
    flex: 1; /* 남은 공간 모두 차지 */
    display: flex;
    flex-direction: column;
    min-height: 0;
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

    .chat-container {
      /* 오른쪽 영역이 남은 공간 모두 차지 */
      flex: 1;
    }
  }
  .settings-button-2d {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 10;
    display: flex;
    flex-direction: column; /* NEW: 세로 정렬 */
    gap: 10px; /* 버튼 사이 간격 */
    background-color: rgba(0, 0, 0, 0.5); /* 반투명 배경 */
    padding: 8px 12px;
    border-radius: 8px;
    backdrop-filter: blur(5px); /* 블러 효과 */
    border: 1px solid rgba(255, 255, 255, 0.2); /* 테두리 */
  }
</style>

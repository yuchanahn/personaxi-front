<script lang="ts">
  import { page } from "$app/stores";
  import { loadChatHistory, sendPromptStream } from "$lib/api/chat";
  import ChatWindow from "$lib/components/chat/ChatWindow.svelte";
  import ChatInput from "$lib/components/chat/ChatInput.svelte";
  import SettingsButton from "$lib/components/common/SettingsButton.svelte";
  import { fetchAndSetAssetTypes, loadPersona } from "$lib/api/edit_persona";
  import type { Persona } from "$lib/types";
  import SettingsModal from "$lib/components/modal/SettingModal.svelte";
  import { pricingStore } from "$lib/stores/pricing";
  import { st_user } from "$lib/stores/user";
  import { chatSessions } from "$lib/stores/chatSessions";
  import { get } from "svelte/store";

  import ModelSelector from "$lib/components/chat/ModelSelector.svelte";
  import { messages } from "$lib/stores/messages";
  import { api } from "$lib/api";

  let lastSessionId: string | null = null;
  let persona: Persona | null = null;

  $: llmType = $page.url.searchParams.get("llmType") || "Error";

  let currentCost = 0;
  $: if (llmType) {
    // For 2D, we trust the URL param or fallback just like finding session
    // But ideally we should find session to be safe, like live2d
    const session = $chatSessions.find((s) => s.id === lastSessionId);
    const effectiveType = session?.llmType || llmType || "gemini-flash-lite";

    const baseCost = $pricingStore.costs.chat_2d || 10;
    const multiplier = $pricingStore.model_multipliers[effectiveType] || 1.0;
    currentCost = Math.round(baseCost * multiplier);
  }

  let showModelSelector = false;

  const loadChatData = async () => {
    const sessionId = $page.url.searchParams.get("c");
    lastSessionId = sessionId;

    if (sessionId) {
      await loadChatHistory(sessionId ?? "");

      // Show Model Selector only if it's a new session (empty chat)
      // and if we haven't already selected a specific logic (implied by just checking messages for now)
      if ($messages.length === 1) {
        showModelSelector = true;
      } else {
        showModelSelector = false;
      }

      loadPersona(sessionId).then((p) => {
        fetchAndSetAssetTypes(p.image_metadatas).then((imgs) => {
          p.image_metadatas = imgs;
          persona = p;
        });
      });
    }
  };

  $: {
    const sessionId = $page.url.searchParams.get("c");
    if (sessionId !== lastSessionId) {
      loadChatData();
    }
  }

  let isLoading = false;
  let isDisabled = false;
  const send = async (prompt: string) => {
    if (isLoading || isDisabled) return;

    const sessionId = $page.url.searchParams.get("c");

    // Optimistic Credit Deduction
    st_user.update((u) => {
      if (u && u.credits >= currentCost) {
        u.credits -= currentCost;
      }
      return u;
    });

    isLoading = true;
    isDisabled = true;
    await sendPromptStream(sessionId ?? "", prompt, "2d", () => {
      isDisabled = false;
      isLoading = false;
    });
  };

  let isSettingsModalOpen = false;
  let showImage = true; // 기본값: 이미지 보이기
  let autoScroll = true; // Default: Auto scroll enabled

  const handleModelConfirm = async (e: CustomEvent<string>) => {
    const selected = e.detail;
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("llmType", selected);
    window.history.replaceState({}, "", newUrl);

    const s = $chatSessions.find((s) => s.id === lastSessionId);
    if (s) {
      s.llmType = selected;
      chatSessions.update((sess) =>
        sess.map((x) =>
          x.id === lastSessionId ? { ...x, llmType: selected } : x,
        ),
      );
    }
    llmType = selected;

    if (persona?.id) {
      try {
        await api.post(`/api/chat/char/sessions/edit`, {
          cssid: persona.id,
          llmType: selected,
        });
        console.log("Saved LLM preference:", selected);
      } catch (e) {
        console.error("Failed to save LLM preference:", e);
      }
    }

    showModelSelector = false;
  };
</script>

{#if isSettingsModalOpen && persona}
  <SettingsModal
    {persona}
    isOpen={isSettingsModalOpen}
    {llmType}
    mode="2d"
    bind:showImage
    bind:autoScroll
    on:close={() => (isSettingsModalOpen = false)}
  />
{/if}

<ModelSelector
  isOpen={showModelSelector}
  selectedModel={llmType}
  on:close={() => (showModelSelector = false)}
  on:confirm={handleModelConfirm}
/>

<main class="chat-layout">
  <div class="settings-button-2d">
    <SettingsButton onClick={() => (isSettingsModalOpen = true)} />
  </div>

  <div class="chat-container">
    <ChatWindow
      cssid={lastSessionId ?? ""}
      {isLoading}
      {persona}
      {showImage}
      {autoScroll}
      SendMessage={send}
    />
    <ChatInput
      onSend={send}
      {isDisabled}
      placeholderName={persona?.name}
      mode="2d"
      neededNeurons={currentCost}
    />
  </div>
</main>

<style>
  .character-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    overflow: hidden;
    pointer-events: none; /* 클릭 방해 금지 */
  }

  .character-background img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.6; /* 배경으로 은은하게 깔기 */
    filter: blur(5px); /* 약간 흐리게 처리 (선택사항) */
  }

  .gradient-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.3),
      rgba(0, 0, 0, 0.8)
    );
  }

  .chat-layout {
    position: fixed;
    top: 0;
    left: 0;
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    /* 모바일 기본: 세로 배치 */
    flex-direction: column;
    background-color: var(--background);
  }

  .chat-container {
    flex: 1; /* 남은 공간 모두 차지 */
    height: 100vh; /* 화면 높이의 40% 차지 (조절 가능) */
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative; /* z-index 적용을 위해 */
    z-index: 1; /* 배경 위에 표시 */
    background: transparent; /* 배경 투명 */
    padding-bottom: env(safe-area-inset-bottom, 0px);
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

    /* PC에서는 이미지를 오른쪽이나 중앙에 배치하는 스타일 변경 가능 */
    .character-background img {
      filter: blur(0); /* PC에서는 선명하게? */
      opacity: 0.3;
    }
  }

  .settings-button-2d {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1000;
    display: flex;
    flex-direction: column; /* NEW: 세로 정렬 */
    gap: 10px; /* 버튼 사이 간격 */
    background-color: rgba(0, 0, 0, 0.3); /* 반투명 배경 */
    padding: 6px;
    border-radius: 6px;
    backdrop-filter: blur(5px); /* 블러 효과 */
    border: 0.5px solid rgba(255, 255, 255, 0.15); /* 테두리 */
  }
</style>

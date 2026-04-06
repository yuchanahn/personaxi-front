<script lang="ts">
  import { page } from "$app/stores";
  import { loadChatHistory, sendPromptStream } from "$lib/api/chat";
  import ChatWindow2DNext from "$lib/components/chat/ChatWindow2DNext.svelte";
  import ChatInput from "$lib/components/chat/ChatInput.svelte";
  import "$lib/styles/chat-input-position.css";
  import { onMount } from "svelte";
  import SettingsButton from "$lib/components/common/SettingsButton.svelte";
  import { loadPersona } from "$lib/api/edit_persona";
  import type { Persona } from "$lib/types";
  import SettingsModal from "$lib/components/modal/SettingModal.svelte";
  import { pricingStore } from "$lib/stores/pricing";
  import { st_user } from "$lib/stores/user";
  import { ChatSessionType, chatSessions } from "$lib/stores/chatSessions";
  import { get } from "svelte/store";

  import ModelSelector from "$lib/components/chat/ModelSelector.svelte";
  import { messages } from "$lib/stores/messages";
  import { api } from "$lib/api";
  import { requireAuth } from "$lib/stores/authGate";

  let lastSessionId: string | null = null;
  let persona: Persona | null = null;
  const normalizeVisibleLLMType = (value: string) => {
    switch (value) {
      case "antigravity":
        return "gemini-pro";
      case "gemini-flash-lite":
      case "gemini-flash":
      case "gemini-pro":
        return value;
      default:
        return "gemini-flash-lite";
    }
  };
  const currentSessionId = () => lastSessionId || persona?.id || "";

  $: llmType = $page.url.searchParams.get("llmType") || "Error";

  let currentCost = 0;
  $: if (llmType) {
    // For 2D, we trust the URL param or fallback just like finding session
    // But ideally we should find session to be safe, like live2d
    const session = $chatSessions.find((s) => s.id === lastSessionId);
    const effectiveType = normalizeVisibleLLMType(
      session?.llmType || llmType || "gemini-flash-lite",
    );

    const baseCost = $pricingStore.costs.chat_2d || 10;
    const fallbackMultiplier =
      effectiveType === "gemini-flash"
        ? 1.5
        : effectiveType === "gemini-pro"
          ? 2.0
          : 1.0;
    const multiplier =
      $pricingStore.model_multipliers[effectiveType] || fallbackMultiplier;
    const outputTokenMultiplier = Math.min(
      3,
      Math.max(1, session?.outputTokenMultiplier || 1),
    );
    // Shows max possible cost for current output token setting.
    currentCost = Math.round(baseCost * multiplier * outputTokenMultiplier);
  }

  let showModelSelector = false;
  let loadSequence = 0;

  const loadChatData = async () => {
    const sessionId = $page.url.searchParams.get("c");
    lastSessionId = sessionId;
    const currentLoad = ++loadSequence;
    if (sessionId) {
      // 1. Clear previous state immediately (Fixes race condition & ghosting)
      messages.set([]);
      persona = null;
      showModelSelector = false;

      try {
        console.log("[2D] before requireAuth", {
          href: window.location.href,
          sessionId,
          lastSessionId,
        });

        const canAccessChat = await requireAuth({
          source: "page",
          reason: "chat-2d-access",
        });

        console.log("[2D] after requireAuth", {
          canAccessChat,
          href: window.location.href,
          sessionId,
          lastSessionId,
        });
        const historyPromise = canAccessChat
          ? loadChatHistory(sessionId ?? "").catch((error) => {
              console.error("Failed to load chat history:", error);
            })
          : Promise.resolve();
        const p = await loadPersona(sessionId);

        if (currentLoad !== loadSequence || lastSessionId !== sessionId) {
          return;
        }

        persona = p;

        if (!canAccessChat) {
          $messages = [
            {
              role: "assistant",
              content: "<first_scene>",
              done: true,
              key: "first-scene",
            },
          ];
          return;
        }

        await historyPromise;

        if (currentLoad !== loadSequence || lastSessionId !== sessionId) {
          return;
        }

        // 4. Check for New Session state
        if ($messages.length <= 1) {
          showModelSelector = true;
        }
      } catch (e) {
        console.error("Failed to load chat data:", e);
      }
    }
  };

  $: {
    const sessionId = $page.url.searchParams.get("c");
    if (sessionId !== lastSessionId) {
      console.log(`1 sessionId : ${sessionId} | ${lastSessionId}`);
      loadChatData();
      console.log(`2 sessionId : ${sessionId} | ${lastSessionId}`);
    }
  }

  let isLoading = false;
  let isDisabled = false;
  const send = async (prompt: string, onError?: (error: any) => void) => {
    if (isLoading || isDisabled) return;

    const sessionId = $page.url.searchParams.get("c");

    // Optimistic Credit Deduction
    st_user.update((u) => {
      if (u && u.credits >= currentCost) {
        u.credits -= currentCost;
      }
      return u;
    });

    let ErrorHandler = (error: any) => {
      onError?.(error);
      loadChatHistory(sessionId ?? "");
    };

    isLoading = true;
    isDisabled = true;
    await sendPromptStream(
      sessionId ?? "",
      prompt,
      "2d",
      () => {
        isDisabled = false;
        isLoading = false;
      },
      undefined,
      ErrorHandler,
    );
  };

  import { settings } from "$lib/stores/settings";

  let isSettingsModalOpen = false;

  // Initialize from persistent settings, fallback to defaults if undefined
  let showImage = $settings.showImage ?? true;
  let autoScroll = $settings.autoScroll ?? true;
  let showBackground = $settings.showBackground ?? false;
  let showVariableStatus = $settings.showVariableStatus ?? false;

  // Mounted guard prevents initial load from triggering settings.update cascade
  let mounted2d = false;
  onMount(() => {
    mounted2d = true;
  });

  // Sync back to persistent settings when local values change
  $: if (mounted2d) {
    settings.update((s) => ({
      ...s,
      showImage,
      autoScroll,
      showBackground,
      showVariableStatus,
    }));
  }

  const handleModelConfirm = async (e: CustomEvent<string>) => {
    const selected = e.detail;
    const cssid = currentSessionId();
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("llmType", selected);
    window.history.replaceState({}, "", newUrl);

    const s = $chatSessions.find((s) => s.id === cssid);
    if (s) {
      s.llmType = selected;
      chatSessions.update((sess) =>
        sess.map((x) => (x.id === cssid ? { ...x, llmType: selected } : x)),
      );
    } else if (cssid && persona) {
      const selectedPersona = persona;
      chatSessions.update((sess) => [
        ...sess,
        {
          id: cssid,
          name: selectedPersona.name,
          createdAt: new Date().toISOString(),
          type: ChatSessionType.CHARACTER,
          avatar: selectedPersona.portrait_url,
          llmType: selected,
          outputTokenMultiplier: 1,
        },
      ]);
    }
    llmType = selected;

    if (cssid) {
      try {
        await api.post(`/api/chat/char/sessions/edit`, {
          cssid,
          llmType: selected,
          outputTokenMultiplier:
            $chatSessions.find((s) => s.id === cssid)?.outputTokenMultiplier ||
            1,
        });
        console.log("Saved LLM preference:", selected);
      } catch (e) {
        console.error("Failed to save LLM preference:", e);
      }
    }

    showModelSelector = false;
  };

  let showRatioOptions = false;
  let chatScrollContainer: HTMLElement | null = null;
</script>

{#if isSettingsModalOpen && persona}
  <SettingsModal
    {persona}
    isOpen={isSettingsModalOpen}
    {llmType}
    outputTokenMultiplier={$chatSessions.find((s) => s.id === persona?.id)
      ?.outputTokenMultiplier || 1}
    mode="2d"
    bind:showImage
    bind:autoScroll
    bind:showBackground
    bind:showVariableStatus
    on:close={() => (isSettingsModalOpen = false)}
  />
{/if}

<ModelSelector
  isOpen={showModelSelector}
  selectedModel={normalizeVisibleLLMType(llmType)}
  on:close={() => (showModelSelector = false)}
  on:confirm={handleModelConfirm}
/>

<main class="chat-layout">
  <div class="settings-button-2d">
    <SettingsButton onClick={() => (isSettingsModalOpen = true)} />
  </div>

  <div class="chat-container" bind:this={chatScrollContainer}>
    <ChatWindow2DNext
      {isLoading}
      {persona}
      {showImage}
      {autoScroll}
      SendMessage={send}
      {showBackground}
      {showVariableStatus}
      typingCharsPerSecond={80}
      scrollTarget={chatScrollContainer}
      bind:showRatioOptions
    />
  </div>
  <div class="chat-input-dock">
    <ChatInput
      onSend={send}
      {isDisabled}
      placeholderName={persona?.name}
      mode="2d"
      neededNeurons={currentCost}
      hasStaticImage={!!persona?.static_portrait_url}
      onImageClick={() => {
        showRatioOptions = !showRatioOptions;
      }}
    />
  </div>
</main>

<style>
  .chat-layout {
    position: fixed;
    top: 0;
    left: 0;
    display: flex;
    height: 100dvh;
    width: 100vw;
    overflow: hidden;
    /* 모바일 기본: 세로 배치 */
    flex-direction: column;
    background-color: var(--background);
  }

  @media (display-mode: standalone) {
    .chat-layout {
      height: 100dvh;
    }
    .chat-container {
      height: 100dvh;
    }
  }

  .chat-container {
    flex: 1; /* 남은 공간 모두 차지 */
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative; /* z-index 적용을 위해 */
    z-index: 1; /* 배경 위에 표시 */
    background: transparent; /* 배경 투명 */
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior-y: contain;
    padding-bottom: calc(
      var(--px-chat-input-reserved-space) + env(safe-area-inset-bottom, 0px)
    );
  }

  .chat-input-dock {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    width: 100%;
    padding: 0 var(--px-chat-input-dock-padding-x)
      calc(env(safe-area-inset-bottom, 0px) + var(--px-chat-input-bottom-gap));
    background: linear-gradient(
      180deg,
      rgba(var(--background-rgb), 0) 0%,
      rgba(var(--background-rgb), 0.82) 26%,
      rgba(var(--background-rgb), 0.96) 100%
    );
    backdrop-filter: blur(10px);
    pointer-events: none;
  }

  .chat-input-dock :global(.chat-input-wrapper) {
    pointer-events: auto;
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

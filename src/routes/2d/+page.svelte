<script lang="ts">
  import { page } from "$app/stores";
  import { t } from "svelte-i18n";
  import {
    createFirstSceneMessage,
    fetch2DChatHistoryPage,
    sendPromptStream,
  } from "$lib/api/chat";
  import ChatWindow2DNext from "$lib/components/chat/ChatWindow2DNext.svelte";
  import ChatInput from "$lib/components/chat/ChatInput.svelte";
  import "$lib/styles/chat-input-position.css";
  import { onMount, tick } from "svelte";
  import SettingsButton from "$lib/components/common/SettingsButton.svelte";
  import { loadPersona } from "$lib/api/edit_persona";
  import type { Persona } from "$lib/types";
  import SettingsModal from "$lib/components/modal/SettingModal.svelte";
  import { pricingStore } from "$lib/stores/pricing";
  import { st_user } from "$lib/stores/user";
  import { ChatSessionType, chatSessions } from "$lib/stores/chatSessions";
  import { get } from "svelte/store";
  import { loadCharacterSessions } from "$lib/api/sessions";
  import { toastError } from "$lib/utils/errorMapper";

  import ModelSelector from "$lib/components/chat/ModelSelector.svelte";
  import { messages } from "$lib/stores/messages";
  import { api } from "$lib/api";
  import { requireAuth } from "$lib/stores/authGate";
  import {
    DEFAULT_2D_LLM_TYPE,
    normalizeVisibleLLMType,
  } from "$lib/utils/llmType";

  let lastSessionId: string | null = null;
  let persona: Persona | null = null;
  const currentSessionId = () => lastSessionId || persona?.id || "";

  $: llmType = $page.url.searchParams.get("llmType") || "Error";

  let currentCost = 0;
  $: if (llmType) {
    // For 2D, we trust the URL param or fallback just like finding session
    // But ideally we should find session to be safe, like live2d
    const session = $chatSessions.find((s) => s.id === lastSessionId);
    const effectiveType = normalizeVisibleLLMType(
      session?.llmType || llmType,
      DEFAULT_2D_LLM_TYPE,
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
  const HISTORY_PAGE_LIMIT = 40;
  const LOAD_OLDER_THRESHOLD = 96;
  let hasMoreHistory = false;
  let oldestLoadedIdx: number | null = null;
  let isLoadingOlderHistory = false;
  let isEnded = false;

  function applySessionRuntime(session: {
    ended?: boolean;
  }) {
    isEnded = !!session?.ended;

    const cssid = currentSessionId();
    if (!cssid) return;

    chatSessions.update((sessions) =>
      sessions.map((item) =>
        item.id === cssid
          ? {
              ...item,
              ended: isEnded,
            }
          : item,
      ),
    );
  }

  function syncCurrentSessionRuntime() {
    const session = get(chatSessions).find((s) => s.id === currentSessionId());
    applySessionRuntime({
      ended: session?.ended,
    });
  }

  function replaceHistoryMessages(historyMessages: typeof $messages) {
    const nextMessages = [createFirstSceneMessage(), ...historyMessages];
    messages.set(nextMessages);

    const historyOnly = historyMessages.filter((message) => message.idx != null);
    oldestLoadedIdx = historyOnly.length > 0 ? historyOnly[0].idx ?? null : null;
    showModelSelector = historyOnly.length === 0;
  }

  function prependOlderMessages(historyMessages: typeof $messages) {
    if (!historyMessages.length) {
      hasMoreHistory = false;
      return;
    }

    messages.update((current) => {
      const firstScene = current[0] ?? createFirstSceneMessage();
      const existing = current.slice(1);
      const existingIdx = new Set(
        existing
          .map((message) => message.idx)
          .filter((value): value is number => value != null),
      );
      const dedupedOlder = historyMessages.filter(
        (message) => message.idx == null || !existingIdx.has(message.idx),
      );
      return [firstScene, ...dedupedOlder, ...existing];
    });

    const firstOlder = historyMessages.find((message) => message.idx != null);
    if (firstOlder?.idx != null) {
      oldestLoadedIdx = firstOlder.idx;
    }
  }

  async function loadRecentHistory(sessionId: string) {
    const result = await fetch2DChatHistoryPage(sessionId, {
      limit: HISTORY_PAGE_LIMIT,
    });
    replaceHistoryMessages(result.messages);
    hasMoreHistory = result.hasMore;
    applySessionRuntime(result.session || {});
  }

  async function loadOlderHistory() {
    if (
      isLoadingOlderHistory ||
      !hasMoreHistory ||
      oldestLoadedIdx == null ||
      !chatScrollContainer ||
      !currentSessionId()
    ) {
      return;
    }

    isLoadingOlderHistory = true;
    const previousScrollHeight = chatScrollContainer.scrollHeight;
    const previousScrollTop = chatScrollContainer.scrollTop;

    try {
      const result = await fetch2DChatHistoryPage(currentSessionId(), {
        beforeIdx: oldestLoadedIdx,
        limit: HISTORY_PAGE_LIMIT,
      });
      prependOlderMessages(result.messages);
      hasMoreHistory = result.hasMore;
      await tick();

      if (chatScrollContainer) {
        const nextScrollHeight = chatScrollContainer.scrollHeight;
        chatScrollContainer.scrollTop =
          previousScrollTop + (nextScrollHeight - previousScrollHeight);
      }
    } catch (error) {
      console.error("Failed to load older chat history:", error);
      toastError(error as Error);
    } finally {
      isLoadingOlderHistory = false;
    }
  }

  function handleChatScroll() {
    if (!chatScrollContainer || isLoadingOlderHistory || !hasMoreHistory) return;
    if (chatScrollContainer.scrollTop <= LOAD_OLDER_THRESHOLD) {
      void loadOlderHistory();
    }
  }

  const loadChatData = async () => {
    const sessionId = $page.url.searchParams.get("c");
    lastSessionId = sessionId;
    const currentLoad = ++loadSequence;
    if (sessionId) {
      messages.set([]);
      persona = null;
      showModelSelector = false;
      hasMoreHistory = false;
      oldestLoadedIdx = null;
      isEnded = false;

      try {
        const canAccessChat = await requireAuth({
          source: "page",
          reason: "chat-2d-access",
        });

        const p = await loadPersona(sessionId);

        if (currentLoad !== loadSequence || lastSessionId !== sessionId) {
          return;
        }

        persona = p;

        if (!canAccessChat) {
          $messages = [createFirstSceneMessage()];
          return;
        }

        await loadRecentHistory(sessionId);
        await loadCharacterSessions();
        syncCurrentSessionRuntime();

        if (currentLoad !== loadSequence || lastSessionId !== sessionId) {
          return;
        }
      } catch (e) {
        console.error("Failed to load chat data:", e);
        toastError(e as Error);
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
    if (isLoading || isDisabled || isEnded) return;

    const sessionId = $page.url.searchParams.get("c");

    // Optimistic Credit Deduction
    st_user.update((u) => {
      if (u && u.credits >= currentCost) {
        u.credits -= currentCost;
      }
      return u;
    });

    let ErrorHandler = async (error: any) => {
      onError?.(error);
      toastError(error instanceof Error ? error : new Error(String(error)));
      if (sessionId) {
        try {
          await loadRecentHistory(sessionId);
          await loadCharacterSessions();
          syncCurrentSessionRuntime();
        } catch (reloadError) {
          console.error("Failed to reload 2D history after error:", reloadError);
        }
      }
    };

    isLoading = true;
    isDisabled = true;
    await sendPromptStream(
      sessionId ?? "",
      prompt,
      "2d",
      async () => {
        await loadCharacterSessions();
        syncCurrentSessionRuntime();
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
    on:historyreload={async () => {
      const sessionId = currentSessionId();
      if (!sessionId) return;
      await loadRecentHistory(sessionId);
      await loadCharacterSessions();
      syncCurrentSessionRuntime();
    }}
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

  <div
    class="chat-container"
    bind:this={chatScrollContainer}
    on:scroll={handleChatScroll}
  >
    {#if hasMoreHistory || isLoadingOlderHistory}
      <div class="history-loader">
        <button
          type="button"
          class="history-loader__button"
          on:click={() => loadOlderHistory()}
          disabled={isLoadingOlderHistory}
        >
          {#if isLoadingOlderHistory}
            {$t("chat2d.loadingOlder")}
          {:else}
            {$t("chat2d.loadOlder")}
          {/if}
        </button>
      </div>
    {/if}
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
    {#if isEnded}
      <div class="ending-lock-banner">
        <strong>{$t("chat2d.defaultEndingTitle")}</strong>
        <span>{$t("chat2d.endingLockedHard")}</span>
      </div>
    {/if}
    <ChatInput
      onSend={send}
      isDisabled={isDisabled || isEnded}
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

  .history-loader {
    display: flex;
    justify-content: center;
    padding: 0.85rem 1rem 0.45rem;
  }

  .history-loader__button {
    appearance: none;
    border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--card) 86%, transparent);
    color: var(--muted-foreground);
    padding: 0.55rem 0.9rem;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition:
      background 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease;
  }

  .history-loader__button:hover:not(:disabled) {
    color: var(--foreground);
    border-color: color-mix(in srgb, var(--primary) 38%, var(--border));
    background: color-mix(in srgb, var(--card) 92%, var(--primary) 8%);
  }

  .history-loader__button:disabled {
    cursor: wait;
    opacity: 0.8;
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

  .ending-lock-banner {
    pointer-events: auto;
    width: min(720px, calc(100% - 1rem));
    margin: 0 auto 0.65rem;
    padding: 0.75rem 0.9rem;
    border-radius: 16px;
    border: 1px solid rgba(250, 204, 21, 0.38);
    background:
      linear-gradient(180deg, rgba(250, 204, 21, 0.13), rgba(250, 204, 21, 0.03)),
      rgba(15, 23, 42, 0.92);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 0.24rem;
  }

  .ending-lock-banner strong {
    color: #fff7cc;
    font-size: 0.95rem;
    font-weight: 800;
  }

  .ending-lock-banner span {
    color: rgba(255, 251, 235, 0.8);
    font-size: 0.82rem;
    line-height: 1.5;
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

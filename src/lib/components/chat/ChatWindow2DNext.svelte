<script lang="ts">
  import "$lib/styles/custom-markdown.css";
  import "$lib/styles/chat2d-shared-block-defaults.css";
  import "$lib/styles/chat-input-position.css";
  import { get, writable } from "svelte/store";
  import { onDestroy, onMount, tick } from "svelte";
  import { t } from "svelte-i18n";
  import Icon from "@iconify/svelte";
  import type { Persona, ImageMetadata } from "$lib/types";
  import { messages, type Message } from "$lib/stores/messages";
  import { st_user } from "$lib/stores/user";
  import {
    chatSessions,
    type DialogueRenderStyle,
  } from "$lib/stores/chatSessions";
  import { interactiveChat } from "$lib/actions/interactiveChat";
  import { api } from "$lib/api";
  import { getCachedAssetType } from "$lib/api/edit_persona";
  import { toastError } from "$lib/utils/errorMapper";
  import ChatRenderer from "./ChatRenderer.svelte";
  import ChatImage from "./ChatImage.svelte";
  import VariableStatusPanel from "./VariableStatusPanel.svelte";
  import AstroChartInline from "./AstroChartInline.svelte";
  import SajuChartInline from "./SajuChartInline.svelte";
  import { Chat2DScrollController } from "$lib/chat2d/scroll-controller";
  import { parseChat2DMessages } from "$lib/chat2d/parser";
  import { assembleRenderableAssistantContent } from "$lib/chat2d/stream-assembler";
  import type { Chat2DBlock } from "$lib/chat2d/types";
  import {
    createRenderBlockPlayer,
    type RenderBlockPlayer,
    type TestRenderableBlock,
  } from "$lib/test-chat2d/blockPlayers";

  export let isLoading = false;
  export let showChat = true;
  export let persona: Persona | null = null;
  export let showImage = true;
  export let autoScroll = true;
  export let showBackground = false;
  export let showVariableStatus = false;
  export let showRatioOptions = false;
  export let SendMessage: (msg: string) => void = () => {};
  export let typingCharsPerSecond: number | null = null;
  export let scrollTarget: HTMLElement | null = null;

  let chatWindowEl: HTMLElement;
  let scrollContainer: HTMLElement | null = null;

  let players: RenderBlockPlayer[] = [];
  let renderBlocks = writable<TestRenderableBlock[]>([]);
  let activeBackgroundImage: string | null = null;
  let backgroundMeta: ImageMetadata = { url: "", description: "" };
  let backgroundCandidateMeta: ImageMetadata = { url: "", description: "" };
  let backgroundVideoReady = false;
  let sharedChatStyleCSS = "";
  let lastFrame = 0;
  let rafId = 0;
  let isGeneratingImage = false;
  let lastAutoScrollMessageCount = 0;
  const streamedAssistantIds = new Set<string>();
  let scrollController: Chat2DScrollController | null = null;
  let showJumpToBottom = false;
  let scrollCleanup: (() => void) | null = null;
  let lastScrollContainer: HTMLElement | null = null;
  let showAssistantLoadingBubble = false;
  let scrollResizeObserver: ResizeObserver | null = null;
  let backgroundImageIndex: number | null = null;
  let backgroundCandidateIndex: number | null = null;
  let lastBackgroundUnlockKey = "";
  let backgroundPrepareRequestId = 0;
  let lastPreparedBackgroundKey = "";
  const loadedBackgroundImageUrls = new Set<string>();
  const loadedBackgroundVideoUrls = new Set<string>();
  let dialogueRenderStyle: DialogueRenderStyle = "bubble";

  function getScrollContainer() {
    return scrollContainer;
  }

  function isNearBottom(container: HTMLElement) {
    const distance =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    return distance <= 48;
  }

  function syncJumpToBottomButton() {
    const container = getScrollContainer();
    if (!container) {
      showJumpToBottom = false;
      return;
    }

    showJumpToBottom = !isNearBottom(container);
  }

  function jumpToBottomAndResume() {
    if (!scrollController) return;
    scrollController.resumeAutoFollow();
    showJumpToBottom = false;
    tick().then(() => scrollController?.scrollToBottom(true));
  }

  function setupScrollController() {
    const container = getScrollContainer();
    if (container === lastScrollContainer) return;

    scrollCleanup?.();
    scrollCleanup = null;
    scrollResizeObserver?.disconnect();
    scrollResizeObserver = null;
    lastScrollContainer = container;

    if (!container) {
      scrollController = null;
      showJumpToBottom = false;
      return;
    }

    scrollController = new Chat2DScrollController(container);

    const handleWheel = () => {
      scrollController?.suspendByUserIntent();
      syncJumpToBottomButton();
    };

    const handleTouchStart = () => {
      scrollController?.suspendByUserIntent();
      syncJumpToBottomButton();
    };

    const handleScroll = () => {
      scrollController?.handleScroll();
      syncJumpToBottomButton();
    };

    container.addEventListener("wheel", handleWheel, { passive: true });
    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("scroll", handleScroll, { passive: true });

    scrollCleanup = () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("scroll", handleScroll);
    };

    scrollResizeObserver = new ResizeObserver(() => {
      syncJumpToBottomButton();
    });
    scrollResizeObserver.observe(container);

    tick().then(() => {
      scrollController?.scrollToBottom(true);
      syncJumpToBottomButton();
    });
  }

  function normalizeSharedChatStyleCSS(raw: string | undefined) {
    if (!raw) return "";
    return raw
      .replace(/<style\b[^>]*>/gi, "")
      .replace(/<\/style>/gi, "")
      .trim();
  }

  function getEffectiveUserName() {
    const user = get(st_user);
    const personas = user?.data?.userPersonas ?? [];
    const session = get(chatSessions).find((s) => s.id === persona?.id);
    const selectedPersonaId = (session?.userPersonaId || "").trim();

    if (selectedPersonaId) {
      const selected = personas.find(
        (p) => p.id === selectedPersonaId && (p.name || "").trim(),
      );
      if (selected?.name?.trim()) return selected.name.trim();
    }

    const defaultPersona = personas.find(
      (p) => p.isDefault && (p.name || "").trim(),
    );
    if (defaultPersona?.name?.trim()) return defaultPersona.name.trim();

    return user?.data?.nickname?.trim() || "User";
  }

  function inferTypingSpeedFromText(text: string) {
    const hangulCount = (text.match(/[가-힣]/g) || []).length;
    const latinCount = (text.match(/[A-Za-z]/g) || []).length;
    const letterCount = hangulCount + latinCount;

    if (letterCount === 0) return 100;

    const hangulRatio = hangulCount / letterCount;
    const latinRatio = latinCount / letterCount;

    if (hangulRatio >= 0.3) return 80;
    if (latinRatio >= 0.8 && hangulCount === 0) return 140;
    return 110;
  }

  function getTypingSpeed(activePlayer?: RenderBlockPlayer) {
    if (typingCharsPerSecond && typingCharsPerSecond > 0) {
      return typingCharsPerSecond;
    }

    const block = activePlayer?.block;
    if (!block) return 100;

    if (
      block.type === "dialogue" ||
      block.type === "narration" ||
      block.type === "code"
    ) {
      return inferTypingSpeedFromText(block.content || "");
    }

    return 100;
  }

  function getMessageStreamId(msg: Message, index: number) {
    return msg.key ? `msg-${msg.key}` : `msg-${index}`;
  }

  function buildParsedBlocks(sourceMessages: Message[]) {
    sourceMessages.forEach((msg, index) => {
      if (msg.role === "assistant" && msg.done === false) {
        streamedAssistantIds.add(getMessageStreamId(msg, index));
      }
    });

    const normalizedMessages = sourceMessages.map((msg) => {
      if (msg.role !== "assistant") return msg;
      if (msg.done === true) return msg;
      return {
        ...msg,
        content: assembleRenderableAssistantContent(msg.content).content,
      };
    });

    const blocks = parseChat2DMessages(
      normalizedMessages,
      {
        persona,
        userName: getEffectiveUserName(),
      },
      {
        showVariableStatus,
        revealVariableStatus:
          normalizedMessages[normalizedMessages.length - 1]?.role ===
            "assistant" &&
          normalizedMessages[normalizedMessages.length - 1]?.done === true,
        varSourceMessages: sourceMessages,
      },
    );

    const lastAssistant = [...normalizedMessages]
      .reverse()
      .find((msg) => msg.role === "assistant");
    const lastAssistantBaseId = lastAssistant?.key
      ? `msg-${lastAssistant.key}`
      : "";

    let trailingPendingId = "";
    if (lastAssistant && lastAssistant.done !== true && lastAssistantBaseId) {
      const trailingBlock = [...blocks]
        .reverse()
        .find((block) => block.id.startsWith(lastAssistantBaseId));
      trailingPendingId = trailingBlock?.id || "";
    }

    return blocks.map((block) => {
      const ownerMessage = normalizedMessages.find((msg, index) => {
        const messageId = getMessageStreamId(msg, index);
        return block.id.startsWith(messageId);
      });

      const ownerMessageId = ownerMessage
        ? getMessageStreamId(
            ownerMessage,
            normalizedMessages.indexOf(ownerMessage),
          )
        : "";

      const sealed = trailingPendingId ? block.id !== trailingPendingId : true;
      const shouldPrecomplete =
        ownerMessage?.role !== "assistant" ||
        (ownerMessage?.done === true &&
          !streamedAssistantIds.has(ownerMessageId));

      return {
        block,
        sealed,
        shouldPrecomplete,
      };
    });
  }

  function syncPlayers(
    blockEntries: {
      block: Chat2DBlock;
      sealed: boolean;
      shouldPrecomplete: boolean;
    }[],
  ) {
    const existing = new Map(players.map((player) => [player.id, player]));
    players = blockEntries.map(({ block, sealed, shouldPrecomplete }) => {
      const player = existing.get(block.id);
      if (player) {
        player.update(block, sealed);
        if (shouldPrecomplete && !player.completed) {
          player.forceComplete();
        }
        return player;
      }
      const nextPlayer = createRenderBlockPlayer(block, sealed);
      if (shouldPrecomplete) {
        nextPlayer.forceComplete();
      }
      return nextPlayer;
    });

    startEligiblePlayers();
    publishBlocks();
    updateBackground();
  }

  function startEligiblePlayers() {
    for (let i = 0; i < players.length; i += 1) {
      const player = players[i];
      const previousCompleted = players
        .slice(0, i)
        .every((candidate) => candidate.completed);

      if (!previousCompleted) break;
      if (!player.started) {
        player.start();
      }
      if (!player.completed) break;
    }
  }

  function publishBlocks() {
    renderBlocks.set(
      players
        .map((player) => player.getRenderableBlock())
        .filter(Boolean) as TestRenderableBlock[],
    );
  }

  function resetBackgroundState() {
    activeBackgroundImage = null;
    backgroundMeta = { url: "", description: "" };
    backgroundCandidateMeta = { url: "", description: "" };
    backgroundVideoReady = false;
    backgroundImageIndex = null;
    backgroundCandidateIndex = null;
  }

  function commitBackground(
    meta: ImageMetadata,
    index: number | null,
    options?: { videoReady?: boolean },
  ) {
    backgroundMeta = meta;
    backgroundImageIndex = index;
    activeBackgroundImage = getBackgroundPreviewImage(meta);
    backgroundVideoReady =
      options?.videoReady ?? (hasVideoBackground(meta) ? false : true);
  }

  function updateBackground() {
    if (!showBackground) {
      resetBackgroundState();
      return;
    }

    const lastImage = [...get(renderBlocks)]
      .reverse()
      .find((item) => item.type === "image" || item.type === "markdown_image");

    if (!lastImage) {
      resetBackgroundState();
      return;
    }

    if (lastImage.type === "image") {
      const nextIndex =
        typeof lastImage.index === "number" ? lastImage.index : null;
      backgroundCandidateIndex = nextIndex;
      backgroundCandidateMeta = lastImage.metadata;
      return;
    }

    backgroundCandidateIndex = null;
    backgroundCandidateMeta = {
      url: lastImage.url,
      description: lastImage.alt,
      type: "image",
    };
  }

  function tickPlayers(timestamp: number) {
    const deltaMs = lastFrame ? timestamp - lastFrame : 0;
    lastFrame = timestamp;

    let changed = false;
    const activePlayer = players.find(
      (player) => player.started && !player.completed,
    );

    if (activePlayer) {
      changed =
        activePlayer.tick(deltaMs, getTypingSpeed(activePlayer)) || changed;

      if (activePlayer.completed) {
        startEligiblePlayers();
        changed = true;
      }
    }

    if (changed) {
      publishBlocks();
      updateBackground();

      if (autoScroll && scrollController?.canAutoFollow()) {
        tick().then(() => {
          const container = getScrollContainer();
          container?.scrollTo({
            top: container.scrollHeight,
            behavior: "auto",
          });
          syncJumpToBottomButton();
        });
      }
    }

    rafId = requestAnimationFrame(tickPlayers);
  }

  function getBackgroundImageStyle(url: string | null) {
    if (!url) return "none";
    return `url("${url.replace(/"/g, '\\"')}")`;
  }

  function inferMediaTypeFromUrl(url: string | undefined) {
    if (!url) return "unknown";

    const normalized = url.split("?")[0].toLowerCase();

    if (/\.(mp4|webm|mov|m4v|ogv|ogg)$/i.test(normalized)) {
      return "video";
    }

    if (/\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(normalized)) {
      return "image";
    }

    return "unknown";
  }

  function getBackgroundPreviewImage(meta: ImageMetadata) {
    const resolvedType =
      meta.type && meta.type !== "unknown"
        ? meta.type
        : inferMediaTypeFromUrl(meta.url);

    if (resolvedType === "video") {
      return meta.static_url || null;
    }

    if (resolvedType === "image") {
      return meta.static_url || meta.url || null;
    }

    return meta.static_url || null;
  }

  function getBackgroundResolvedType(meta: ImageMetadata) {
    if (meta.type && meta.type !== "unknown") {
      return meta.type;
    }

    const cachedType = getCachedAssetType(meta.url);
    if (cachedType) {
      return cachedType;
    }

    return inferMediaTypeFromUrl(meta.url);
  }

  function getBackgroundCandidateKey(meta: ImageMetadata, index: number | null) {
    if (!showBackground) return "";
    if (!meta.url && !meta.static_url && index === null) return "";

    return `${index ?? "md"}|${meta.url || ""}|${meta.static_url || ""}|${
      meta.type || ""
    }`;
  }

  function isSameBackground(
    nextMeta: ImageMetadata,
    nextIndex: number | null,
    currentMeta: ImageMetadata,
    currentIndex: number | null,
  ) {
    return (
      nextIndex === currentIndex &&
      (nextMeta.url || "") === (currentMeta.url || "") &&
      (nextMeta.static_url || "") === (currentMeta.static_url || "") &&
      getBackgroundResolvedType(nextMeta) === getBackgroundResolvedType(currentMeta)
    );
  }

  function isSameBackgroundTarget(
    nextMeta: ImageMetadata,
    nextIndex: number | null,
    currentMeta: ImageMetadata,
    currentIndex: number | null,
  ) {
    return (
      nextIndex === currentIndex &&
      (nextMeta.url || "") === (currentMeta.url || "") &&
      (nextMeta.static_url || "") === (currentMeta.static_url || "")
    );
  }

  function markBackgroundImageLoaded(url: string | undefined) {
    if (url) {
      loadedBackgroundImageUrls.add(url);
    }
  }

  function markBackgroundVideoLoaded(url: string | undefined) {
    if (url) {
      loadedBackgroundVideoUrls.add(url);
    }
  }

  function preloadImageUrl(url: string) {
    if (!url) return Promise.resolve(false);
    if (loadedBackgroundImageUrls.has(url)) return Promise.resolve(true);

    return new Promise<boolean>((resolve) => {
      const image = new Image();
      const cleanup = () => {
        image.onload = null;
        image.onerror = null;
      };

      image.onload = () => {
        markBackgroundImageLoaded(url);
        cleanup();
        resolve(true);
      };

      image.onerror = () => {
        cleanup();
        resolve(false);
      };

      image.src = url;
    });
  }

  function preloadVideoUrl(url: string) {
    if (!url) return Promise.resolve(false);
    if (loadedBackgroundVideoUrls.has(url)) return Promise.resolve(true);

    return new Promise<boolean>((resolve) => {
      const video = document.createElement("video");
      let settled = false;

      const cleanup = () => {
        video.removeAttribute("src");
        video.load();
        video.onloadeddata = null;
        video.onerror = null;
      };

      const finalize = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (ok) {
          markBackgroundVideoLoaded(url);
        }
        cleanup();
        resolve(ok);
      };

      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.onloadeddata = () => finalize(true);
      video.onerror = () => finalize(false);
      video.src = url;
      video.load();
    });
  }

  async function detectBackgroundTypeByPreload(meta: ImageMetadata) {
    if (!meta.url) return meta;

    const imageLoaded = await preloadImageUrl(meta.url);
    if (imageLoaded) {
      return { ...meta, type: "image" as const };
    }

    const videoLoaded = await preloadVideoUrl(meta.url);
    if (videoLoaded) {
      return { ...meta, type: "video" as const };
    }

    return { ...meta, type: "unknown" as const };
  }

  async function prepareBackgroundCandidate(
    sourceMeta: ImageMetadata,
    sourceIndex: number | null,
    requestId: number,
  ) {
    let nextMeta = { ...sourceMeta };

    if (sourceIndex !== null && !nextMeta.url && persona?.id) {
      const personaId = persona.id;
      const unlockKey = `${personaId}:${sourceIndex}`;
      lastBackgroundUnlockKey = unlockKey;

      const res = await api.get(
        `/api/persona/asset?id=${personaId}&index=${sourceIndex}`,
      );
      if (!res.ok) {
        throw new Error(`Failed to unlock background asset: ${res.status}`);
      }

      const data = await res.json();

      if (
        requestId !== backgroundPrepareRequestId ||
        !showBackground ||
        backgroundCandidateIndex !== sourceIndex ||
        persona?.id !== personaId
      ) {
        return;
      }

      nextMeta = {
        ...nextMeta,
        ...(persona?.image_metadatas?.[sourceIndex] || {}),
        ...data,
        url: data.url || nextMeta.url,
        type:
          data.type ||
          persona?.image_metadatas?.[sourceIndex]?.type ||
          nextMeta.type,
      };
    }

    if (requestId !== backgroundPrepareRequestId || !showBackground) {
      return;
    }

    let resolvedType = getBackgroundResolvedType(nextMeta);
    if (resolvedType === "unknown" && nextMeta.url) {
      nextMeta = await detectBackgroundTypeByPreload(nextMeta);
      resolvedType = getBackgroundResolvedType(nextMeta);
    }

    if (requestId !== backgroundPrepareRequestId || !showBackground) {
      return;
    }

    let videoReady = false;

    if (resolvedType === "image") {
      const previewUrl = nextMeta.static_url || nextMeta.url;
      if (!previewUrl) return;

      const ready = await preloadImageUrl(previewUrl);
      if (!ready) return;
      nextMeta = { ...nextMeta, type: "image" };
    } else if (resolvedType === "video") {
      nextMeta = { ...nextMeta, type: "video" };

      if (nextMeta.static_url) {
        const posterReady = await preloadImageUrl(nextMeta.static_url);
        if (!posterReady) return;
      } else if (nextMeta.url) {
        const videoLoaded = await preloadVideoUrl(nextMeta.url);
        if (!videoLoaded) return;
        videoReady = true;
      }

      if (nextMeta.url && loadedBackgroundVideoUrls.has(nextMeta.url)) {
        videoReady = true;
      }
    } else {
      return;
    }

    if (
      requestId !== backgroundPrepareRequestId ||
      !showBackground ||
      !isSameBackgroundTarget(
        nextMeta,
        sourceIndex,
        backgroundCandidateMeta,
        backgroundCandidateIndex,
      )
    ) {
      return;
    }

    backgroundCandidateMeta = nextMeta;

    if (sourceIndex !== null && persona?.image_metadatas?.[sourceIndex]) {
      persona.image_metadatas[sourceIndex] = nextMeta;
    }

    commitBackground(nextMeta, sourceIndex, {
      videoReady,
    });
  }

  function hasVideoBackground(meta: ImageMetadata) {
    return getBackgroundResolvedType(meta) === "video" && !!meta.url;
  }

  $: {
    const candidateKey = getBackgroundCandidateKey(
      backgroundCandidateMeta,
      backgroundCandidateIndex,
    );

    if (!candidateKey) {
      lastBackgroundUnlockKey = "";
      lastPreparedBackgroundKey = "";
      backgroundPrepareRequestId += 1;
    } else if (
      candidateKey !== lastPreparedBackgroundKey &&
      !isSameBackground(
        backgroundCandidateMeta,
        backgroundCandidateIndex,
        backgroundMeta,
        backgroundImageIndex,
      )
    ) {
      lastPreparedBackgroundKey = candidateKey;
      const requestId = ++backgroundPrepareRequestId;
      const candidateMeta = { ...backgroundCandidateMeta };
      const candidateIndex = backgroundCandidateIndex;

      void prepareBackgroundCandidate(candidateMeta, candidateIndex, requestId).catch(
        (error) => {
          console.error("Failed to prepare background asset:", error);
        },
      );
    }
  }

  function handleVariablePanelRendered() {
    if (!autoScroll || !scrollController?.canAutoFollow()) return;
    tick().then(() => {
      const container = getScrollContainer();
      container?.scrollTo({ top: container.scrollHeight, behavior: "auto" });
      syncJumpToBottomButton();
    });
  }

  function handleImageLoad(event?: Event) {
    const detail = (event as CustomEvent<any> | undefined)?.detail;
    const resolvedType = detail?.type as ImageMetadata["type"] | undefined;
    const metadataIndex =
      typeof detail?.index === "number" ? detail.index : undefined;
    const assetUrl = detail?.assetUrl as string | undefined;
    const loadedUrl = detail?.url as string | undefined;

    if (resolvedType === "video") {
      markBackgroundVideoLoaded(assetUrl || loadedUrl);
      markBackgroundImageLoaded(loadedUrl && loadedUrl !== assetUrl ? loadedUrl : undefined);
    } else {
      markBackgroundImageLoaded(loadedUrl || assetUrl);
    }

    if (
      resolvedType &&
      metadataIndex !== undefined &&
      persona?.image_metadatas?.[metadataIndex]
    ) {
      persona.image_metadatas[metadataIndex].type = resolvedType;
    }

    if (
      resolvedType &&
      metadataIndex !== undefined &&
      backgroundCandidateIndex === metadataIndex
    ) {
      backgroundCandidateMeta = { ...backgroundCandidateMeta, type: resolvedType };
    }

    if (
      resolvedType &&
      assetUrl &&
      backgroundMeta.url &&
      backgroundMeta.url === assetUrl
    ) {
      backgroundMeta = { ...backgroundMeta, type: resolvedType };
      activeBackgroundImage = getBackgroundPreviewImage(backgroundMeta);
      if (resolvedType === "video") {
        backgroundVideoReady = true;
      }
    }

    if (!autoScroll || !scrollController?.canAutoFollow()) return;
    tick().then(() => {
      const container = getScrollContainer();
      container?.scrollTo({ top: container.scrollHeight, behavior: "auto" });
      syncJumpToBottomButton();
    });
  }

  async function generateSituationImage(ratio: string) {
    if (isGeneratingImage || !persona) return;
    isGeneratingImage = true;
    showRatioOptions = false;

    try {
      const response = await api.post("/api/chat/2d/generate-image", {
        personaId: persona.id,
        context: "",
        aspectRatio: ratio,
      });

      if (!response.ok) {
        if (response.status === 402) {
          toastError("ERR_INSUFFICIENT_CREDITS");
        } else {
          const errData = await response.json();
          toastError(errData.error || "Image generation failed");
        }
        return;
      }

      const data = await response.json();
      const imageUrl = data.imageUrl;

      messages.update((current) => {
        const updated = [...current];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          last.content += `\n\n![Situation Image](${imageUrl})`;
        }
        return updated;
      });
    } catch (error) {
      console.error("Failed to generate image", error);
      toastError("Network error during generation");
    } finally {
      isGeneratingImage = false;
    }
  }

  $: scrollContainer = scrollTarget ?? chatWindowEl ?? null;

  $: sharedChatStyleCSS = normalizeSharedChatStyleCSS(persona?.chat_style_css);
  $: dialogueRenderStyle =
    $chatSessions.find((s) => s.id === persona?.id)?.dialogueRenderStyle ||
    "bubble";

  $: {
    const source = $messages;
    const last = source[source.length - 1];
    showAssistantLoadingBubble = !!last && isLoading && last.role === "user";
  }

  $: {
    void $renderBlocks;
    void showBackground;
    updateBackground();
  }

  $: syncPlayers(buildParsedBlocks($messages));

  $: if (persona || showVariableStatus !== undefined) {
    syncPlayers(buildParsedBlocks($messages));
  }

  $: if (scrollContainer) {
    setupScrollController();
  }

  $: if (scrollContainer && autoScroll) {
    const source = $messages;
    const last = source[source.length - 1];

    if (source.length !== lastAutoScrollMessageCount) {
      lastAutoScrollMessageCount = source.length;

      tick().then(() => {
        if (!scrollContainer || !scrollController) return;

        if (last?.role === "user" || scrollController.canAutoFollow()) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: "auto",
          });
        }

        syncJumpToBottomButton();
      });
    }
  }

  $: if (showRatioOptions && autoScroll && scrollController?.canAutoFollow()) {
    tick().then(() => {
      scrollController?.scrollToBottom();
      syncJumpToBottomButton();
    });
  }

  $: if (showAssistantLoadingBubble) {
    const loadingBlockCount = $renderBlocks.length;
    tick().then(() => {
      const container = getScrollContainer();
      void loadingBlockCount;
      container?.scrollTo({
        top: container.scrollHeight,
        behavior: "auto",
      });
      syncJumpToBottomButton();
    });
  }

  onMount(() => {
    rafId = requestAnimationFrame(tickPlayers);

    tick().then(() => {
      syncJumpToBottomButton();
    });
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
    scrollCleanup?.();
    scrollResizeObserver?.disconnect();
  });
</script>

<div
  class="chat-window chat2d-surface"
  class:background-mode={showBackground &&
    (!!activeBackgroundImage || hasVideoBackground(backgroundMeta))}
  bind:this={chatWindowEl}
  style:opacity={showChat ? "0.9" : "0"}
  style:visibility={showChat ? "visible" : "hidden"}
  style:pointer-events={showChat ? "auto" : "none"}
  style:--chat-background-image={getBackgroundImageStyle(activeBackgroundImage)}
  use:interactiveChat={{
    callback: (payload) => SendMessage(payload),
    resetKey: persona?.id || "chat-window-2d-next",
  }}
>
  {#if sharedChatStyleCSS}
    <svelte:element this={"style"}>{sharedChatStyleCSS}</svelte:element>
  {/if}

  {#if showBackground && hasVideoBackground(backgroundMeta)}
    <div class="chat-background-video-layer" aria-hidden="true">
      <video
        class="chat-background-video"
        class:ready={backgroundVideoReady}
        src={backgroundMeta.url}
        poster={backgroundMeta.static_url || activeBackgroundImage || undefined}
        autoplay
        muted
        loop
        playsinline
        on:loadeddata={() => {
          if (backgroundMeta.url) {
            markBackgroundVideoLoaded(backgroundMeta.url);
          }
          backgroundVideoReady = true;
        }}
      ></video>
    </div>
  {/if}

  {#each $renderBlocks as item (item.id)}
    {#if item.type === "user"}
      <div class="message user">{item.content}</div>
    {:else if item.type === "user-interaction"}
      <div class="user-interaction">{item.content}</div>
    {:else if item.type === "narration"}
      <ChatRenderer content={item.content} wrapperClass="px-narration" />
    {:else if item.type === "dialogue"}
      {#if dialogueRenderStyle === "inline-yellow"}
        <div class="message assistant assistant-inline-yellow">
          <div class="dialogue-inline-yellow px-dialogue-inline">
            <span class="dialogue-inline-yellow__speaker">{item.speaker}</span>
            <span class="dialogue-inline-yellow__separator">|</span>
            <ChatRenderer
              content={item.content}
              isMessage={true}
              wrapperClass="px-dialogue-inline__content"
            />
          </div>
        </div>
      {:else}
        <div class="message assistant">
          <div class="speaker-name">{item.speaker}</div>
          <div class="dialogue-bubble px-dialogue">
            <ChatRenderer
              content={item.content}
              isMessage={true}
              wrapperClass="px-dialogue__content"
            />
          </div>
        </div>
      {/if}
    {:else if item.type === "image" && showImage && !showBackground}
      <div class="image-block">
        <ChatImage
          {persona}
          metadata={item.metadata}
          index={item.index}
          on:load={handleImageLoad}
        />
      </div>
    {:else if item.type === "markdown_image" && showImage && !showBackground}
      <div class="image-block situation-image">
        <img
          src={item.url}
          alt={item.alt}
          loading="lazy"
          on:load={handleImageLoad}
        />
      </div>
    {:else if item.type === "vars_status" && showVariableStatus}
      <div class="vars-status-inline">
        <VariableStatusPanel
          template={persona?.status_template || ""}
          css={persona?.status_template_css || ""}
          variables={item.variables}
          on:rendered={handleVariablePanelRendered}
        />
      </div>
    {:else if item.type === "ending"}
      <div class="ending-card" role="status" aria-live="polite">
        <div class="ending-card__eyebrow">{$t("chatEnding.eyebrow")}</div>
        <div class="ending-card__title">{$t("chatEnding.defaultTitle")}</div>
        <p class="ending-card__description">{$t("chatEnding.hardDescription")}</p>
      </div>
    {:else if item.type === "astro_chart"}
      <div class="astro-chart-wrapper">
        <AstroChartInline input={item.input as any} blockId={item.id} />
      </div>
    {:else if item.type === "saju_chart"}
      <div class="saju-chart-wrapper">
        <SajuChartInline input={item.input as any} />
      </div>
    {:else if item.type === "situation_trigger"}
      <div class="situation-trigger-wrapper">
        {#if showRatioOptions && !isGeneratingImage}
          <div class="ratio-group">
            <button
              class="ratio-btn"
              on:click={() => generateSituationImage("16:9")}>16:9</button
            >
            <button
              class="ratio-btn"
              on:click={() => generateSituationImage("1:1")}>1:1</button
            >
            <button
              class="ratio-btn"
              on:click={() => generateSituationImage("3:4")}>3:4</button
            >
            <button
              class="ratio-cancel-btn"
              on:click={() => (showRatioOptions = false)}>X</button
            >
          </div>
        {/if}

        {#if isGeneratingImage}
          <div class="generating-indicator">
            <span class="spinner-sm"></span>
            {$t("chatInput.generatingImage")}
          </div>
        {/if}
      </div>
    {:else if item.type === "code"}
      <div class="code-block">
        {#if item.language}
          <div class="language-tag">{item.language}</div>
        {/if}
        <pre><code>{item.content}</code></pre>
      </div>
    {/if}
  {/each}

  {#if showAssistantLoadingBubble}
    <div class="typing-placeholder" role="status" aria-live="polite">
      <div class="typing-dots" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
    </div>
  {/if}

  {#if showJumpToBottom}
    <button
      class="jump-to-bottom-btn"
      type="button"
      aria-label={$t("chatWindow.jumpToBottom")}
      on:click={jumpToBottomAndResume}
    >
      <Icon icon="ph:arrow-down-bold" width="18" height="18" />
    </button>
  {/if}
</div>

<style>
  .chat-window {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
    padding-top: 50px;
    padding-bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: relative;
    isolation: isolate;
  }

  .chat-window.background-mode::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background-image: var(--chat-background-image, none);
    background-size: cover;
    background-position: center center;
    background-repeat: no-repeat;
    opacity: 0.36;
  }

  .chat-window.background-mode::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.5);
  }

  .chat-background-video-layer {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .chat-background-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 160ms ease;
  }

  .chat-background-video.ready {
    opacity: 0.42;
  }

  .message,
  .image-block,
  .code-block,
  .ending-card,
  .situation-trigger-wrapper,
  .astro-chart-wrapper,
  .saju-chart-wrapper {
    position: relative;
    z-index: 1;
  }

  .astro-chart-wrapper,
  .saju-chart-wrapper {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .message {
    display: flex;
    width: fit-content;
    max-width: 80%;
    line-height: 1.5;
    word-break: break-word;
  }

  .message.user {
    align-self: flex-end;
    background-color: var(--primary);
    color: var(--primary-foreground);
    padding: 0.75rem 1rem;
    border-radius: 16px;
  }

  .message.assistant {
    align-self: flex-start;
    flex-direction: column;
    gap: 0.25rem;
  }

  .message.assistant.assistant-inline-yellow {
    display: block;
    width: 100%;
    max-width: 100%;
  }

  .dialogue-inline-yellow.px-dialogue-inline {
    color: #facc15;
    font-weight: 600;
    line-height: 1.75;
    text-shadow: 0 0 14px rgba(250, 204, 21, 0.14);
  }

  .dialogue-inline-yellow__speaker {
    color: #fde68a;
    font-weight: 800;
  }

  .dialogue-inline-yellow__separator {
    display: inline-block;
    margin: 0 0.35rem;
    color: #facc15;
  }

  .dialogue-inline-yellow :global(.message.px-dialogue-inline__content) {
    display: inline;
    width: auto;
    max-width: none;
    margin: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    line-height: inherit;
    word-break: break-word;
  }

  .dialogue-inline-yellow :global(.message.px-dialogue-inline__content p) {
    display: inline;
    margin: 0;
  }

  .dialogue-inline-yellow
    :global(.message.px-dialogue-inline__content p + p)::before {
    content: " ";
  }

  .user-interaction {
    position: relative;
    z-index: 1;
    background: linear-gradient(
      135deg,
      rgba(var(--secondary-rgb), 0.4),
      rgba(var(--secondary-rgb), 0.1)
    );
    border: 1px solid rgba(var(--primary-rgb), 0.2);
    border-radius: 12px;
    padding: 0.8rem 1.2rem;
    margin: 0.75rem auto;
    font-size: 0.85em;
    color: var(--muted-foreground);
  }

  .image-block img {
    max-width: min(100%, 720px);
    border-radius: 18px;
    display: block;
  }

  .code-block {
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 14px;
  }

  .ending-card {
    width: 100%;
    max-width: 100%;
    margin: 0.25rem 0 0.5rem;
    padding: 1rem 1.1rem;
    border-radius: 16px;
    border: 1px solid rgba(250, 204, 21, 0.4);
    background:
      linear-gradient(180deg, rgba(250, 204, 21, 0.12), rgba(250, 204, 21, 0.04)),
      rgba(17, 24, 39, 0.92);
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.22);
  }

  .ending-card__eyebrow {
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #fde68a;
    margin-bottom: 0.35rem;
  }

  .ending-card__title {
    font-size: 1.05rem;
    font-weight: 800;
    color: #fff7cc;
  }

  .ending-card__description {
    margin: 0.65rem 0 0;
    font-size: 0.9rem;
    line-height: 1.65;
    color: rgba(255, 251, 235, 0.88);
  }

  .language-tag {
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 8px;
  }

  .ratio-group {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .ratio-btn,
  .ratio-cancel-btn {
    background-color: var(--secondary);
    color: var(--secondary-foreground);
    border: 1px solid var(--border);
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    cursor: pointer;
  }

  .ratio-cancel-btn {
    color: var(--destructive);
    border-color: var(--destructive);
  }

  .generating-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--muted-foreground);
  }

  .spinner-sm {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .typing-placeholder {
    align-self: flex-start;
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 56px;
    min-height: 38px;
    padding: 0.55rem 0.9rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: color-mix(in oklab, var(--secondary) 84%, transparent);
    backdrop-filter: blur(10px);
    margin-left: 0.25rem;
    margin-top: 0.35rem;
    margin-bottom: 1.25rem;
  }

  .typing-dots {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    color: var(--muted-foreground);
  }

  .typing-dots span {
    width: 0.38rem;
    height: 0.38rem;
    border-radius: 999px;
    background: currentColor;
    opacity: 0.28;
    animation: typing-dot-pulse 1.05s infinite ease-in-out;
  }

  .typing-dots span:nth-child(2) {
    animation-delay: 0.14s;
  }

  .typing-dots span:nth-child(3) {
    animation-delay: 0.28s;
  }

  @keyframes typing-dot-pulse {
    0%,
    80%,
    100% {
      opacity: 0.24;
      transform: translateY(0);
    }
    40% {
      opacity: 0.92;
      transform: translateY(-1px);
    }
  }

  .jump-to-bottom-btn {
    position: fixed;
    left: 50%;
    bottom: calc(
      var(--px-chat-jump-to-bottom-base-offset) +
        env(safe-area-inset-bottom, 0px) +
        var(--px-chat-input-bottom-gap)
    );
    transform: translateX(-50%);
    z-index: 40;
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    aspect-ratio: 1 / 1;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 999px;
    background: rgba(0, 0, 0, 1);
    color: rgba(255, 255, 255, 0.94);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 10px 30px rgba(0, 0, 0, 0.28),
      0 2px 8px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
    cursor: pointer;
  }
</style>

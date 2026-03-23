<script lang="ts">
  import "$lib/styles/custom-markdown.css";
  import { onMount, tick } from "svelte";
  import { get } from "svelte/store";
  import { t } from "svelte-i18n";
  import Icon from "@iconify/svelte";
  import type { Persona, ImageMetadata } from "$lib/types";
  import { messages, type Message } from "$lib/stores/messages";
  import { st_user } from "$lib/stores/user";
  import { chatSessions } from "$lib/stores/chatSessions";
  import { interactiveChat } from "$lib/actions/interactiveChat";
  import { api } from "$lib/api";
  import { toastError } from "$lib/utils/errorMapper";
  import ChatRenderer from "./ChatRenderer.svelte";
  import ChatImage from "./ChatImage.svelte";
  import VariableStatusPanel from "./VariableStatusPanel.svelte";
  import AstroChartInline from "./AstroChartInline.svelte";
  import SajuChartInline from "./SajuChartInline.svelte";
  import { parseChat2DMessages } from "$lib/chat2d/parser";
  import {
    assembleRenderableAssistantContent,
    patchUnclosedDialogueForParse,
    skipInteractiveHtmlTyping,
  } from "$lib/chat2d/stream-assembler";
  import { Chat2DScrollController } from "$lib/chat2d/scroll-controller";
  import type { Chat2DBlock } from "$lib/chat2d/types";

  export let isLoading: boolean = false;
  export let showChat: boolean = true;
  export let persona: Persona | null = null;
  export let showImage: boolean = true;
  export let autoScroll: boolean = true;
  export let showBackground: boolean = false;
  export let showVariableStatus: boolean = false;
  export let showRatioOptions = false;
  export let SendMessage: (msg: string) => void = () => {};
  export let typingCharsPerSecond: number | null = null;

  let chatWindowEl: HTMLElement;
  let scrollController: Chat2DScrollController | null = null;

  let visibleMessages: Message[] = [];
  let chatBlocks: Chat2DBlock[] = [];
  let pendingInteractiveRender = false;
  let activeBackgroundImage: string | null = null;
  let backgroundMeta: ImageMetadata = { url: "", description: "" };
  let sharedChatStyleCSS = "";

  let isGeneratingImage = false;
  let throttleFrame = 0;
  let currentThrottleIndex = -1;
  let currentThrottleKey = "";
  let currentThrottleCharIndex = 0;
  let typingDone = true;
  let rebuildFrame = 0;
  let lastAssembleInput = "";
  let lastAssembleResult = { content: "", hasPendingStyle: false };
  let loadedImageUrls: Record<string, true> = {};
  let lastAutoScrollMessageCount = 0;
  let lastAutoScrollTailSignature = "";
  let showJumpToBottom = false;

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

  function getTypingSpeed(content: string): number {
    if (typingCharsPerSecond && typingCharsPerSecond > 0) {
      return typingCharsPerSecond;
    }
    const hangulCount = content.match(/[가-힣]/g)?.length ?? 0;
    const alphaCount = content.match(/[A-Za-z]/g)?.length ?? 0;
    return hangulCount >= alphaCount ? 58 : 74;
  }

  function cancelThrottle() {
    if (throttleFrame) {
      cancelAnimationFrame(throttleFrame);
      throttleFrame = 0;
    }
  }

  function getCommonPrefixLength(a: string, b: string): number {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
    return i;
  }

  function syncVisibleMessages(source: Message[]) {
    if (source.length === 0) {
      visibleMessages = [];
      pendingInteractiveRender = false;
      typingDone = true;
      currentThrottleIndex = -1;
      currentThrottleKey = "";
      currentThrottleCharIndex = 0;
      cancelThrottle();
      return;
    }

    const clones = source.map((msg) => ({ ...msg }));
    const lastIndex = clones.length - 1;
    const last = clones[lastIndex];

    if (last?.role !== "assistant") {
      visibleMessages = clones;
      pendingInteractiveRender = false;
      typingDone = true;
      currentThrottleIndex = -1;
      currentThrottleKey = "";
      currentThrottleCharIndex = 0;
      cancelThrottle();
      return;
    }

    const assembled = cachedAssemble(last.content);
    pendingInteractiveRender = assembled.hasPendingStyle && last.done !== true;
    const previousVisible = visibleMessages[lastIndex]?.content ?? "";
    const sameMessage =
      currentThrottleIndex === lastIndex &&
      currentThrottleKey !== "" &&
      currentThrottleKey === (last.key || "");

    if (last.done === true) {
      const nextContent = sameMessage
        ? previousVisible || assembled.content
        : assembled.content;
      clones[lastIndex] = { ...last, content: nextContent };
      visibleMessages = clones;

      if (nextContent.length < assembled.content.length) {
        typingDone = false;
        currentThrottleIndex = lastIndex;
        currentThrottleKey = last.key || "";
        currentThrottleCharIndex = getCommonPrefixLength(
          assembled.content,
          nextContent,
        );
        startThrottleLoop();
      } else {
        typingDone = true;
        currentThrottleIndex = -1;
        currentThrottleKey = "";
        currentThrottleCharIndex = 0;
        cancelThrottle();
      }
      return;
    }

    const seedContent = sameMessage
      ? previousVisible
      : previousVisible && assembled.content.startsWith(previousVisible)
        ? previousVisible
        : assembled.content.slice(0, Math.min(1, assembled.content.length));

    clones[lastIndex] = { ...last, content: seedContent };
    visibleMessages = clones;
    typingDone = false;
    currentThrottleIndex = lastIndex;
    currentThrottleKey = last.key || "";
    currentThrottleCharIndex = Math.max(
      getCommonPrefixLength(assembled.content, seedContent),
      seedContent.length,
    );
    startThrottleLoop();
  }

  function updateVisibleState(sourceMessages: Message[]) {
    syncVisibleMessages(sourceMessages);
  }

  function rebuildChatBlocks(
    sourceVisibleMessages: Message[],
    currentPersona: Persona | null,
    variableStatusVisible: boolean,
  ) {
    chatBlocks = parseChat2DMessages(
      sourceVisibleMessages,
      {
        persona: currentPersona,
        userName: getEffectiveUserName(),
      },
      {
        showVariableStatus: variableStatusVisible,
        revealVariableStatus: typingDone,
      },
    );
    updateBackground();
  }

  // Coalesce rebuilds to the next animation frame so dialogue can still appear
  // character-by-character without the old 80ms chunking effect.
  function scheduleRebuild() {
    if (rebuildFrame) return;
    rebuildFrame = window.requestAnimationFrame(() => {
      rebuildFrame = 0;
      rebuildChatBlocks(visibleMessages, persona, showVariableStatus);
    });
  }

  function cachedAssemble(content: string) {
    if (content === lastAssembleInput) return lastAssembleResult;
    lastAssembleInput = content;
    lastAssembleResult = assembleRenderableAssistantContent(content);
    return lastAssembleResult;
  }

  function startThrottleLoop() {
    if (throttleFrame) return;

    let lastTime: number | null = null;

    const loop = (timestamp: number) => {
      if (currentThrottleIndex < 0) {
        cancelThrottle();
        return;
      }

      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      lastTime = timestamp;

      const source = get(messages);
      if (currentThrottleIndex >= source.length) {
        cancelThrottle();
        return;
      }

      const sourceMessage = source[currentThrottleIndex];
      if (sourceMessage?.role !== "assistant") {
        typingDone = true;
        currentThrottleIndex = -1;
        currentThrottleKey = "";
        cancelThrottle();
        return;
      }

      const assembled = cachedAssemble(sourceMessage.content);
      pendingInteractiveRender =
        assembled.hasPendingStyle && sourceMessage.done !== true;
      const targetContent = assembled.content;
      const currentContent =
        visibleMessages[currentThrottleIndex]?.content ?? "";

      if (currentContent.length >= targetContent.length) {
        visibleMessages[currentThrottleIndex] = {
          ...visibleMessages[currentThrottleIndex],
          content: targetContent,
          done: sourceMessage.done,
        };
        visibleMessages = visibleMessages;
        scheduleRebuild();

        if (sourceMessage.done === true) {
          typingDone = true;
          currentThrottleIndex = -1;
          currentThrottleKey = "";
          currentThrottleCharIndex = 0;
          cancelThrottle();
          return;
        }
      } else {
        currentThrottleCharIndex +=
          (getTypingSpeed(targetContent) * deltaTime) / 1000;
        let nextLength = Math.min(
          targetContent.length,
          Math.max(Math.floor(currentThrottleCharIndex), currentContent.length),
        );
        nextLength = skipMarkdownImageTyping(
          targetContent,
          currentContent.length,
          nextLength,
        );
        nextLength = skipInteractiveHtmlTyping(
          targetContent,
          currentContent.length,
          nextLength,
        );

        visibleMessages[currentThrottleIndex] = {
          ...visibleMessages[currentThrottleIndex],
          content: patchUnclosedDialogueForParse(
            targetContent.slice(0, nextLength),
          ),
          done: false,
        };
        visibleMessages = visibleMessages;
        scheduleRebuild();
      }

      if (scrollController?.canAutoFollow()) {
        scrollController.scrollToBottom();
      }
      syncJumpToBottomButton();

      throttleFrame = requestAnimationFrame(loop);
    };

    throttleFrame = requestAnimationFrame(loop);
  }

  function handleImageLoad() {
    if (!autoScroll || !scrollController?.canAutoFollow()) return;
    tick().then(() => {
      scrollController?.scrollToBottom();
      syncJumpToBottomButton();
    });
  }

  function handleMarkdownImageLoad(url: string) {
    loadedImageUrls = { ...loadedImageUrls, [url]: true };
    handleImageLoad();
  }

  function handleVariablePanelRendered() {
    if (!autoScroll) return;
    tick().then(() => scrollController?.scrollToBottom(true));
  }

  function syncJumpToBottomButton() {
    if (!autoScroll || !scrollController) {
      showJumpToBottom = false;
      return;
    }

    showJumpToBottom =
      !scrollController.canAutoFollow() && !scrollController.isNearBottom();
  }

  function jumpToBottomAndResume() {
    if (!scrollController) return;
    scrollController.resumeAutoFollow();
    showJumpToBottom = false;
    tick().then(() => scrollController?.scrollToBottom(true));
  }

  function skipMarkdownImageTyping(
    content: string,
    currentLength: number,
    nextLength: number,
  ) {
    const markdownImageRegex = /!\[[^\]]*?\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;

    while ((match = markdownImageRegex.exec(content)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (currentLength <= start && nextLength >= start) {
        return end;
      }
      if (start < nextLength && nextLength < end) {
        return end;
      }
    }

    return nextLength;
  }

  function shouldShowAssistantLoadingBubble() {
    if (!isLoading) return false;
    const last = visibleMessages[visibleMessages.length - 1];
    if (last?.role !== "assistant") return true;
    return (last.content || "").trim().length === 0;
  }

  $: sharedChatStyleCSS = normalizeSharedChatStyleCSS(
    persona?.chat_style_css,
  );

  function updateBackground() {
    if (!showBackground) {
      activeBackgroundImage = null;
      backgroundMeta = { url: "", description: "" };
      return;
    }

    const lastImage = [...chatBlocks]
      .reverse()
      .find((item) => item.type === "image" || item.type === "markdown_image");

    if (!lastImage) {
      activeBackgroundImage = null;
      backgroundMeta = { url: "", description: "" };
      return;
    }

    if (lastImage.type === "image") {
      activeBackgroundImage =
        lastImage.metadata.static_url || lastImage.url || null;
      backgroundMeta = lastImage.metadata;
      return;
    }

    activeBackgroundImage = lastImage.url;
    backgroundMeta = {
      url: lastImage.url,
      description: lastImage.alt,
      type: "image",
    };
  }

  function getBackgroundImageStyle(url: string | null) {
    if (!url) return "none";
    return `url("${url.replace(/"/g, '\\"')}")`;
  }

  function hasVideoBackground(meta: ImageMetadata) {
    return meta.type === "video" && !!meta.url;
  }

  $: updateVisibleState($messages);
  // Rebuild on persona/settings change (rare) — visibleMessages rebuilds are throttled via scheduleRebuild()
  $: if (persona || showVariableStatus !== undefined) {
    rebuildChatBlocks(visibleMessages, persona, showVariableStatus);
  }
  $: updateBackground();

  $: if (chatWindowEl && autoScroll) {
    const source = $messages;
    const last = source[source.length - 1];
    if (source.length !== lastAutoScrollMessageCount) {
      lastAutoScrollMessageCount = source.length;
      tick().then(() => {
        if (!scrollController) return;
        if (last?.role === "user" || scrollController.canAutoFollow()) {
          scrollController.scrollToBottom(true);
        }
        syncJumpToBottomButton();
      });
    }
  }

  $: if (showRatioOptions) {
    tick().then(() => {
      scrollController?.scrollToBottom();
    });
  }

  $: if (chatWindowEl && autoScroll && typingDone) {
    const lastBlock = chatBlocks[chatBlocks.length - 1];
    const tailSignature = lastBlock
      ? `${chatBlocks.length}:${lastBlock.id}:${lastBlock.type}`
      : "";

    if (tailSignature !== lastAutoScrollTailSignature) {
      lastAutoScrollTailSignature = tailSignature;
      if (lastBlock?.type === "vars_status") {
        tick().then(() => scrollController?.scrollToBottom(true));
      }
    }
  }

  onMount(() => {
    scrollController = new Chat2DScrollController(chatWindowEl);

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

    chatWindowEl.addEventListener("wheel", handleWheel, { passive: true });
    chatWindowEl.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    chatWindowEl.addEventListener("scroll", handleScroll, { passive: true });

    tick().then(() => {
      scrollController?.scrollToBottom(true);
      syncJumpToBottomButton();
    });

    return () => {
      cancelThrottle();
      if (rebuildFrame) {
        cancelAnimationFrame(rebuildFrame);
        rebuildFrame = 0;
      }
      chatWindowEl?.removeEventListener("wheel", handleWheel);
      chatWindowEl?.removeEventListener("touchstart", handleTouchStart);
      chatWindowEl?.removeEventListener("scroll", handleScroll);
    };
  });

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
</script>

<div
  class="chat-window"
  class:background-mode={!!activeBackgroundImage}
  bind:this={chatWindowEl}
  style:opacity={showChat ? "0.9" : "0"}
  style:visibility={showChat ? "visible" : "hidden"}
  style:pointer-events={showChat ? "auto" : "none"}
  style:--chat-background-image={getBackgroundImageStyle(activeBackgroundImage)}
  role="log"
  aria-label={$t("chatWindow.messages")}
  use:interactiveChat={{
    callback: (payload) => SendMessage(payload),
    resetKey:
      visibleMessages.length === 1 &&
      visibleMessages[0]?.role === "assistant" &&
      visibleMessages[0]?.content === "<first_scene>"
        ? visibleMessages[0]?.key || "first-scene"
        : persona?.id || "chat-window-2d",
  }}
>
  {#if sharedChatStyleCSS}
    <svelte:element this={"style"}>{sharedChatStyleCSS}</svelte:element>
  {/if}

  {#if showBackground && hasVideoBackground(backgroundMeta)}
    <div class="chat-background-video-layer" aria-hidden="true">
      <video
        class="chat-background-video"
        src={backgroundMeta.url}
        poster={backgroundMeta.static_url || activeBackgroundImage || undefined}
        autoplay
        muted
        loop
        playsinline
      ></video>
    </div>
  {/if}

  {#if chatBlocks.length === 0}
    <div class="empty-message" role="status">
      {$t("chatWindow.noConversation", {
        values: { name: persona?.name || "AI" },
      })}
    </div>
  {/if}

  {#each chatBlocks as item, i (item.id)}
    {#if item.type === "user"}
      <div class="message user">{item.content}</div>
    {:else if item.type === "user-interaction"}
      <div class="user-interaction">{item.content}</div>
    {:else if item.type === "narration"}
      <ChatRenderer content={item.content} wrapperClass="px-narration" />
    {:else if item.type === "dialogue"}
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
          on:load={() => handleMarkdownImageLoad(item.url)}
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

  {#if shouldShowAssistantLoadingBubble()}
    <div class="typing-placeholder" role="status" aria-live="polite">
      <div class="typing-dots" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
    </div>
  {/if}

  {#if pendingInteractiveRender}
    <div
      class="interactive-render-placeholder"
      role="status"
      aria-live="polite"
    >
      <div class="interactive-render-dots" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <span>{$t("chatWindow.interactiveRenderPending")}</span>
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
    padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
    overflow-x: hidden;
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
    transform: translateZ(0);
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
    object-position: center center;
    display: block;
    opacity: 0.42;
  }

  .message,
  .image-block,
  .situation-trigger-wrapper,
  .code-block,
  .empty-message {
    position: relative;
    z-index: 1;
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

  .speaker-name {
    font-size: 0.9em;
    font-weight: bold;
    color: var(--secondary-foreground);
    margin-left: 0.5rem;
  }

  .dialogue-bubble {
    background-color: var(--secondary);
    color: var(--secondary-foreground);
    border: 1px solid var(--border);
    padding: 0.75rem 1rem;
    border-radius: 16px;
  }

  .user-interaction {
    position: relative;
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
    text-align: center;
    max-width: fit-content;
  }

  .image-block {
    align-self: center;
    width: 100%;
    max-width: 90%;
    margin: 0.5rem 0;
  }

  .situation-image img {
    width: 100%;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .interactive-render-placeholder {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.75rem 1rem;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: color-mix(in oklab, var(--secondary) 88%, transparent);
    color: var(--muted-foreground);
    position: relative;
    z-index: 1;
    font-size: 0.92rem;
  }

  .interactive-render-dots {
    display: inline-flex;
    align-items: center;
    gap: 0.22rem;
  }

  .interactive-render-dots span {
    width: 0.42rem;
    height: 0.42rem;
    border-radius: 999px;
    background: currentColor;
    opacity: 0.3;
    animation: interactive-render-pulse 1.1s infinite ease-in-out;
  }

  .interactive-render-dots span:nth-child(2) {
    animation-delay: 0.15s;
  }

  .interactive-render-dots span:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes interactive-render-pulse {
    0%,
    80%,
    100% {
      opacity: 0.25;
      transform: translateY(0);
    }
    40% {
      opacity: 0.9;
      transform: translateY(-1px);
    }
  }

  .code-block {
    align-self: center;
    width: 100%;
    max-width: 90%;
    background-color: var(--secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin: 0.5rem 0;
    position: relative;
    font-size: 0.9em;
  }

  .code-block .language-tag {
    position: absolute;
    top: -0.75rem;
    right: 1rem;
    background-color: var(--muted);
    color: var(--muted-foreground);
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    font-size: 0.8em;
    font-weight: bold;
  }

  .code-block pre {
    margin: 0;
    padding: 1rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .vars-status-inline,
  .astro-chart-wrapper,
  .situation-trigger-wrapper {
    position: relative;
    z-index: 1;
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
    align-self: center;
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

  .jump-to-bottom-btn {
    position: sticky;
    bottom: calc(20px + env(safe-area-inset-bottom, 0px));
    align-self: center;
    flex: 0 0 auto;
    flex-shrink: 0;
    z-index: 12;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    aspect-ratio: 1 / 1;
    padding: 0;
    line-height: 1;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: radial-gradient(
        circle at 32% 28%,
        rgba(255, 255, 255, 0.12),
        transparent 52%
      ),
      rgba(42, 42, 46, 0.97);
    color: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(18px);
    box-shadow:
      0 14px 36px rgba(0, 0, 0, 0.34),
      0 4px 14px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      inset 0 -10px 18px rgba(0, 0, 0, 0.12);
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

  .empty-message {
    align-self: center;
    color: var(--muted-foreground);
    font-style: italic;
  }
</style>

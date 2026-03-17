<script lang="ts">
  import "$lib/styles/custom-markdown.css";
  import { get, writable } from "svelte/store";
  import { onDestroy, onMount, tick } from "svelte";
  import type { Persona, ImageMetadata } from "$lib/types";
  import { messages, type Message } from "$lib/stores/messages";
  import { st_user } from "$lib/stores/user";
  import { chatSessions } from "$lib/stores/chatSessions";
  import { interactiveChat } from "$lib/actions/interactiveChat";
  import ChatRenderer from "./ChatRenderer.svelte";
  import ChatImage from "./ChatImage.svelte";
  import VariableStatusPanel from "./VariableStatusPanel.svelte";
  import AstroChartInline from "./AstroChartInline.svelte";
  import SajuChartInline from "./SajuChartInline.svelte";
  import { parseChat2DMessages } from "$lib/chat2d/parser";
  import { assembleRenderableAssistantContent } from "$lib/chat2d/stream-assembler";
  import type { Chat2DBlock } from "$lib/chat2d/types";
  import {
    createRenderBlockPlayer,
    type RenderBlockPlayer,
    type TestRenderableBlock,
  } from "$lib/test-chat2d/blockPlayers";

  export let isLoading = false;
  export let persona: Persona | null = null;
  export let showImage = true;
  export let autoScroll = true;
  export let showBackground = false;
  export let showVariableStatus = false;
  export let SendMessage: (msg: string) => void = () => {};
  export let typingCharsPerSecond = 60;

  let chatWindowEl: HTMLElement;
  let players: RenderBlockPlayer[] = [];
  let renderBlocks = writable<TestRenderableBlock[]>([]);
  let activeBackgroundImage: string | null = null;
  let backgroundMeta: ImageMetadata = { url: "", description: "" };
  let sharedChatStyleCSS = "";
  let lastFrame = 0;
  let rafId = 0;
  const streamedAssistantKeys = new Set<string>();

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

  function buildParsedBlocks(sourceMessages: Message[]) {
    sourceMessages.forEach((msg) => {
      if (msg.role === "assistant" && msg.key && msg.done === false) {
        streamedAssistantKeys.add(msg.key);
      }
    });

    const normalizedMessages = sourceMessages.map((msg) => {
      if (msg.role !== "assistant") return msg;
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
        const messageId = msg.key ? `msg-${msg.key}` : `msg-${index}`;
        return block.id.startsWith(messageId);
      });

      const sealed = trailingPendingId ? block.id !== trailingPendingId : true;
      const shouldPrecomplete =
        ownerMessage?.role !== "assistant" ||
        (ownerMessage?.done === true &&
          !streamedAssistantKeys.has(ownerMessage.key || ""));

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

  function updateBackground() {
    if (!showBackground) {
      activeBackgroundImage = null;
      backgroundMeta = { url: "", description: "" };
      return;
    }

    const lastImage = [...get(renderBlocks)]
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

  function tickPlayers(timestamp: number) {
    const deltaMs = lastFrame ? timestamp - lastFrame : 0;
    lastFrame = timestamp;

    let changed = false;
    const activePlayer = players.find(
      (player) => player.started && !player.completed,
    );
    if (activePlayer) {
      changed = activePlayer.tick(deltaMs, typingCharsPerSecond) || changed;
      if (activePlayer.completed) {
        startEligiblePlayers();
        changed = true;
      }
    }

    if (changed) {
      publishBlocks();
      updateBackground();
      if (autoScroll) {
        tick().then(() => {
          chatWindowEl?.scrollTo({
            top: chatWindowEl.scrollHeight,
            behavior: "auto",
          });
        });
      }
    }

    rafId = requestAnimationFrame(tickPlayers);
  }

  function getBackgroundImageStyle(url: string | null) {
    if (!url) return "none";
    return `url("${url.replace(/"/g, '\\"')}")`;
  }

  function hasVideoBackground(meta: ImageMetadata) {
    return meta.type === "video" && !!meta.url;
  }

  function handleVariablePanelRendered() {
    if (!autoScroll) return;
    tick().then(() =>
      chatWindowEl?.scrollTo({
        top: chatWindowEl.scrollHeight,
        behavior: "auto",
      }),
    );
  }

  function handleImageLoad() {
    if (!autoScroll) return;
    tick().then(() =>
      chatWindowEl?.scrollTo({
        top: chatWindowEl.scrollHeight,
        behavior: "auto",
      }),
    );
  }

  $: sharedChatStyleCSS = normalizeSharedChatStyleCSS(persona?.chat_style_css);
  $: syncPlayers(buildParsedBlocks($messages));

  onMount(() => {
    rafId = requestAnimationFrame(tickPlayers);
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

<div
  class="chat-window"
  class:background-mode={!!activeBackgroundImage}
  bind:this={chatWindowEl}
  style:--chat-background-image={getBackgroundImageStyle(activeBackgroundImage)}
  use:interactiveChat={{
    callback: (payload) => SendMessage(payload),
    resetKey: persona?.id || "chat-window-2d-test",
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

  {#each $renderBlocks as item (item.id)}
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
    {:else if item.type === "astro_chart"}
      <div class="astro-chart-wrapper">
        <AstroChartInline input={item.input as any} blockId={item.id} />
      </div>
    {:else if item.type === "saju_chart"}
      <div class="saju-chart-wrapper">
        <SajuChartInline input={item.input as any} />
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

  {#if isLoading}
    <div class="typing-placeholder" role="status" aria-live="polite">
      <div class="typing-dots" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
    </div>
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
    opacity: 0.42;
  }

  .message,
  .image-block,
  .code-block {
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

  .language-tag {
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 8px;
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
</style>

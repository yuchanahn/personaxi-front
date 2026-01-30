<script lang="ts">
  import "$lib/styles/custom-markdown.css";
  import { onMount, tick } from "svelte";
  import { messages } from "$lib/stores/messages";
  import { t } from "svelte-i18n";
  import type { ImageMetadata, Persona } from "$lib/types";
  import AssetPreview from "../AssetPreview.svelte";
  import ChatImage from "./ChatImage.svelte";
  import { get } from "svelte/store";
  import { st_user } from "$lib/stores/user";
  import ChatRenderer from "./ChatRenderer.svelte";
  import { interactiveChat } from "$lib/actions/interactiveChat";
  import { type Message } from "$lib/stores/messages";
  import { toast } from "$lib/stores/toast";
  import { api } from "$lib/api";

  export let isLoading: boolean = false;
  export let showChat: boolean = true;
  export let persona: Persona | null = null;
  export let showImage: boolean = true;
  export let autoScroll: boolean = true;

  export let SendMessage: (msg: string) => void = (msg: string) => {
    console.log("SendMessage not implemented:", msg);
  };

  let chatWindowEl: HTMLElement;

  interface NarrationBlock {
    type: "narration";
    content: string;
    id: string;
  }
  interface DialogueBlock {
    type: "dialogue";
    speaker: string;
    content: string;
    id: string;
  }
  interface UserBlock {
    type: "user";
    content: string;
    id: string;
  }
  interface ImageBlock {
    type: "image";
    url: string;
    alt: string;
    id: string;
    metadata: ImageMetadata;
    index: number;
  }
  interface CodeBlock {
    type: "code";
    content: string;
    language: string;
    id: string;
  }
  interface InputPromptBlock {
    type: "input_prompt";
    id: string;
    prompt_type: string;
    question: string;
    variable: string;
    max: number | null;
  }

  interface SituationTriggerBlock {
    type: "situation_trigger";
    id: string;
  }

  interface MarkdownImageBlock {
    type: "markdown_image";
    url: string;
    alt: string;
    id: string;
  }

  type ChatLogItem =
    | NarrationBlock
    | DialogueBlock
    | UserBlock
    | ImageBlock
    | CodeBlock
    | InputPromptBlock
    | SituationTriggerBlock
    | MarkdownImageBlock;

  function parseAssistantContent(
    content: string,
    baseId: string,
    currentPersona: Persona | null,
  ): ChatLogItem[] {
    const FIRST_SCENE_TAG_REGEX = /<first_scene>/g;
    const CODE_BLOCK_REGEX = /```(?<lang>\w*)\s*\n?(?<code>[\s\S]+?)\s*```/;

    const ALL_TAGS_REGEX =
      /<(dialogue) speaker="([^"]+)">([\s\S]*?)<\/dialogue>|<(img) (\d+)>|<(Action) type="([^"]+)" question="([^"]+)" variable="([^"]+)"(?: max="(\d+)")? \/>|!\[(.*?)\]\((.*?)\)/g;

    const blocks: ChatLogItem[] = [];
    let partIndex = 0;

    const processedContent = content
      .replace(FIRST_SCENE_TAG_REGEX, () => {
        if (currentPersona?.first_scene) {
          let first_scene = currentPersona.first_scene;
          first_scene = first_scene.replaceAll(
            "{{user}}",
            get(st_user)?.data?.nickname || "User",
          );
          first_scene = first_scene.replaceAll(
            "{{char}}",
            currentPersona.name || "Character",
          );
          return first_scene;
        }
        return "";
      })
      .trim();

    const parts = processedContent.split(CODE_BLOCK_REGEX);

    parts.forEach((part, i) => {
      if (!part) return;

      const isCodeBlock = i % 3 === 2;

      if (isCodeBlock) {
        const lang = parts[i - 1] || "";
        blocks.push({
          type: "code",
          language: lang,
          content: part,
          id: `${baseId}-code-${partIndex++}`,
        });
      } else if (part.trim()) {
        const textPart = part.trim();
        const partId = `${baseId}-part-${partIndex}`;
        let subPartIndex = 0;
        let lastIndex = 0;
        let match;

        while ((match = ALL_TAGS_REGEX.exec(textPart)) !== null) {
          const narrationContent = textPart
            .substring(lastIndex, match.index)
            .trim();
          if (narrationContent) {
            blocks.push({
              type: "narration",
              content: narrationContent,
              id: `${partId}-n-${subPartIndex++}`,
            });
          }

          const [fullMatch] = match;

          if (fullMatch.startsWith("<dialogue")) {
            const m = fullMatch.match(
              /speaker="([^"]+)">([\s\S]*?)<\/dialogue>/,
            );
            if (m) {
              let parsedSpeaker = m[1]
                .replaceAll("{{char}}", currentPersona?.name || "Character")
                .replaceAll("{{user}}", get(st_user)?.data?.nickname || "User");

              blocks.push({
                type: "dialogue",
                speaker: parsedSpeaker,
                content: m[2].trim(),
                id: `${partId}-d-${subPartIndex++}`,
              });
            }
          } else if (fullMatch.startsWith("<img")) {
            const m = fullMatch.match(/<img (\d+)>/);
            if (m) {
              try {
                const imgIndex = parseInt(m[1], 10);
                const imageMetadata =
                  currentPersona?.image_metadatas?.[imgIndex];
                if (imageMetadata && !isNaN(imgIndex)) {
                  blocks.push({
                    type: "image",
                    url: imageMetadata.url || "",
                    alt: imageMetadata.description || "scene image",
                    metadata: imageMetadata,
                    id: `${partId}-img-${subPartIndex++}`,
                    index: imgIndex,
                  });
                }
              } catch (error) {
                console.error("Error parsing img tag:", error);
              }
            }
          } else if (fullMatch.startsWith("<Action")) {
            const m = fullMatch.match(
              /type="([^"]+)" question="([^"]+)" variable="([^"]+)"(?: max="(\d+)")?/,
            );
            if (m) {
              blocks.push({
                type: "input_prompt",
                id: `${partId}-action-${subPartIndex++}`,
                prompt_type: m[1],
                question: m[2],
                variable: m[3],
                max: m[4] ? parseInt(m[4], 10) : null,
              });
            }
          } else if (fullMatch.startsWith("![")) {
            const m = fullMatch.match(/!\[(.*?)\]\((.*?)\)/);
            if (m) {
              blocks.push({
                type: "markdown_image",
                alt: m[1],
                url: m[2],
                id: `${partId}-md-img-${subPartIndex++}`,
              });
            }
          }

          lastIndex = match.index + fullMatch.length;
        }

        const remainingNarration = textPart.substring(lastIndex).trim();
        if (remainingNarration) {
          blocks.push({
            type: "narration",
            content: remainingNarration,
            id: `${partId}-n-${subPartIndex++}`,
          });
        }

        partIndex++;
      }
    });

    return blocks;
  }

  let chatLog: ChatLogItem[] = [];

  export let showBackground: boolean = false;
  let activeBackgroundImage: string | null = null;
  let waitingForImage = false;
  // Map to store URLs of loaded images by index to support background mode even for lazy-loaded assets
  let loadedImageUrls: Record<number, string> = {};

  function handleImageLoad(index: number, url: string) {
    if (loadedImageUrls[index]) return;
    loadedImageUrls[index] = url;
    if (autoScroll) scrollToBottom();

    console.log("Image loaded:", index, url);

    if (waitingForImage) {
      waitingForImage = false;
      startThrottleLoop();
    }
  }

  function handleImageError(index: number) {
    console.warn("Image load error, resuming chat:", index);
    if (waitingForImage) {
      waitingForImage = false;
      startThrottleLoop();
    }
  }

  let meta: ImageMetadata = {
    url: "",
    description: "",
  };

  // --- Throttling Logic ---
  let visibleMessages: Message[] = [];
  let throttleFrame: number;
  let currentThrottleIndex = -1;
  let currentThrottleCharIndex = 0;

  // Sync visibleMessages with global messages
  $: updateVisibleMessages($messages);

  function updateBackground() {
    if (!showBackground) {
      activeBackgroundImage = null;
      return;
    }

    let foundImg: ImageBlock | MarkdownImageBlock | null = null;
    for (let i = chatLog.length - 1; i >= 0; i--) {
      const item = chatLog[i];
      if (item && (item.type === "image" || item.type === "markdown_image")) {
        foundImg = item as ImageBlock | MarkdownImageBlock;
        break;
      }
    }

    if (foundImg) {
      const newUrl = foundImg.url;
      const newDesc = foundImg.alt || "";
      const newType =
        foundImg.type === "markdown_image"
          ? "image"
          : (foundImg as ImageBlock).metadata?.type || "image";

      // Check for inequality to avoid redundant updates/renders
      if (
        meta.url !== newUrl ||
        meta.description !== newDesc ||
        meta.type !== newType
      ) {
        activeBackgroundImage = newUrl;
        meta = {
          url: newUrl,
          description: newDesc,
          type: newType,
        };
      }
    }
  }

  $: if (chatLog && showBackground) {
    updateBackground();
  } else if (!showBackground) {
    if (activeBackgroundImage) activeBackgroundImage = null;
  }

  function getCommonPrefixLength(s1: string, s2: string): number {
    let i = 0;
    while (i < s1.length && i < s2.length && s1[i] === s2[i]) i++;
    return i;
  }

  function updateVisibleMessages(globalMsgs: Message[]) {
    if (globalMsgs.length === 0) {
      visibleMessages = [];
      cancelThrottle();
      return;
    }

    if (globalMsgs.length < visibleMessages.length) {
      visibleMessages = globalMsgs;
      cancelThrottle();
      return;
    }

    if (visibleMessages.length === 0 && globalMsgs.length > 0) {
      visibleMessages = [...globalMsgs];
      tick().then(() => scrollToBottom());
      return;
    }

    if (globalMsgs.length > visibleMessages.length) {
      const newIndex = visibleMessages.length;
      const newMsg = globalMsgs[newIndex];

      cancelThrottle();

      if (newMsg.role === "user") {
        visibleMessages = [...globalMsgs];
        tick().then(() => scrollToBottom());
        return;
      }

      visibleMessages = [...visibleMessages, { ...newMsg, content: "" }];
      currentThrottleIndex = newIndex;
      currentThrottleCharIndex = 0;
      startThrottleLoop();
    } else if (globalMsgs.length === visibleMessages.length) {
      const idx = globalMsgs.length - 1;
      const gLast = globalMsgs[idx];
      const vLast = visibleMessages[idx];

      if (gLast.role === "assistant" && gLast.content !== vLast.content) {
        if (currentThrottleIndex !== idx) {
          currentThrottleIndex = idx;
          currentThrottleCharIndex = getCommonPrefixLength(
            gLast.content,
            vLast.content,
          );
          startThrottleLoop();
        } else {
          startThrottleLoop();
        }
      }
    }
  }

  function cancelThrottle() {
    if (throttleFrame) cancelAnimationFrame(throttleFrame);
    throttleFrame = 0;
  }

  export function patchUnclosedDialogueForParse(raw: string): string {
    const DIALOGUE_OPEN_COMPLETE_RE = /<dialogue\b[^>]*>/g;
    const DIALOGUE_CLOSE_RE = /<\/dialogue>/g;
    const DIALOGUE_OPEN_PARTIAL_AT_END_RE = /<dialogue\b[^>]*$/;
    const SPEAKER_ATTR_PARTIAL_RE = /speaker="[^"]*$/;

    let s = raw;

    if (DIALOGUE_OPEN_PARTIAL_AT_END_RE.test(s)) {
      if (SPEAKER_ATTR_PARTIAL_RE.test(s)) s += `"`;
      s += `>`;
    }

    const openCount = (s.match(DIALOGUE_OPEN_COMPLETE_RE) ?? []).length;
    const closeCount = (s.match(DIALOGUE_CLOSE_RE) ?? []).length;

    const missing = openCount - closeCount;
    if (missing > 0) {
      s += `</dialogue>`.repeat(missing);
    }

    return s;
  }

  function calculateBlockSkipIndex(
    content: string,
    startIndex: number,
  ): number {
    const sliceForCheck = content.slice(startIndex);

    // Markdown Image Skip: ![alt](src)
    if (sliceForCheck.startsWith("![")) {
      const match = sliceForCheck.match(/^!\[.*?\]\(.*?\)/);
      if (match) {
        return startIndex + match[0].length;
      }
    }

    if (!sliceForCheck.startsWith("<")) return -1;

    const match = sliceForCheck.match(/^<([a-z0-9-]+)/i);
    if (!match) return -1;

    const tagName = match[1].toLowerCase();
    const SKIP_TAGS = ["style"];

    if (!SKIP_TAGS.includes(tagName)) return -1;

    const isSelfClosing = ["img", "br", "hr", "input"].includes(tagName);

    if (isSelfClosing) {
      const closeIdx = content.indexOf(">", startIndex);
      return closeIdx !== -1 ? closeIdx + 1 : -1;
    } else {
      const closingTag = `</${tagName}>`;
      const closeIdx = content.indexOf(closingTag, startIndex);
      return closeIdx !== -1 ? closeIdx + closingTag.length : -1;
    }
  }

  function startThrottleLoop() {
    if (throttleFrame) return;
    if (waitingForImage) return; // Don't start if waiting

    let lastTime: number | null = null;
    const CHARS_PER_SECOND = 90;

    function loop(timestamp: number) {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      lastTime = timestamp;

      throttleFrame = requestAnimationFrame(loop);

      const globalMsgs = get(messages);
      if (
        currentThrottleIndex < 0 ||
        currentThrottleIndex >= globalMsgs.length
      ) {
        cancelThrottle();
        return;
      }

      const targetContent = globalMsgs[currentThrottleIndex].content;
      let currentContent = visibleMessages[currentThrottleIndex].content;

      if (currentContent.length < targetContent.length) {
        const charsToAdd = (CHARS_PER_SECOND * deltaTime) / 1000;
        currentThrottleCharIndex += charsToAdd;

        let nextLen = Math.floor(currentThrottleCharIndex);
        if (nextLen > targetContent.length) nextLen = targetContent.length;

        const jumpIdx = calculateBlockSkipIndex(targetContent, nextLen);
        if (jumpIdx !== -1) {
          // Check if we just skipped an image
          const skippedContent = targetContent.slice(nextLen, jumpIdx);

          // Check for Markdown Image
          const mdMatch = skippedContent.match(/^!\[.*?\]\((.*?)\)/);
          if (mdMatch) {
            const url = mdMatch[1];
            // Check if this specific URL is loaded
            const isLoaded = Object.values(loadedImageUrls).includes(url);
            if (!isLoaded) {
              waitingForImage = true;
              // Force update visibleMessages to show the image placeholder/loading state
              visibleMessages[currentThrottleIndex] = {
                ...visibleMessages[currentThrottleIndex],
                content: targetContent.slice(0, jumpIdx),
              };
              visibleMessages = [...visibleMessages];
              scrollToBottom();

              cancelThrottle(); // Stop the loop
              return;
            }
          }

          // Check for HTML Image Tag (<img index>)
          const imgMatch = skippedContent.match(/^<img (\d+)>/);
          if (imgMatch) {
            const index = parseInt(imgMatch[1], 10);
            if (!loadedImageUrls[index]) {
              waitingForImage = true;
              // Force update
              visibleMessages[currentThrottleIndex] = {
                ...visibleMessages[currentThrottleIndex],
                content: targetContent.slice(0, jumpIdx),
              };
              visibleMessages = [...visibleMessages];
              scrollToBottom();

              cancelThrottle();
              return;
            }
          }

          nextLen = jumpIdx;
          if (currentThrottleCharIndex < nextLen)
            currentThrottleCharIndex = nextLen;
        }

        const slice = targetContent.slice(0, nextLen);
        const lastOpen = slice.lastIndexOf("<");
        const lastClose = slice.lastIndexOf(">");

        if (lastOpen > lastClose) {
          nextLen = lastOpen;
        }

        let nextContent = targetContent.slice(0, nextLen);

        nextContent = patchUnclosedDialogueForParse(nextContent);

        if (nextContent !== currentContent) {
          visibleMessages[currentThrottleIndex] = {
            ...visibleMessages[currentThrottleIndex],
            content: nextContent,
          };
          visibleMessages = [...visibleMessages];
          scrollToBottom();
        }
      } else {
        if (Math.floor(currentThrottleCharIndex) >= targetContent.length) {
          cancelThrottle();
        }
      }
    }

    throttleFrame = requestAnimationFrame(loop);
  }

  let chatLogCache: Map<string, ChatLogItem[]> = new Map();

  $: {
    const newChatLog: ChatLogItem[] = [];

    visibleMessages.forEach((msg, i) => {
      const messageId = `msg-${i}`;
      const isLast = i === visibleMessages.length - 1;

      if (!isLast && chatLogCache.has(messageId + msg.content)) {
        newChatLog.push(...chatLogCache.get(messageId + msg.content)!);
      } else {
        let blocks: ChatLogItem[] = [];
        if (msg.role === "user") {
          const tagRegex = /<system-input>[\s\S]*?<\/system-input>/g;
          blocks = [
            {
              type: "user",
              content: msg.content.replace(tagRegex, "[상호작용]"),
              id: messageId,
            },
          ];
        } else {
          blocks = parseAssistantContent(msg.content, messageId, persona);

          const is2D =
            persona?.personaType === "2D" || persona?.personaType === "2.5D";
          if (
            is2D &&
            i === $messages.length - 1 &&
            !isLoading &&
            $messages.length > 1
          ) {
            blocks.push({
              type: "situation_trigger",
              id: `${messageId}-trigger`,
            });
          }
        }

        if (!isLast) {
          chatLogCache.set(messageId + msg.content, blocks);
        }
        newChatLog.push(...blocks);
      }
    });

    chatLog = newChatLog;
  }

  $: if ($messages && chatWindowEl) {
    tick().then(() => {
      const lastMsg = $messages[$messages.length - 1];
      if (lastMsg?.role === "user") {
        scrollToBottom();
      }
    });
  }

  $: if ($messages) {
    if ($messages.length > 0) {
      const lastMessage = $messages[$messages.length - 1];
      isLoading = lastMessage.role === "user";
    } else {
      isLoading = false;
    }
  }

  function scrollToBottom() {
    if (!chatWindowEl) return;
    if (!autoScroll) return;
    chatWindowEl.scrollTo({
      top: chatWindowEl.scrollHeight,
      behavior: "smooth",
    });
  }

  let isGeneratingImage = false;
  let showRatioOptions = false;

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
          toast.error("Not enough Neurons!");
        } else {
          const errData = await response.json();
          toast.error(errData.error || "Image generation failed");
        }
        return;
      }

      const data = await response.json();
      const imageUrl = data.imageUrl;

      const msgs = get(messages);
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.role === "assistant") {
          const imageMarkdown = `\n\n![Situation Image](${imageUrl})`;

          messages.update((current) => {
            const updated = [...current];
            updated[updated.length - 1].content += imageMarkdown;
            return updated;
          });
        }
      }
    } catch (e) {
      console.error("Failed to generate image", e);
      toast.error("Network error during generation");
    } finally {
      isGeneratingImage = false;
    }
  }
</script>

<div
  class="chat-window"
  bind:this={chatWindowEl}
  style:opacity={showChat ? "0.9" : "0"}
  style:visibility={showChat ? "visible" : "hidden"}
  style:pointer-events={showChat ? "auto" : "none"}
  role="log"
  aria-label="채팅 메시지"
  use:interactiveChat={(payload) => {
    SendMessage(payload);
  }}
>
  {#if activeBackgroundImage}
    <div class="chat-background-layer">
      <AssetPreview asset={meta} />
    </div>
  {/if}

  {#if chatLog.length === 0}
    <div class="empty-message" role="status">
      {$t("chatWindow.noConversation", {
        values: { name: persona?.name || "AI" },
      })}
    </div>
  {/if}

  {#each chatLog as item, i (item.id)}
    {#if item.type === "user"}
      <div class="message user">
        {item.content}
      </div>
    {:else if item.type === "narration"}
      <ChatRenderer content={item.content} />
    {:else if item.type === "dialogue"}
      <div class="message assistant">
        <div class="speaker-name">{item.speaker}</div>
        <div class="dialogue-bubble">
          <ChatRenderer content={item.content} isMessage={true} />
        </div>
      </div>
    {:else if item.type === "image" && showImage && !showBackground}
      <div class="image-block">
        <ChatImage
          {persona}
          metadata={item.metadata}
          index={item.index}
          on:load={(e) => {
            if (e.detail?.url) {
              handleImageLoad(i, e.detail.url);
            } else {
              if (autoScroll) scrollToBottom();
            }
          }}
          on:error={() => handleImageError(i)}
        />
      </div>
    {:else if item.type === "markdown_image" && showImage && !showBackground}
      <div class="image-block situation-image">
        <img
          src={item.url}
          alt={item.alt}
          loading="lazy"
          on:load={() => handleImageLoad(i, item.url)}
          on:error={() => handleImageError(i)}
        />
      </div>
    {:else if item.type === "situation_trigger"}
      <div class="situation-trigger-wrapper">
        {#if !showRatioOptions && !isGeneratingImage}
          <button
            class="situation-btn"
            on:click={() => (showRatioOptions = true)}
          >
            {$t("chatInput.generateSituationImage")}
            <span class="cost-badge">({$t("chatInput.cost")})</span>
          </button>
        {:else if showRatioOptions && !isGeneratingImage}
          <div class="ratio-group">
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button
              class="ratio-btn"
              on:click={() => generateSituationImage("16:9")}
              title="Landscape (16:9)"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="2" y="6" width="20" height="12" rx="2" />
              </svg>
            </button>
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button
              class="ratio-btn"
              on:click={() => generateSituationImage("1:1")}
              title="Square (1:1)"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </button>
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button
              class="ratio-btn"
              on:click={() => generateSituationImage("3:4")}
              title="Portrait (3:4)"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="5" y="2" width="14" height="20" rx="2" />
              </svg>
            </button>
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button
              class="ratio-cancel-btn"
              on:click={() => (showRatioOptions = false)}
              title="Cancel"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
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

  {#if isLoading}
    <div class="message assistant">
      <div class="speaker-name">{persona?.name}</div>
      <div class="dialogue-bubble">
        <div class="loading-dots">{persona?.name}가 메시지 작성중...</div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ... existing styles ... */
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
    white-space: pre-wrap; /* 줄 바꿈을 위해 pre-wrap 사용 */
    word-wrap: break-word; /* 긴 단어가 영역을 벗어나지 않도록 함 */
  }
  .code-block pre code {
    font-family: "Fira Code", "D2Coding", monospace;
    background: none;
    color: var(--secondary-foreground);
    padding: 0;
  }

  .chat-window {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
    position: relative;
    padding-top: 50px;
    scroll-behavior: smooth;
  }

  .chat-background-layer {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    background-size: contain;
    background-position: center center;
    background-repeat: no-repeat;
    z-index: 0;
    opacity: 0.4;
    pointer-events: none;
    transition: background-image 0.5s ease-in-out;
    background-color: rgba(0, 0, 0, 0.5);
  }

  /* Ensure messages are above background */
  .message,
  .image-block,
  .situation-trigger-wrapper,
  .code-block,
  .empty-message {
    position: relative;
    z-index: 1;
  }

  .image-block {
    align-self: center;
    width: 100%;
    max-width: 90%;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }

  @media (max-width: 768px) {
    .image-block {
      max-width: 100%;
      width: 100dvh;
    }
  }

  .situation-image img {
    width: 100%;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .situation-btn {
    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }

  .situation-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  }

  .situation-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .spinner-sm {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .message {
    display: flex;
    width: fit-content;
    max-width: 80%;
    line-height: 1.5;
    word-break: break-word;
    position: relative;
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

  :global(.custom-italic) {
    font-style: italic;
  }
  .loading-dots {
    animation: loading-dots 1s infinite;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
    animation-fill-mode: both;
  }
  @keyframes loading-dots {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }
  .empty-message {
    align-self: center;
    color: var(--muted-foreground);
    font-style: italic;
  }
  .assistant-placeholder {
    align-self: flex-start;
  }
  .chat-window::-webkit-scrollbar {
    width: 6px;
  }
  .chat-window::-webkit-scrollbar-track {
    background: transparent;
  }
  .chat-window::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
  .chat-window::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  :global(.game-choice) {
    display: inline-block;
    padding: 0.5rem 1rem;
    margin: 0.25rem;
    border: 1px solid var(--primary);
    color: var(--primary);
    background-color: var(--background);
    border-radius: 8px;
    text-align: center;
    cursor: pointer;
    font-weight: bold;
    font-style: normal;
    transition: all 0.2s;
    text-decoration: none;
  }
  :global(.game-choice:hover) {
    background-color: var(--primary);
    color: var(--primary-foreground);
    transform: translateY(-1px);
  }

  :global(.stat-window) {
    border: 1px solid var(--border);
    background-color: var(--secondary);
    padding: 1rem;
    border-radius: 8px;
    margin-top: 0.5rem;
    font-style: normal;
  }
  :global(.stat-row) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
  }
  .situation-trigger-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 0.5rem;
    width: 100%;
    gap: 0.5rem;
  }

  .ratio-group {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .ratio-btn {
    background-color: var(--secondary);
    color: var(--secondary-foreground);
    border: 1px solid var(--border);
    padding: 0.5rem;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .ratio-btn:hover {
    background-color: var(--primary);
    color: var(--primary-foreground);
    transform: scale(1.05);
  }

  .ratio-cancel-btn {
    background: transparent;
    border: 1px solid var(--destructive);
    color: var(--destructive);
    padding: 0.5rem;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ratio-cancel-btn:hover {
    background-color: rgba(255, 0, 0, 0.1);
  }

  .generating-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--muted-foreground);
  }
  .hidden-inline {
    display: none !important;
  }
</style>

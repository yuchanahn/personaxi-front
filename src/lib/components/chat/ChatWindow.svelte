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
  import HtmlRenderer from "./HtmlRenderer.svelte";
  import { interactiveChat } from "$lib/actions/interactiveChat";
  import { toast } from "$lib/stores/toast";
  import { api } from "$lib/api";
  import TypewriterHtml from "../common/TypewriterHtml.svelte";

  export let isLoading: boolean = false;
  export let cssid: string;
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
    const MARKDOWN_IMAGE_REGEX = /!\[(?<alt>.*?)\]\((?<url>.*?)\)/;

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

      const isCodeBlock = i % 3 === 2; // code는 두 번째 캡처 그룹입니다.

      if (isCodeBlock) {
        // 2. 코드 블록인 경우
        const lang = parts[i - 1] || ""; // lang은 첫 번째 캡처 그룹입니다.
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

          const [
            fullMatch,
            tagDia,
            speaker,
            diaContent, // dialogue 캡처 그룹
            tagImg,
            imgIndexStr, // img 캡처 그룹
            tagAct,
            actType,
            actQ,
            actVar,
            actMax, // Action 캡처 그룹
            mdAlt, // Markdown Image Alt (capture group 11) - wait, regex above has standard groups?
            // The consolidated regex structure needs careful index checks or use named groups if possible, but exec result array is easier to map if we know the order.
            // <dialogue>... groups: 2, 3
            // <img ...> groups: 4, 5
            // <Action ...> groups: 6, 7, 8, 9, 10
            // ![...]... groups: 11, 12
          ] = match;

          // Manual index check because the destructuring above might be off depending on browser/engine regex support for empty groups,
          // but `exec` returns `undefined` for non-participating groups.
          // Let's rely on checking the string parts or checking which group is defined.

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
            // ... existing action parsing logic if needed ...
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
            // Markdown Image
            // Groups 11 and 12 from original big regex, or just re-match
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

  // SEQUENTIAL TYPING STATE
  let typingIndex = 0;
  let lastLogLength = 0;

  // Image Timing Timer
  let imageTimer: ReturnType<typeof setTimeout> | null = null;

  export let showBackground: boolean = false;
  let activeBackgroundImage: string | null = null;
  // Map to store URLs of loaded images by index to support background mode even for lazy-loaded assets
  let loadedImageUrls: Record<number, string> = {};

  function handleImageLoad(index: number, url: string) {
    loadedImageUrls[index] = url;
    if (autoScroll) scrollToBottom();
  }

  let meta: ImageMetadata = {
    url: "",
    description: "",
  };

  $: {
    if (showBackground) {
      let foundUrl: string | null = null;
      // Find the latest image that has been "typed" (revealed)
      for (let i = typingIndex; i >= 0; i--) {
        if (i < chatLog.length) {
          const item = chatLog[i];
          if (item.type === "markdown_image" && item.url) {
            foundUrl = item.url;
            meta.type = "image";

            console.log("ChatWindow: found image", item.url);

            break;
          }
          // For 'image' type (assets), we check our loaded map
          if (item.type === "image" && loadedImageUrls[i]) {
            foundUrl = loadedImageUrls[i];
            break;
          }
        }
      }
      activeBackgroundImage = foundUrl;
      meta.url = foundUrl || "";
    } else {
      activeBackgroundImage = null;
    }
  }

  // Whenever chatLog updates (message arriving or history loading)
  $: {
    if (chatLog.length > lastLogLength) {
      // If bulk update (more than 2 items), assume history or initial load -> skip all
      // OR if it's the very first load
      if (chatLog.length - lastLogLength > 2 || lastLogLength === 0) {
        typingIndex = chatLog.length;
      } else {
        // Incremental update (streaming).
        // Ensure typingIndex is at least at the *start* of the new items?
        // Actually, if we were at index K, and K finishes, we go to K+1.
        // If K+1 is added, we naturally go there.
        // We don't need to force change typingIndex unless it was 'caught up'.
      }
      lastLogLength = chatLog.length;
    }

    // Auto-advance logic
    // We skip items that should appear INSTANTLY.
    // We STOP at items that require Time (Typewriter or Image Wait).
    while (typingIndex < chatLog.length) {
      const item = chatLog[typingIndex];
      const isTypewriter =
        item.type === "narration" || item.type === "dialogue";
      const isImage =
        (item.type === "image" || item.type === "markdown_image") && showImage;

      if (!isTypewriter && !isImage) {
        // Instant item (User, Situation Trigger, or Hidden Image) -> Skip
        typingIndex++;
      } else {
        // It's a Typewriter or Image -> Stop skipping, let the specific logic handle it.
        break;
      }
    }
  }

  // Handle Image Timing
  $: {
    if (typingIndex < chatLog.length) {
      const item = chatLog[typingIndex];
      const isImage =
        (item.type === "image" || item.type === "markdown_image") && showImage;

      if (isImage) {
        if (!imageTimer) {
          // Sequence:
          // 1. Image is rendered (because i <= typingIndex)
          // 2. Perform smooth scroll to bottom.
          // 3. WAIT for scroll to finish.
          // 4. Advance index.

          imageTimer = setTimeout(() => {
            if (autoScroll) {
              scrollToBottom();
            }
            typingIndex++;
            imageTimer = null;
          }, 100); // Small delay to ensure DOM render before scroll starts
        }
      }
    }
  }

  function handleTypewriterComplete(index: number) {
    if (index === typingIndex) {
      typingIndex++;
    }
  }

  $: {
    chatLog = $messages.flatMap((msg, i) => {
      const messageId = `msg-${i}`;
      if (msg.role === "user") {
        if (msg.role === "user") {
          const tagRegex = /<system-input>[\s\S]*?<\/system-input>/g;
          const sanitizedContent = msg.content.replace(tagRegex, "[상호작용]");
          return {
            type: "user",
            content: sanitizedContent,
            id: messageId,
          } as ChatLogItem;
        }
      } else if (msg.role === "assistant") {
        const blocks = parseAssistantContent(msg.content, messageId, persona);

        // Add Situation Trigger Button to the LAST message if it's a 2D persona
        // PersonaType check: "2D", "2.5D" (usually "2D" in internal type, but let's be safe)
        const is2D =
          persona?.personaType === "2D" || persona?.personaType === "2.5D";
        const isLastMessage = i === $messages.length - 1;

        if (is2D && isLastMessage && !isLoading && $messages.length > 1) {
          blocks.push({
            type: "situation_trigger",
            id: `${messageId}-trigger`,
          });
        }
        return blocks;
      }
      return [];
    });
  }

  // Scroll Logic
  $: if ($messages && chatWindowEl) {
    tick().then(() => {
      // Smart Scroll:
      // 1. If User sent checking, scroll immediately.
      // 2. If it's initial load (typingIndex caught up), scroll.
      // 3. If AI is typing (typingIndex < length), DON'T scroll here; let Typewriter/ImageTimer handle it sequentially.
      const lastMsg = $messages[$messages.length - 1];
      if (lastMsg?.role === "user" || typingIndex >= chatLog.length) {
        scrollToBottom();
      }
    });
  }

  // Loading State Logic
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

  // --- Situation Image Generation ---
  let isGeneratingImage = false;
  let showRatioOptions = false;

  async function generateSituationImage(ratio: string) {
    if (isGeneratingImage || !persona) return;
    isGeneratingImage = true;
    showRatioOptions = false; // Hide options after selection

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

      // Update store
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
      {#if i > typingIndex}
        <!-- Hidden waiting for turn -->
      {:else}
        <HtmlRenderer
          content={item.content}
          typewriter={true}
          active={i === typingIndex}
          instant={i < typingIndex}
          on:complete={() => handleTypewriterComplete(i)}
          on:type={scrollToBottom}
        />
      {/if}
    {:else if item.type === "dialogue"}
      {#if i <= typingIndex}
        <div class="message assistant">
          <div class="speaker-name">{item.speaker}</div>
          <div class="dialogue-bubble">
            <TypewriterHtml
              content={item.content.replace(
                /\*(.*?)\*/g,
                '<i class="custom-italic">$1</i>',
              )}
              speed={30}
              active={i === typingIndex}
              instant={i < typingIndex}
              on:complete={() => handleTypewriterComplete(i)}
              on:type={scrollToBottom}
            />
          </div>
        </div>
      {/if}
    {:else if item.type === "image" && showImage && !showBackground}
      {#if i <= typingIndex}
        <div class="image-block">
          <ChatImage
            {persona}
            metadata={item.metadata}
            index={item.index}
            on:load={(e) => {
              // Expect e.detail.url from ChatImage
              if (e.detail?.url) {
                handleImageLoad(i, e.detail.url);
              } else {
                // Fallback if no URL passed (legacy), maybe try to refetch?
                // or just trigger scroll for now.
                if (autoScroll) scrollToBottom();
              }
            }}
          />
        </div>
      {/if}
    {:else if item.type === "markdown_image" && showImage && !showBackground}
      {#if i <= typingIndex}
        <div class="image-block situation-image">
          <img
            src={item.url}
            alt={item.alt}
            loading="lazy"
            on:load={() => handleImageLoad(i, item.url)}
          />
        </div>
      {/if}
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

  /* Background Mode Layer */
  .chat-background-layer {
    position: fixed;
    top: 0;
    left: 0;

    width: 100%;
    height: 100vh; /* min-height 대신 height로 고정하는 것이 배경 제어에 유리합니다 */

    /* 핵심 변경 사항 */
    background-size: contain; /* 이미지가 잘리지 않고 다 들어감 */
    /* 만약 '무조건 세로만 꽉 채우고 좌우는 잘려도 된다'면 -> background-size: auto 100%; */

    background-position: center center; /* 정중앙 정렬 */
    background-repeat: no-repeat;

    z-index: 0;
    opacity: 0.4;
    pointer-events: none;
    transition: background-image 0.5s ease-in-out;

    /* 배경색 지정 (이미지 비율이 안 맞을 때 빈 공간 색상) */
    background-color: rgba(0, 0, 0, 0.5);
  }

  /* 뒤에서 꽉 채우고 흐리게 깔아주는 녀석 */
  .chat-bg-blur {
    position: fixed;
    inset: 0;
    background-size: cover; /* 얘는 잘려도 됨 */
    background-position: center;
    filter: blur(20px) brightness(0.7); /* 흐림 효과 */
    z-index: -1;
  }

  /* 앞에서 짤리지 않고 선명하게 보여주는 녀석 */
  .chat-bg-main {
    position: fixed;
    inset: 0;
    background-size: contain; /* 잘리지 않음 */
    background-position: center;
    background-repeat: no-repeat;
    z-index: 0;
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

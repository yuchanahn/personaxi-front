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

  export let isLoading: boolean = false;
  export let cssid: string;
  export let showChat: boolean = true;
  export let persona: Persona | null = null;
  export let showImage: boolean = true;

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

        if (is2D && isLastMessage && !isLoading) {
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

  $: if ($messages && chatWindowEl) {
    tick().then(() => {
      scrollToBottom();
    });

    if ($messages.length > 0) {
      const lastMessage = $messages[$messages.length - 1];
      isLoading = lastMessage.role === "user";
    } else {
      isLoading = false;
    }
  }

  function scrollToBottom() {
    if (!chatWindowEl) return;
    chatWindowEl.scrollTo({
      top: chatWindowEl.scrollHeight,
      behavior: "smooth",
    });
  }

  // --- Situation Image Generation ---
  let isGeneratingImage = false;

  async function generateSituationImage() {
    if (isGeneratingImage || !persona) return;
    isGeneratingImage = true;

    try {
      const response = await api.post("/api/chat/2d/generate-image", {
        personaId: persona.id,
        context: "",
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
  {#if chatLog.length === 0}
    <div class="empty-message" role="status">
      {$t("chatWindow.noConversation")}
    </div>
  {/if}

  {#each chatLog as item (item.id)}
    {#if item.type === "user"}
      <div class="message user">
        {item.content}
      </div>
    {:else if item.type === "narration"}
      <HtmlRenderer content={item.content} />
    {:else if item.type === "dialogue"}
      <div class="message assistant">
        <div class="speaker-name">{item.speaker}</div>
        <div class="dialogue-bubble">
          {@html item.content.replace(
            /\*(.*?)\*/g,
            '<i class="custom-italic">$1</i>',
          )}
        </div>
      </div>
    {:else if item.type === "image" && showImage}
      <div class="image-block">
        <ChatImage {persona} metadata={item.metadata} index={item.index} />
      </div>
    {:else if item.type === "markdown_image" && showImage}
      <div class="image-block situation-image">
        <img src={item.url} alt={item.alt} loading="lazy" />
      </div>
    {:else if item.type === "situation_trigger"}
      <div class="situation-trigger-wrapper">
        <button
          class="situation-btn"
          on:click={generateSituationImage}
          disabled={isGeneratingImage}
        >
          {#if isGeneratingImage}
            <span class="spinner-sm"></span> {$t("chatInput.generatingImage")}
          {:else}
            {$t("chatInput.generateSituationImage")}
            <span class="cost-badge">({$t("chatInput.cost")})</span>
          {/if}
        </button>
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

  .situation-trigger-wrapper {
    display: flex;
    justify-content: center;
    margin-top: 0.5rem;
    width: 100%;
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
</style>

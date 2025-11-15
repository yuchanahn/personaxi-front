<script lang="ts">
  import "$lib/styles/custom-markdown.css";
  import { onMount, tick } from "svelte";
  import { messages } from "$lib/stores/messages";
  import { t } from "svelte-i18n";
  import type { ImageMetadata, Persona } from "$lib/types";
  import AssetPreview from "../AssetPreview.svelte";
  import { get } from "svelte/store";
  import { st_user } from "$lib/stores/user";
  import HtmlRenderer from "./HtmlRenderer.svelte";
  import { interactiveChat } from "$lib/actions/interactiveChat";

  export let isLoading: boolean = false;
  export let cssid: string;
  export let showChat: boolean = true;
  export let persona: Persona | null = null;
  export let SendMessage: (msg: string) => void = (msg: string) => {
    console.log("SendMessage not implemented:", msg);
  };

  let chatWindowEl: HTMLElement;
  let isThink = false;

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

  type ChatLogItem =
    | NarrationBlock
    | DialogueBlock
    | UserBlock
    | ImageBlock
    | CodeBlock
    | InputPromptBlock;

  function parseAssistantContent(
    content: string,
    baseId: string,
    currentPersona: Persona | null,
  ): ChatLogItem[] {
    const FIRST_SCENE_TAG_REGEX = /<first_scene>/g;
    const CODE_BLOCK_REGEX = /```(?<lang>\w*)\s*\n?(?<code>[\s\S]+?)\s*```/;

    const ALL_TAGS_REGEX =
      /<(dialogue) speaker="([^"]+)">([\s\S]*?)<\/dialogue>|<(img) (\d+)>|<(Action) type="([^"]+)" question="([^"]+)" variable="([^"]+)"(?: max="(\d+)")? \/>/g;

    const blocks: ChatLogItem[] = [];
    let partIndex = 0;

    const processedContent = content
      .replace(/<think>[\s\S]*?<\/think>/g, "")
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
          ] = match;

          if (tagDia === "dialogue") {
            blocks.push({
              type: "dialogue",
              speaker: speaker,
              content: diaContent.trim(),
              id: `${partId}-d-${subPartIndex++}`,
            });
          } else if (tagImg === "img") {
            try {
              const imgIndex = parseInt(imgIndexStr, 10);
              const imageMetadata = currentPersona?.image_metadatas?.[imgIndex];
              if (imageMetadata?.url && !isNaN(imgIndex)) {
                blocks.push({
                  type: "image",
                  url: imageMetadata.url,
                  alt: imageMetadata.description || "scene image",
                  metadata: imageMetadata,
                  id: `${partId}-img-${subPartIndex++}`,
                });
              }
            } catch (error) {
              console.error("Error parsing img tag:", error);
            }
          } else if (tagAct === "Action") {
            blocks.push({
              type: "input_prompt",
              id: `${partId}-action-${subPartIndex++}`,
              prompt_type: actType,
              question: actQ,
              variable: actVar,
              max: actMax ? parseInt(actMax, 10) : null,
            });
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
        return { type: "user", content: msg.content, id: messageId };
      } else if (msg.role === "assistant") {
        return parseAssistantContent(msg.content, messageId, persona);
      }
      return [];
    });
  }

  $: {
    const messagesArray = $messages;
    if (messagesArray.length > 0) {
      const lastMessage = messagesArray[messagesArray.length - 1];
      isThink =
        lastMessage.role === "assistant" &&
        lastMessage.content.includes("<think>") &&
        !lastMessage.content.includes("</think>");
    } else {
      isThink = false;
    }
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
      <!-- {:else if item.type === "narration"}
      <div class="narration-block">
        {@html applyInlineStyles(item.content.replace(/\n/g, "<br>"))}
      </div>
    {:else if item.type === "dialogue"}
      <div class="message assistant">
        <div class="speaker-name">{item.speaker}</div>
        <div class="dialogue-bubble">
          {@html applyInlineStyles(item.content)}
        </div>
      </div> -->
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
    {:else if item.type === "image"}
      <div class="image-block">
        <AssetPreview asset={item.metadata} />
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
    <div
      class="loading-dots assistant-placeholder"
      role="status"
      aria-label="메시지 로딩 중"
    ></div>
  {/if}

  {#if isThink}
    <div
      class="loading-dots assistant-placeholder"
      role="status"
      aria-label="생각 중"
    >
      {$t("chatWindow.thinking")}<span>.</span><span>.</span><span>.</span>
    </div>
  {/if}
</div>

<style>
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
  .narration-block {
    align-self: center;
    width: 100%;
    max-width: 90%;
    text-align: center;
    font-style: italic;
    color: var(--muted-foreground);
    line-height: 1.6;
    white-space: pre-wrap;
  }
  .image-block {
    align-self: center;
    width: 100%;
    max-width: 90%;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .image-block img {
    width: 100%;
    border-radius: 12px;
    object-fit: cover;
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
  .loading-dots,
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
    font-style: normal; /* narration의 이탤릭체 덮어쓰기 */
    transition: all 0.2s;
    text-decoration: none; /* <a> 태그일 경우 밑줄 제거 */
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

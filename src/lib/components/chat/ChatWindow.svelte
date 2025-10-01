<script lang="ts">
  import "$lib/styles/custom-markdown.css";
  import { onMount, tick } from "svelte";
  import { messages } from "$lib/stores/messages";
  import { t } from "svelte-i18n";
  import type { ImageMetadata, Persona } from "$lib/types";
  import AssetPreview from "../AssetPreview.svelte";
  import { get } from "svelte/store";
  import { st_user } from "$lib/stores/user";

  export let isLoading: boolean = false;
  export let cssid: string;
  export let showChat: boolean = true;
  export let persona: Persona | null = null;

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
  type ChatLogItem =
    | NarrationBlock
    | DialogueBlock
    | UserBlock
    | ImageBlock
    | CodeBlock;

  function applyInlineStyles(text: string): string {
    if (!text) return "";
    return text.replace(/\*(.*?)\*/g, '<i class="custom-italic">$1</i>');
  }

  function parseAssistantContent(
    content: string,
    baseId: string,
    currentPersona: Persona | null,
  ): ChatLogItem[] {
    const SCRIPT_DIALOGUE_REGEX = /^([^:]+):\s*(.*)$/;
    const INLINE_NARRATION_REGEX = /\*([^*]+)\*/g;
    const IMG_TAG_REGEX = /<img (\d+)>/g;
    const FIRST_SCENE_TAG_REGEX = /<first_scene>/g;
    const CODE_BLOCK_REGEX = /```(?<lang>\w*)\s*\n?(?<code>[\s\S]+?)\s*```/;

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

      const isCodeBlock = i % 3 === 2; // code is the second capture group

      if (isCodeBlock) {
        const lang = parts[i - 1] || ""; // lang is the first capture group
        blocks.push({
          type: "code",
          language: lang,
          content: part,
          id: `${baseId}-code-${partIndex++}`,
        });
      } else if (part.trim()) {
        // This is a normal text part, apply existing line-by-line logic
        const lines = part.trim().split("\n");
        lines.forEach((line, lineIndex) => {
          const lineId = `${baseId}-part-${partIndex}-line-${lineIndex}`;
          let textPart = line;
          const imagesOnThisLine: Omit<ImageBlock, "id">[] = [];

          textPart = textPart.replace(
            IMG_TAG_REGEX,
            (match, capturedNumber) => {
              try {
                const imgIndex = parseInt(capturedNumber, 10);
                const imageMetadata =
                  currentPersona?.image_metadatas?.[imgIndex];

                if (imageMetadata?.url && !isNaN(imgIndex)) {
                  imagesOnThisLine.push({
                    type: "image",
                    url: imageMetadata.url,
                    alt: imageMetadata.description || "scene image",
                    metadata: imageMetadata,
                  });
                }
              } catch (error) {
                console.error("Error parsing img tag:", error);
              }
              return "";
            },
          );

          const trimmedText = textPart.trim();

          if (trimmedText) {
            const dialogueMatch = trimmedText.match(SCRIPT_DIALOGUE_REGEX);
            if (dialogueMatch) {
              const speaker = dialogueMatch[1].trim();
              const dialogueContent = dialogueMatch[2].trim();
              const dialogueParts = dialogueContent.split(
                INLINE_NARRATION_REGEX,
              );

              dialogueParts.forEach((dPart, dPartIndex) => {
                const dContent = dPart.trim();
                if (!dContent) return;
                if (dPartIndex % 2 === 1) {
                  blocks.push({
                    type: "narration",
                    content: dContent,
                    id: `${lineId}-d-n${dPartIndex}`,
                  });
                } else {
                  blocks.push({
                    type: "dialogue",
                    speaker,
                    content: dContent,
                    id: `${lineId}-d-d${dPartIndex}`,
                  });
                }
              });
            } else {
              blocks.push({
                type: "narration",
                content: trimmedText,
                id: `${lineId}-n`,
              });
            }
          }

          imagesOnThisLine.forEach((img, imgIdx) => {
            blocks.push({ ...img, id: `${lineId}-img-${imgIdx}` });
          });
        });
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
      <div class="narration-block">
        {@html applyInlineStyles(item.content.replace(/\n/g, "<br>"))}
      </div>
    {:else if item.type === "dialogue"}
      <div class="message assistant">
        <div class="speaker-name">{item.speaker}</div>
        <div class="dialogue-bubble">
          {@html applyInlineStyles(item.content)}
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
</style>

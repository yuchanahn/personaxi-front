<script lang="ts">
  import "$lib/styles/custom-markdown.css";
  import { onMount, tick, onDestroy } from "svelte";
  import { marked } from "marked";
  import { messages } from "$lib/stores/messages";
  import { t } from "svelte-i18n";
  import type { Persona } from "$lib/types";

  export let isLoading: boolean = false;
  export let cssid: string;
  export let showChat: boolean = true;
  export let persona: Persona | null = null;

  let chatWindowEl: HTMLElement;
  let isThink = false;

  let processedMessagesCache = new Map<string, string>();
  let lastMessagesLength = 0;

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

  const IMG_TAG_REGEX = /<img>(.*?)<\/img>/g;
  const THINK_REGEX = /<think>[\s\S]*?<\/think>/g;
  const SEPARATOR_REGEX = /---/g;
  const TABLE_REGEX = /^(.+?\|)/gm;
  const PARENTHESIS_REGEX = /\(([^)]+)\)/g;
  const DIALOGUE_REGEX = /^(.*?)\s*(".*?")$/gm;
  const NARRATOR_REGEX = /^\[([^\]]+)\]$/gm;

  interface ImageInstruction {
    pos: string;
    ins: number;
  }

  function parseImageTags(text: string): {
    cleanText: string;
    instructions: ImageInstruction[];
  } {
    const instructions: ImageInstruction[] = [];

    const cleanText = text.replace(IMG_TAG_REGEX, (match, capturedContent) => {
      try {
        const parts = capturedContent.split(",");
        if (parts.length < 2) return "";

        const pos = parts[0]?.trim();
        const ins = parseInt(parts[1]?.trim(), 10);

        if (pos && !isNaN(ins)) {
          instructions.push({ pos, ins });
        }
      } catch (error) {
        console.error("Error parsing img tag:", error);
      }
      return "";
    });

    return { cleanText, instructions };
  }

  function insertImages(
    text: string,
    instructions: ImageInstruction[],
  ): string {
    if (!persona?.image_metadatas || instructions.length === 0) {
      return text;
    }

    let processedText = text;

    for (const instruction of instructions) {
      try {
        const imageMetadata = persona.image_metadatas[instruction.ins];
        if (!imageMetadata?.url) {
          console.warn(
            `Image metadata not found for index: ${instruction.ins}`,
          );
          continue;
        }

        const imageTag = `<img src="${imageMetadata.url}" alt="장면 삽화" class="inserted-image" loading="lazy">`;

        if (instruction.pos && processedText.includes(instruction.pos)) {
          processedText = processedText.replace(
            instruction.pos,
            `${instruction.pos}\n${imageTag}`,
          );
        } else {
          processedText += `\n${imageTag}`;
          if (instruction.pos) {
            console.warn(`Position text not found: ${instruction.pos}`);
          }
        }
      } catch (error) {
        console.error("Error inserting image:", error);
      }
    }

    return processedText;
  }

  function preprocessMarkdown(text: string): string {
    return text
      .replace(SEPARATOR_REGEX, "\n\n---\n\n")
      .replace(TABLE_REGEX, "**$1**")
      .replace(PARENTHESIS_REGEX, "*($1)*")
      .replace(
        DIALOGUE_REGEX,
        '<span class="narration">$1</span><span class="dialogue">$2</span>',
      )
      .replace(NARRATOR_REGEX, '<p class="narrator">[$1]</p>');
  }

  function print(text: string): string {
    // 캐시 확인
    const cacheKey = `${text}_${persona?.id || "null"}`;
    if (processedMessagesCache.has(cacheKey)) {
      return processedMessagesCache.get(cacheKey)!;
    }

    try {
      // think 태그가 열려있으면 빈 문자열 반환
      if (text.includes("<think>") && !text.includes("</think>")) {
        return "";
      }

      // 1단계: 이미지 태그 파싱
      const { cleanText, instructions } = parseImageTags(text);

      // 2단계: 이미지 삽입
      let processedText = insertImages(cleanText, instructions);

      // 3단계: think 태그 제거
      processedText = processedText.replace(THINK_REGEX, "");

      // 4단계: 마크다운 전처리
      processedText = preprocessMarkdown(processedText);

      // 5단계: 마크다운 변환
      const result = marked(processedText.trimEnd(), {
        breaks: true,
        gfm: true,
        silent: true, // 파싱 에러를 콘솔에 출력하지 않음
      });

      // 캐시에 저장 (메모리 누수 방지를 위해 크기 제한)
      if (processedMessagesCache.size > 100) {
        const firstKey = processedMessagesCache.keys().next().value;
        processedMessagesCache.delete(firstKey!);
      }
      processedMessagesCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error("Error in print function:", error);
      return text; // 에러 시 원본 텍스트 반환
    }
  }

  function scrollToBottom() {
    if (!chatWindowEl) return;

    chatWindowEl.scrollTo({
      top: chatWindowEl.scrollHeight,
      behavior: "smooth",
    });
  }

  onMount(() => {
    if (chatWindowEl) {
      scrollToBottom();
    }
  });

  onDestroy(() => {
    processedMessagesCache.clear();
  });
</script>

<div
  class="chat-window"
  bind:this={chatWindowEl}
  style:opacity={showChat ? "0.9" : "0"}
  role="log"
  aria-label="채팅 메시지"
>
  {#if $messages.length === 0}
    <div class="empty-message" role="status">
      {$t("chatWindow.noConversation")}
    </div>
  {/if}

  {#each $messages as msg}
    <div
      class="message {msg.role}"
      role="article"
      aria-label="{msg.role} 메시지"
    >
      {#if msg.role === "assistant"}
        <div class="markdown-body">
          {@html print(msg.content)}
        </div>
      {:else}
        {@html print(msg.content)}
      {/if}
    </div>
  {/each}

  {#if isLoading}
    <div
      class="loading-dots assistant"
      role="status"
      aria-label="메시지 로딩 중"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="4" cy="12" r="3" fill="currentColor">
          <animate
            id="svgSpinners3DotsScale0"
            attributeName="r"
            begin="0;svgSpinners3DotsScale1.end-0.25s"
            dur="0.75s"
            values="3;.2;3"
          />
        </circle>
        <circle cx="12" cy="12" r="3" fill="currentColor">
          <animate
            attributeName="r"
            begin="svgSpinners3DotsScale0.end-0.6s"
            dur="0.75s"
            values="3;.2;3"
          />
        </circle>
        <circle cx="20" cy="12" r="3" fill="currentColor">
          <animate
            id="svgSpinners3DotsScale1"
            attributeName="r"
            begin="svgSpinners3DotsScale0.end-0.45s"
            dur="0.75s"
            values="3;.2;3"
          />
        </circle>
      </svg>
    </div>
  {/if}

  {#if isThink}
    <div class="loading-dots assistant" role="status" aria-label="생각 중">
      {$t("chatWindow.thinking")}<span>.</span><span>.</span><span>.</span>
    </div>
  {/if}
</div>

<style>
  .chat-window {
    width: 100%;
    max-width: 800px;
    min-height: clamp(200px, 50vh, 300px);
    margin: 0 auto;
    padding: 1rem 1rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    background: transparent;
    position: relative;
    padding-top: 50px;
    scroll-behavior: smooth;
  }

  .message {
    width: fit-content;
    max-width: 90%;
    padding: 0.75rem 1rem;
    border-radius: 16px;
    line-height: 1.5;
    word-break: break-word;
    white-space: normal;
    /* 성능 최적화 */
    contain: layout style paint;
  }

  @media (min-width: 768px) {
    .message {
      max-width: 70%;
    }

    .message.assistant {
      align-self: flex-start;
      max-width: 100%;
    }
  }

  .loading-dots.assistant {
    align-self: flex-start;
    background-color: var(--card);
    padding: 0.75rem 1rem;
    border-radius: 16px;
  }
  .message.user {
    align-self: flex-end;
    background-color: var(--primary);
    color: var(--primary-foreground);
  }

  .message.assistant {
    align-self: flex-start;
    background-color: var(--secondary);
    color: var(--secondary-foreground);
    border: 1px solid var(--border);
  }
  .loading-dots,
  .empty-message {
    align-self: center;
    color: var(--color-secondary-text);
    font-style: italic;
  }

  :global(.markdown-body .inserted-image) {
    max-width: 100%;
    border-radius: 8px;
    margin-top: 0.75rem;
    display: block;
    height: auto;
    /* 이미지 로딩 최적화 */
    image-rendering: auto;
  }

  @keyframes blink {
    0% {
      opacity: 0.2;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.2;
    }
  }

  /* 스크롤바 스타일링 (선택사항) */
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

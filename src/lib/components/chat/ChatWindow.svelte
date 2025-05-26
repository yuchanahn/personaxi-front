<script lang="ts">
  import { onMount } from "svelte";
  import { marked } from "marked";
  import { messages } from "$lib/stores/messages";
  export let isLoading: boolean = false;

  let isThink: boolean = false;

  onMount(() => {
    const el = document.querySelector(".chat-window");
    const observer = new MutationObserver(() => {
      el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    if (el) observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect(); // 컴포넌트 언마운트 시 정리
  });

  function stripEmotions(text: string) {
    return text.replace(/<표정:[^>]+>/g, "");
  }

  function print(text: string) {
    const think_start = text.includes("<think>");
    const think_end = text.includes("</think>");

    if (think_start && !think_end) {
      isThink = true;
      text = "";
    }

    if (think_start && think_end) {
      isThink = false;
    }

    text = text.replace(/<think[^>]*>[\s\S]*?<\/think>/g, "");
    text = stripEmotions(text);

    return marked(text);
  }
</script>

<div class="chat-window">
  {#if $messages.length === 0}
    <div class="empty-message">아직 대화가 없습니다. 질문을 입력해보세요.</div>
  {/if}
  {#each $messages as msg, i (i)}
    <div class="message {msg.role}">
      {@html print(msg.content)}
    </div>
  {/each}
  {#if isLoading}
    <div class="loading-dots">
      답변 생성 중<span>.</span><span>.</span><span>.</span>
    </div>
  {/if}
  {#if isThink}
    <div class="loading-dots">
      생각 중<span>.</span><span>.</span><span>.</span>
    </div>
  {/if}
</div>

<style>
  .chat-window {
    padding: 1rem;
    margin: 0 auto;
    margin-bottom: 1rem;
    flex: 1;
    overflow-y: auto;
    min-height: 300px;
    min-width: 600px;
    max-width: 800px;
    background: transparent;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .message {
    max-width: 70%;
    padding: 0.75rem 1rem;
    border-radius: 16px;
    line-height: 1.5;
    position: relative;
    word-break: break-word;
    white-space: normal;
  }

  .message.user {
    align-self: flex-end;
    background: #2a2a2a;
    color: white;
  }

  .message.assistant {
    align-self: flex-start;
    background: #222222;
    color: #dbdbdb;
  }

  .loading-dots,
  .empty-message {
    align-self: center;
    color: var(--color-secondary-text);
    font-style: italic;
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
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import { messages } from '$lib/stores/messages';
  export let isLoading: boolean = false;

  onMount(() => {
    const el = document.querySelector('.chat-window');
    const observer = new MutationObserver(() => {
      el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
    if (el) observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect(); // 컴포넌트 언마운트 시 정리
  });
</script>

<div class="chat-window">
  {#if $messages.length === 0}
    <div class="empty-message">아직 대화가 없습니다. 질문을 입력해보세요.</div>
  {/if}
  {#each $messages as msg, i (i)}
    <div class="message {msg.role}">
      {@html marked(msg.content)}
    </div>
  {/each}
  {#if isLoading}
    <div class="loading-dots">답변 생성 중<span>.</span><span>.</span><span>.</span></div>
  {/if}
</div>


<style>
  .chat-window {
    padding: 1rem;
    margin: 0 auto;
    margin-bottom: 5rem;
    flex: 1;
    overflow-y: auto;
    min-height: 300px;
    min-width: 600px;
    max-width: 800px;
    background: transparent;
  }
  .message.assistant,
  .message.user {
    margin: 0.5rem 0;
    padding: 0.5rem;
    border-radius: 10px;
    background: transparent;
    word-break: break-word;
    line-height: 1.5;
  }
  .message.user {
    text-align: right;
  }
  .empty-message {
    color: var(--color-secondary-text);
    font-style: italic;
    text-align: center;
    margin-top: 2rem;
  }
  .loading-dots {
    color: var(--color-secondary-text);
    font-style: italic;
    margin-top: 1rem;
    animation: blink 1.5s infinite;
  }
  @keyframes blink {
    0% { opacity: 0.2; }
    50% { opacity: 1; }
    100% { opacity: 0.2; }
  }
</style>
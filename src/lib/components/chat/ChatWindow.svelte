<script lang="ts">
  import { onMount, tick } from "svelte"; // tick 추가
  import { marked } from "marked";
  import { messages } from "$lib/stores/messages";
  import { t } from "svelte-i18n"; // svelte-i18n import 추가

  export let isLoading: boolean = false;
  export let cssid: string;
  export let showChat: boolean = true;

  let chatWindowEl: HTMLElement;
  let isThink = false;

  // 반응성($:)을 사용해 messages가 바뀔 때마다 isThink 상태를 자동으로 계산
  $: {
    isThink = false; // 기본값은 false
    if ($messages.length > 0) {
      const lastMessage = $messages[$messages.length - 1];
      if (
        lastMessage.role === "assistant" &&
        lastMessage.content.includes("<think>") &&
        !lastMessage.content.includes("</think>")
      ) {
        isThink = true;
      }
    }
  }

  function stripEmotions(text: string) {
    text = text.replace(/<emo:[^>]+>/g, "");
    text = text.replace(/<act:[^>]+>/g, "");
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

    //text = text.replace(/<think[^>]*>[\s\S]*?<\/think>/g, "");
    //text = stripEmotions(text);

    return marked(text);
  }

  // 자동 스크롤 로직은 onMount 대신 messages가 변경될 때마다 실행하는 것이 더 안정적입니다.
  $: if ($messages && chatWindowEl) {
    // tick()을 사용해 DOM 업데이트가 완료된 후 스크롤
    tick().then(() => {
      chatWindowEl.scrollTo({
        top: chatWindowEl.scrollHeight,
        behavior: "smooth",
      });
    });

    // 마지막 메시지가 user 역할인 경우 로딩 상태를 false로 설정
    if ($messages.length > 0) {
      const lastMessage = $messages[$messages.length - 1];
      if (lastMessage.role === "user") {
        isLoading = true;
      } else {
        isLoading = false;
      }
    }
  }
</script>


<div
  class="chat-window"
  bind:this={chatWindowEl}
  style:opacity={showChat ? "0.7" : "0"}
>
  {#if $messages.length === 0}
    <div class="empty-message">{$t('chatWindow.noConversation')}</div>
  {/if}
  {#each $messages as msg, i (i)}
    <div class="message {msg.role}">
      {@html print(msg.content)}
    </div>
  {/each}
  {#if isLoading}
    <div class="loading-dots assistant">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        ><circle cx="4" cy="12" r="3" fill="currentColor"
          ><animate
            id="svgSpinners3DotsScale0"
            attributeName="r"
            begin="0;svgSpinners3DotsScale1.end-0.25s"
            dur="0.75s"
            values="3;.2;3"
          /></circle
        ><circle cx="12" cy="12" r="3" fill="currentColor"
          ><animate
            attributeName="r"
            begin="svgSpinners3DotsScale0.end-0.6s"
            dur="0.75s"
            values="3;.2;3"
          /></circle
        ><circle cx="20" cy="12" r="3" fill="currentColor"
          ><animate
            id="svgSpinners3DotsScale1"
            attributeName="r"
            begin="svgSpinners3DotsScale0.end-0.45s"
            dur="0.75s"
            values="3;.2;3"
          /></circle
        ></svg
      >
    </div>
  {/if}
  {#if isThink}
    <div class="loading-dots assistant">
      {$t('chatWindow.thinking')}<span>.</span><span>.</span><span>.</span>
    </div>
  {/if}
</div>



<style>
  /* 뷰포트에 맞게 꽉 채우되 800 px 이상은 넓어지지 않음 */
  .chat-window {
    width: 100%; /* NEW: 가변 폭 */
    max-width: 800px; /* 데스크톱 상한 */
    /* min-width 제거 → 모바일에서 불필요한 여백 감소 */
    min-height: clamp(
      200px,
      50vh,
      300px
    ); /* 200~300px 사이, 화면 높이 50% 목표 */
    margin: 0 auto 1rem; /* 가운데 정렬 */
    padding: 1rem 1rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    background: transparent;
    position: relative;
    padding-top: 50px; /* 설정 버튼 공간 */
  }

  /* 메시지 버블은 컨테이너 폭의 90 % 까지 사용 (모바일 가독성↑) */
  .message {
    width: fit-content;
    max-width: 90%;
    padding: 0.75rem 1rem;
    border-radius: 16px;
    line-height: 1.5;
    word-break: break-word;
    white-space: normal;
  }

  /* 데스크톱(≥ 768 px)에서는 기존 70 % 폭 유지 */
  @media (min-width: 768px) {
    .message {
      max-width: 70%;
    }
  }
  /* .assistant 클래스를 loading-dots와 함께 사용할 수 있도록 수정 */
  .loading-dots.assistant {
    align-self: flex-start; /* assistant 메시지처럼 왼쪽에 표시 */
    background-color: #222222; /* assistant 메시지와 유사한 배경 */
    padding: 0.75rem 1rem;
    border-radius: 16px;
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

<script lang="ts">
  import { autoResize } from "$lib/hooks/autoResize";
  import Icon from "@iconify/svelte";
  import { t } from "svelte-i18n";

  export let onSend: (text: string) => void;
  export let onChangeInput: (text: string) => void;
  let prompt = "";

  function handleSubmit(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() === "") return; // 빈 메시지 전송 방지
      onSend(prompt);
      prompt = "";

      // 전송 후 textarea의 크기를 다시 1줄로 줄이는 로직
      // autoResize 액션이 이벤트를 받아서 처리하도록 수정이 필요할 수 있습니다.
      // 간단하게는 수동으로 스타일을 조절할 수 있습니다.
      const textarea = e.currentTarget as HTMLTextAreaElement;
      textarea.style.height = "auto";

      // 스크롤 뷰 이동
      setTimeout(() => {
        document
          .querySelector(".chat-input")
          ?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }
</script>

<div class="chat-input-wrapper">
  <div class="input-container">
    <textarea
      bind:value={prompt}
      placeholder={$t("chatInput.placeholder")}
      class="chat-input focus-override"
      rows="1"
      use:autoResize={180}
      on:keydown={handleSubmit}
      on:input={() => onChangeInput(prompt)}
    ></textarea>
    <button
      class="chat-send-button"
      on:click={() => {
        if (prompt.trim() === "") return;
        onSend(prompt);
        prompt = "";
      }}
      title={$t("chatInput.sendButton")}
      aria-label={$t("chatInput.sendButton")}
    >
      <Icon icon="ci:arrow-up-lg" width="24" height="24" />
    </button>
  </div>
</div>

<style>
  /* 채팅 입력 전체 래퍼 */
  .chat-input-wrapper {
    display: flex;
    align-items: flex-start; /* 자식요소(.input-container)를 위쪽으로 정렬 */
    padding-bottom: 0.75rem;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    position: relative;
    min-height: 50px;
  }

  /* textarea + 전송 버튼을 담는 컨테이너 */
  .input-container {
    position: relative;
    width: 100%;
    margin: 0 auto;
    display: flex;
    align-items: flex-start; /* textarea와 button을 위쪽으로 정렬 (핵심 수정) */
  }

  /* 텍스트 입력창 */
  .chat-input {
    border: none;
    resize: none;
    background: #2e2e2e;
    color: white;
    line-height: 1.5;
    font-family: "Segoe UI", sans-serif;
    font-size: 1rem;
    max-height: 160px;
    min-height: 50px;
    overflow-y: auto;
    border-radius: 20px;
    outline: none;
    padding: 0.7rem;
    padding-right: 3.5rem; /* 버튼만큼 우측 여백 확보 */
    flex-grow: 1;
    box-sizing: border-box;
  }

  /* 전송 버튼 */
  .chat-send-button {
    position: absolute;
    bottom: 7px; /* 하단으로부터의 위치 고정 */
    right: 8px; /* 오른쪽 끝에서의 거리 */
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #4a4a4a;
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    transition: background-color 0.2s ease;
  }
  .chat-send-button:hover {
    background: #707070;
  }

  /* 모바일(≤600px)에서도 중앙 정렬 유지 */
  @media (max-width: 600px) {
    .input-container {
      width: 95%;
      margin: 0 auto;
    }
  }
</style>

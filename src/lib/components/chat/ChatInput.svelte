<script lang="ts">
  import { onMount } from "svelte";
  import { autoResize } from "$lib/hooks/autoResize";
  import Icon from "@iconify/svelte";

  export let onSend: (text: string) => void;
  let prompt = "";
  let textarea: HTMLTextAreaElement;
  let button: HTMLButtonElement;

  const updateButtonPosition = () => {
    if (textarea && button) {
      const textareaHeight = textarea.offsetHeight || 50;
      const buttonSize = 36;

      // 수직 중앙 정렬
      button.style.bottom = `${textareaHeight / 2 - buttonSize / 2}px`;
      console.log(
        "Updated Position - Height:",
        textareaHeight,
        "Bottom:",
        button.style.bottom,
      );
    }
  };

  function handleSubmit(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend(prompt);
      prompt = "";

      // 다음 프레임
      requestAnimationFrame(() => {
        autoResize(
          document.querySelector(".chat-input") as HTMLTextAreaElement,
        );
        updateButtonPosition(); // 버튼 위치 업데이트
      });

      setTimeout(() => {
        document
          .querySelector(".chat-input")
          ?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }

  onMount(() => {
    requestAnimationFrame(updateButtonPosition);
    textarea?.addEventListener("input", updateButtonPosition);
    return () => {
      textarea?.removeEventListener("input", updateButtonPosition);
    };
  });
</script>

<div class="chat-input-wrapper">
  <div class="input-container">
    <textarea
      bind:this={textarea}
      bind:value={prompt}
      placeholder="무엇이든 물어보세요"
      class="chat-input"
      rows="1"
      use:autoResize={180}
      on:keydown={handleSubmit}
    ></textarea>
    <button
      bind:this={button}
      class="chat-send-button"
      on:click={() => {
        onSend(prompt);
        prompt = "";
      }}
      title="보내기"
      aria-label="보내기"
    >
      <Icon icon="ci:arrow-up-lg" width="24" height="24" />
    </button>
  </div>
</div>

<style>
  /* 채팅 입력 전체 래퍼 */
  .chat-input-wrapper {
    display: flex;
    align-items: flex-end;
    padding: 0.75rem 1rem;
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
    margin: 0 auto; /* NEW: 좌우 중앙 정렬 */
    display: flex;
    align-items: center;
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
    padding-right: 3.5rem; /* NEW: 버튼만큼 우측 여백 확보 */
    flex-grow: 1;
    box-sizing: border-box;
  }

  /* 전송 버튼 */
  .chat-send-button {
    position: absolute;
    right: 0;
    transform: translateX(-8px);
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
  }
  .chat-send-button:hover {
    background: #707070;
  }

  /* 모바일(≤600px)에서도 중앙 정렬 유지 */
  @media (max-width: 600px) {
    .input-container {
      width: 95%;
      margin: 0 auto; /* NEW */
    }
  }
</style>

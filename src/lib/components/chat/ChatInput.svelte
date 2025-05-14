<script lang="ts">
  import { onMount } from 'svelte';
  import { autoResize } from "$lib/hooks/autoResize";
  import Icon from "@iconify/svelte";

  export let onSend: (text: string) => void;
  let prompt = "";
  let textarea: HTMLTextAreaElement;
  let button: HTMLButtonElement;

  function handleSubmit(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend(prompt);
      prompt = "";
      setTimeout(() => {
        document
          .querySelector(".chat-input")
          ?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }

  onMount(() => {
    const updateButtonPosition = () => {
      if (textarea && button) {
        const textareaHeight = textarea.offsetHeight || 50;
        const buttonSize = 36;

        // 수직 중앙 정렬
        button.style.bottom = `${(textareaHeight / 2) - (buttonSize / 2)}px`;
        console.log('Updated Position - Height:', textareaHeight, 'Bottom:', button.style.bottom);
      }
    };

    requestAnimationFrame(updateButtonPosition);
    textarea?.addEventListener('input', updateButtonPosition);
    return () => {
      textarea?.removeEventListener('input', updateButtonPosition);
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

  .input-container {
    position: relative;
    width: 87%; /* 입력창과 버튼을 포함한 전체 너비 */
    display: flex;
    align-items: center; /* 수직 정렬 */
  }

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
    flex-grow: 1; /* 입력창이 남은 공간을 채움 */
    box-sizing: border-box;
  }

  .chat-send-button {
    position: absolute;
    right: 0; /* 입력창 오른쪽 끝에 딱 붙음 */
    transform: translateX(-8px); /* 버튼을 수직 중앙에 위치시킴 */
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
    margin-left: 0.5rem; /* 입력창과 약간의 간격 */
  }

  .chat-send-button:hover {
    background: #707070;
  }

  @media (max-width: 600px) {
    .input-container {
      width: 80%; /* 반응형 너비 조정 */
    }
  }
</style>
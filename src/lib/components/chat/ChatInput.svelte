<script lang="ts">
  import { autoResize } from "$lib/hooks/autoResize";
  import Icon from "@iconify/svelte";
  import { t } from "svelte-i18n";

  export let onSend: (text: string) => void;
  export let onChangeInput: (text: string) => void = (t: string) => {};
  let prompt = "";

  function handleSubmit(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() === "") return;
      onSend(prompt);
      prompt = "";

      const textarea = e.currentTarget as HTMLTextAreaElement;
      textarea.style.height = "auto";

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
  .chat-input-wrapper {
    display: flex;
    align-items: flex-start;
    padding-bottom: 0.75rem;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    position: relative;
    min-height: 50px;
  }

  .input-container {
    position: relative;
    width: 100%;
    margin: 0 auto;
    display: flex;
    align-items: flex-start;
  }

  .chat-input {
    border: none;
    resize: none;
    background: #2e2e2e;
    color: white;
    line-height: 1.5;
    font-size: 1rem;
    max-height: 160px;
    min-height: 50px;
    overflow-y: auto;
    border-radius: 20px;
    outline: none;
    padding: 0.7rem;
    padding-right: 3.5rem;
    flex-grow: 1;
    box-sizing: border-box;
  }

  .chat-send-button {
    position: absolute;
    bottom: 7px;
    right: 8px;
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

  @media (max-width: 600px) {
    .input-container {
      width: 95%;
      margin: 0 auto;
    }
  }
</style>

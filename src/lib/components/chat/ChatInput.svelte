<script lang="ts">
  import { autoResize } from "$lib/hooks/autoResize";
  import Icon from "@iconify/svelte";
  import { t } from "svelte-i18n";
  import SttComponent from "../stt/SttComponent.svelte";

  let {
    onSend,
    onChangeInput = (t: string) => {},
    isDisabled = false,
    isListening = $bindable(false),
  }: {
    onSend: (text: string) => void;
    onChangeInput?: (text: string) => void;
    isDisabled?: boolean;
    isListening?: boolean;
  } = $props();

  let prompt = $state("");

  function handleSubmit(e: KeyboardEvent) {
    if (isDisabled) return;

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
  <div class="input-container" class:listening={isListening}>
    {#if !isListening}
      <textarea
        bind:value={prompt}
        placeholder={$t("chatInput.placeholder")}
        class="chat-input focus-override"
        rows="1"
        use:autoResize={180}
        on:keydown={handleSubmit}
        on:input={() => onChangeInput(prompt)}
      ></textarea>
    {/if}
    {#if prompt.trim() === ""}
      <div class="chat-send-button" title="음성 입력" aria-label="음성 입력">
        <SttComponent bind:isListening onSpeechComplete={onSend} />
      </div>
    {:else}
      <button
        class="chat-send-button"
        class:is-disabled={isDisabled}
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
    {/if}
  </div>
</div>

<style>
  .chat-input-wrapper {
    display: flex;
    align-items: flex-start;
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.75rem);

    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    position: relative;
    min-height: 50px;
  }
  button.is-disabled {
    background-color: #ccc;
    color: #666;
    cursor: not-allowed;
  }
  .input-container {
    position: relative;
    width: 100%;
    margin: 0 auto;
    display: flex;
    align-items: flex-start;
  }

  .chat-input {
    resize: none;
    background: var(--input);
    color: var(--foreground);
    border: 1px solid var(--border-input);
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
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .chat-input:focus {
    border-color: var(--ring);
    box-shadow: 0 0 0 3px hsl(from var(--ring) h s l / 0.3);
  }

  .chat-send-button {
    position: absolute;
    bottom: 7px;
    right: 8px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--primary);
    color: var(--primary-foreground);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    transition:
      background-color 0.2s ease,
      opacity 0.2s ease;
  }
  .chat-send-button:hover:not(:disabled) {
    opacity: 0.9;
  }

  .chat-send-button:disabled {
    background-color: var(--muted);
    color: var(--muted-foreground);
    cursor: not-allowed;
  }

  .listening .chat-send-button {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);

    width: 60px;
    height: 60px;
  }

  @media (max-width: 600px) {
    .input-container {
      width: 95%;
      margin: 0 auto;
    }
  }
</style>

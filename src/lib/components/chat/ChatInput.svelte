<script lang="ts">
  import { autoResize } from "$lib/hooks/autoResize";
  import Icon from "@iconify/svelte";
  import { t } from "svelte-i18n";
  import SttComponent from "../stt/SttComponent.svelte";
  import { st_user } from "$lib/stores/user";

  import { pricingStore } from "$lib/stores/pricing";
  import { get } from "svelte/store";

  let {
    onSend,
    onChangeInput = (t: string) => {},
    isDisabled = false,
    isListening = $bindable(false),
    placeholderName = "",
    mode = "3d", // Add mode prop to determine base cost
    neededNeurons,
  }: {
    onSend: (text: string) => void;
    onChangeInput?: (text: string) => void;
    isDisabled?: boolean;
    isListening?: boolean;
    placeholderName?: string;
    mode?: "2d" | "3d";
    neededNeurons?: number;
  } = $props();

  let prompt = $state("");
  const MAX_CHARS = 2000;
  const charCount = $derived(prompt.length);
  const isOverLimit = $derived(charCount > MAX_CHARS);

  // Dynamic cost calculation based on mode or prop
  const displayNeurons = $derived(
    neededNeurons !== undefined
      ? neededNeurons
      : mode === "3d"
        ? $pricingStore.costs.chat_3d
        : $pricingStore.costs.chat_2d,
  );

  function handleSubmit(e: KeyboardEvent) {
    if (isDisabled || isOverLimit) return;

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
  {#if !isListening && charCount > 1000}
    <div
      class="char-counter"
      class:warning={charCount > MAX_CHARS * 0.9}
      class:error={isOverLimit}
    >
      {charCount}/{MAX_CHARS}
    </div>
  {/if}
  {#if !isListening && charCount > 0}
    <div class="neuron-indicator">
      {displayNeurons} / {$st_user?.credits ?? 0}
    </div>
  {/if}
  <div class="input-container" class:listening={isListening}>
    {#if !isListening}
      <textarea
        bind:value={prompt}
        placeholder={$t("chatInput.placeholder", {
          values: { name: placeholderName || "친구" },
        })}
        class="chat-input focus-override"
        class:over-limit={isOverLimit}
        rows="1"
        maxlength={MAX_CHARS}
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
        class:is-disabled={isDisabled || isOverLimit}
        disabled={isOverLimit}
        on:click={() => {
          if (prompt.trim() === "" || isOverLimit) return;
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

  .chat-input.over-limit {
    border-color: #ef4444;
  }

  .char-counter {
    position: absolute;
    bottom: 10px;
    left: 12px;
    font-size: 0.75rem;
    color: var(--muted-foreground);
    pointer-events: none;
    z-index: 5;
  }

  .char-counter.warning {
    color: #f59e0b;
  }

  .char-counter.error {
    color: #ef4444;
    font-weight: 600;
  }

  .neuron-indicator {
    position: absolute;
    bottom: 8px;
    right: 50px;
    font-size: 0.75rem;
    color: var(--primary);
    font-weight: 500;
    pointer-events: none;
    z-index: 5;
    background: rgba(var(--background), 0.8);
    padding: 2px 6px;
    border-radius: 10px;
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

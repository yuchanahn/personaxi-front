<script lang="ts">
  import { autoResize } from "$lib/hooks/autoResize";
  import Icon from "@iconify/svelte";
  import { t } from "svelte-i18n";
  import SttComponent from "../stt/SttComponent.svelte";
  import { st_user } from "$lib/stores/user";

  import { pricingStore } from "$lib/stores/pricing";
  import { onMount, tick } from "svelte";
  import { initKeyboardViewport } from "$lib/helpers/keyboardViewport";

  let {
    onSend,
    onChangeInput = (t: string) => {},
    isDisabled = false,
    isListening = $bindable(false),
    placeholderName = "",
    mode = "3d", // Add mode prop to determine base cost
    neededNeurons,
    hasStaticImage = false,
    onImageClick = () => {},
    iosVV = false,
  }: {
    onSend: (text: string, onError?: (error: any) => void) => void;
    onChangeInput?: (text: string) => void;
    isDisabled?: boolean;
    isListening?: boolean;
    placeholderName?: string;
    mode?: "2d" | "3d";
    neededNeurons?: number;
    hasStaticImage?: boolean;
    onImageClick?: () => void;
    iosVV?: boolean;
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

  function SendPrompt() {
    if (prompt.trim() === "" || isOverLimit || isDisabled) return;
    let sendSuccess = true;
    let capturedPrompt = prompt;
    onSend(prompt, (error) => {
      sendSuccess = false;
      prompt = capturedPrompt;
    });
    if (!sendSuccess) return;
    prompt = "";

    setTimeout(() => {
      document
        .querySelector(".chat-input")
        ?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  }

  function handleSubmit(e: KeyboardEvent) {
    if (isDisabled || isOverLimit) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      SendPrompt();

      const textarea = e.currentTarget as HTMLTextAreaElement;
      textarea.style.height = "auto";

      setTimeout(() => {
        document
          .querySelector(".chat-input")
          ?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }

  let realInput: HTMLTextAreaElement | null = $state(null);

  let keyboardHeight = $state(0);
  let isKeyboardOpen = $state(false);

  async function openKeyboard(e: Event) {
    e.preventDefault();
    await tick();
    realInput?.focus({ preventScroll: true });

    // 임시

    isKeyboardOpen = true;
  }

  onMount(() => {
    const handle = initKeyboardViewport({
      inputEl: () => realInput ?? null,
      setKeyboardHeight: (px) => (keyboardHeight = px),
      setIsKeyboardOpen: (open) => (isKeyboardOpen = open),
      threshold: 10,
      maxCloseFrames: 30,
    });

    return handle.destroy;
  });
</script>

<div
  class="chat-input-wrapper"
  style:transform="translateY(-{keyboardHeight}px)"
>
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
      {#if iosVV}
        {#if !isKeyboardOpen}
          <textarea
            class="chat-input focus-override"
            placeholder={$t("chatInput.placeholder", {
              values: { name: placeholderName || "친구" },
            })}
            bind:value={prompt}
            rows="1"
            maxlength={MAX_CHARS}
            disabled={isDisabled}
            use:autoResize={180}
            onclick={openKeyboard}
          ></textarea>
        {/if}
        <textarea
          bind:this={realInput}
          bind:value={prompt}
          class:over-limit={isOverLimit}
          rows="1"
          maxlength={MAX_CHARS}
          disabled={isDisabled}
          use:autoResize={180}
          placeholder={$t("chatInput.placeholder", {
            values: { name: placeholderName || "친구" },
          })}
          class="real-input focus-override"
          oninput={() => onChangeInput(prompt)}
          class:shown={isKeyboardOpen}
          onkeydown={handleSubmit}
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        ></textarea>
      {:else}
        <textarea
          bind:value={prompt}
          placeholder={$t("chatInput.placeholder", {
            values: { name: placeholderName || "친구" },
          })}
          class="chat-input focus-override"
          class:over-limit={isOverLimit}
          rows="1"
          maxlength={MAX_CHARS}
          disabled={isDisabled}
          autocomplete="off"
          inputmode="search"
          enterkeyhint="send"
          autocapitalize="off"
          spellcheck="false"
          use:autoResize={180}
          onkeydown={handleSubmit}
          oninput={() => onChangeInput(prompt)}
        ></textarea>
      {/if}
    {/if}
    {#if prompt.trim() === ""}
      <div class="chat-send-button" title="음성 입력" aria-label="음성 입력">
        <SttComponent
          bind:isListening
          onSpeechComplete={(text) => {
            prompt = text;
            if (!isDisabled) SendPrompt();
          }}
        />
      </div>
      {#if hasStaticImage}
        <button
          class="chat-image-button"
          title="이미지 생성"
          aria-label="이미지 생성"
          onclick={onImageClick}
        >
          <Icon icon="ci:image" width="24" height="24" />
        </button>
      {/if}
    {:else}
      <button
        class="chat-send-button"
        class:is-disabled={isDisabled || isOverLimit}
        disabled={isOverLimit || isDisabled}
        onclick={() => {
          SendPrompt();
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
    min-height: 50px;
  }

  .chat-input,
  .real-input {
    width: 100%;
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
    box-sizing: border-box;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .chat-input {
    position: relative;
    z-index: 1;
  }

  .real-input {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2; /* chat-input보다 위에 배치 */
    opacity: 0;
    pointer-events: none;
  }

  .real-input.shown {
    position: relative;
    opacity: 1;
    pointer-events: auto;
    background: var(--input); /* 배경색을 채워 아래 chat-input을 가림 */
  }

  .chat-input:focus {
    outline: none; /* 브라우저 기본 파란색/검은색 강조 테두리 제거 */
    border-color: var(
      --border-input
    ); /* (중요) 포커스 시 색상이 변하지 않도록 기존 색상 유지 */
    box-shadow: none; /* 혹시 그림자로 효과가 들어가 있다면 제거 */
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

  .chat-image-button {
    position: absolute;
    bottom: 7px;
    right: 55px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
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

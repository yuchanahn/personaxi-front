<script lang="ts">
  import { test as viewVrmInCanvas } from "$lib/vrm/test";
  import ChatWindow from "../chat/ChatWindow.svelte";
  import ChatInput from "../chat/ChatInput.svelte";
  import { handleSendToCharacter } from "$lib/services/chat";
  import type { Model } from "$lib/vrm/core/model";
  import type { Persona } from "$lib/types";
  import { tick } from "svelte";

  export let persona: Persona | null;
  let model: Model | null;

  let canvas: HTMLCanvasElement;

  function loadVrm() {
    try {
      if (persona)
        viewVrmInCanvas(canvas, persona)
          .then((m) => (model = m))
          .finally();
    } catch (error) {
      console.error("Error loading VRM:", error);
    }
  }

  $: if (persona?.id) {
    tick().then(loadVrm);
  }

  const send = async (prompt: string) => {
    try {
      if (model && persona)
        await handleSendToCharacter(persona.id, prompt, model);
    } catch (error) {
      console.error("Error sending prompt to character:", error);
    }
  };
</script>

<div id="character-view">
  <canvas bind:this={canvas} class="vrm-canvas"></canvas>
  <div class="chat-container">
    <div class="chat-content">
      <ChatWindow />
      <ChatInput onSend={send} />
    </div>
  </div>
</div>

<style>
  .vrm-canvas {
    height: 60vh; /* 상단 캔버스 고정 높이 */
    flex-shrink: 0; /* 줄어들지 않음 */
    width: 100%;
  }
  #character-view {
    height: 100vh; /* 전체 화면 높이 */
    overflow: hidden; /* 전체 스크롤 방지 */
    display: flex;
    flex-direction: column;
  }
  .chat-container {
    height: 40vh;
    flex-grow: 1;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
  }
  .chat-content {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .chat-content :global(.chat-window) {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 5rem;
  }
  .chat-content :global(.chat-input-wrapper) {
    position: sticky;
    bottom: 0;
    background: var(--color-accent);
    padding: 1rem;
    z-index: 10;
  }
</style>

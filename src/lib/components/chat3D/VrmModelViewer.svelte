<script lang="ts">
  import { test as viewVrmInCanvas } from "$lib/vrm/test";
  import ChatWindow from "../chat/ChatWindow.svelte";
  import ChatInput from "../chat/ChatInput.svelte";
  import { handleSendToCharacter } from "$lib/services/chat";
  import type { Model } from "$lib/vrm/core/model";
  import type { Persona } from "$lib/types";
  import { tick } from "svelte";

  export let persona: Persona | null;
  export let cssid: string | null = null;
  export let show: boolean = false;
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

  let isLoading = false;

  const send = async (prompt: string) => {
    try {
      if (model && persona) {
        isLoading = true;
        await handleSendToCharacter(persona.id, prompt, model);
        isLoading = false;
      }
    } catch (error) {
      console.error("Error sending prompt to character:", error);
    }
  };

  export function speek(audio: ArrayBuffer) {
    if (model) {
      model.speak(audio).catch((error) => {
        console.error("Error speaking:", error);
      });
    } else {
      console.warn("Model not loaded yet, cannot speak.");
    }
  }
</script>

<div id="character-view">
  <canvas bind:this={canvas} class="vrm-canvas"></canvas>
  <div class="chat-container">
    <div class="chat-content">
      <ChatWindow cssid={cssid ?? ""} showChat={show} {isLoading} />
      <ChatInput onSend={send} />
    </div>
  </div>
</div>

<style>
  #character-view {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
  .vrm-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1; /* 캔버스가 배경이 되도록 z-index 낮게 설정 */
  }
  .chat-container {
    position: absolute; /* 캔버스 위에 겹쳐지도록 */
    bottom: 0; /* 화면 아래에 붙도록 */
    width: 100%; /* 전체 가로 폭 */
    height: 100vh; /* 화면 높이의 40% 차지 (조절 가능) */

    /* 배경색 투명하게 */
    background-color: rgba(255, 255, 255, 0); /* 배경색을 반투명하게 설정 */

    display: flex;
    flex-direction: column;
    z-index: 2; /* 캔버스보다 위에 오도록 z-index 높게 설정 */
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

    background-color: rgba(255, 255, 255, 0); /* 배경색을 반투명하게 설정 */
  }
</style>

<script lang="ts">
  import VrmModelViewer from "$lib/components/chat3D/VrmModelViewer.svelte";
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/stores";
  import { loadChatHistory } from "$lib/api/chat";
  import type { Persona } from "$lib/types";
  import { loadPersona } from "$lib/api/edit_persona";
  import { connectTTSSocket, disconnectTTSSocket } from "$lib/api/tts";

  let lastSessionId: string | null = null;
  let persona: Persona | null = null;

  let Viewer: VrmModelViewer;
  let showChat: boolean = true;

  onMount(() => {
    const sessionId = $page.url.searchParams.get("c");
    lastSessionId = sessionId;
    if (sessionId) {
      persona = null;
      loadChatHistory(sessionId);
      loadPersona(sessionId).then((p) => (persona = p));
      connectTTSSocket((audio: ArrayBuffer) => {
        if (Viewer && Viewer.speek) {
          Viewer.speek(audio);
        } else {
          console.warn("Viewer not ready for TTS audio.");
        }
      });
    }
  });

  $: {
    const sessionId = $page.url.searchParams.get("c");
    if (sessionId !== lastSessionId) {
      lastSessionId = sessionId;
      if (sessionId) {
        persona = null;
        loadChatHistory(sessionId);
        loadPersona(sessionId).then((p) => (persona = p));
      }
    }
  }

  onDestroy(() => {
    disconnectTTSSocket();
  });
</script>

<main>
  {#if persona}
    <VrmModelViewer
      bind:this={Viewer}
      {persona}
      cssid={lastSessionId ?? ""}
      bind:show={showChat}
    />
  {/if}

  <div class="toggle-container">
    <label class="switch">
      <input type="checkbox" bind:checked={showChat} />
      <span class="slider round"></span>
    </label>
    <span>채팅 보이기</span>
  </div>
</main>

<style>
  main {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .toggle-container {
    position: absolute;
    top: 40px;
    right: 20px;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 10px;
    background-color: rgba(0, 0, 0, 0.5);
    padding: 10px 15px;
    border-radius: 8px;
    color: white;
    font-size: 0.9em;
  }

  /* 토글 스위치 CSS */
  .switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 20px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    -webkit-transition: 0.4s;
    transition: 0.4s;
    border-radius: 20px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    -webkit-transition: 0.4s;
    transition: 0.4s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: #2196f3;
  }

  input:focus + .slider {
    box-shadow: 0 0 1px #2196f3;
  }

  input:checked + .slider:before {
    -webkit-transform: translateX(20px);
    -ms-transform: translateX(20px);
    transform: translateX(20px);
  }
</style>

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
    <button
      class="toggle-button"
      on:click={() => {
        showChat = !showChat;
      }}
    >
      {#if showChat}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      {:else}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path
            d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
          />
          <path
            d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
          />
          <line x1="2" x2="22" y1="2" y2="22" />
        </svg>
      {/if}
    </button>
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

  .toggle-button {
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    padding: 0; /* 버튼의 기본 패딩 제거 */
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white; /* SVG 아이콘 색상 설정 */
    transition: transform 0.3s ease;
  }

  .toggle-button:hover {
    transform: scale(1.1); /* 마우스를 올렸을 때 살짝 커지는 효과 */
  }
</style>

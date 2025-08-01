<script lang="ts">
  import VrmModelViewer from "$lib/components/chat3D/VrmModelViewer.svelte";
  import ChatControls3D from "$lib/components/chat3D/ChatControls3D.svelte"; // NEW: 3D 컨트롤 컴포넌트 임포트
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/stores";
  import { loadChatHistory } from "$lib/api/chat";
  import type { Persona } from "$lib/types";
  import { loadPersona } from "$lib/api/edit_persona";
  import { connectTTSSocket, disconnectTTSSocket } from "$lib/api/tts";
  import TtsStatusModal from "$lib/components/modal/TTSStatusModal.svelte";

  let lastSessionId: string | null = null;
  let persona: Persona | null = null;

  let Viewer: VrmModelViewer;
  let showChat: boolean = false;

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
    <TtsStatusModal
      impl_connectTTS={() => {
        connectTTSSocket((audio: ArrayBuffer) => {
          if (Viewer && Viewer.speek) {
            Viewer.speek(audio);
          } else {
            console.warn("Viewer not ready for TTS audio.");
          }
        });
      }}
      impl_disconnectTTS={() => {
        disconnectTTSSocket();
      }}
    />

    <VrmModelViewer
      bind:this={Viewer}
      {persona}
      cssid={lastSessionId ?? ""}
      bind:show={showChat}
    />

    <ChatControls3D cssid={lastSessionId ?? ""} bind:showChat {persona} />
  {/if}
</main>

<style>
  main {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
</style>

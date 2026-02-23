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
  import { messages } from "$lib/stores/messages";
  import { toast } from "$lib/stores/toast";

  let lastSessionId: string | null = null;
  let persona: Persona | null = null;

  let Viewer: VrmModelViewer;
  let showChat: boolean = false;

  let affectionScore = 100;
  let blackOpacity = 1;
  let pinkOpacity = 0;

  // Camera State
  let closeupScale: number = 1.0;
  let closeupOffset: number = 0.0;
  let isCloseup: boolean = false;

  // Vignette Logic
  $: {
    const t = Math.max(0, Math.min(100, affectionScore)) / 100;
    blackOpacity = 0.95 - t * 0.95;
    pinkOpacity = t * 0.45;
  }

  onMount(() => {
    // Listen for Affection Updates
    const handleAffection = (e: CustomEvent) => {
      if (e.detail?.score !== undefined) {
        affectionScore = e.detail.score;
      }
    };
    window.addEventListener(
      "affection-update",
      handleAffection as EventListener,
    );
    const removeListener = () =>
      window.removeEventListener(
        "affection-update",
        handleAffection as EventListener,
      );

    (async () => {
      const sessionId = $page.url.searchParams.get("c");
      lastSessionId = sessionId;
      $messages = [];
      if (sessionId) {
        // Data loading is handled by the reactive block below

        await connectTTSSocket(async (audio: ArrayBuffer | null) => {
          if (!audio) {
            toast.error("TTS Server Busy");
            console.warn("TTS Failed (3D).");
            return;
          }

          if (Viewer && Viewer.speek) {
            Viewer.speek(audio);
          } else {
            console.warn("Viewer not ready for TTS audio.");
          }
        });
      }
    })();

    return removeListener;
  });

  let isStartSpeech = false;

  $: {
    const sessionId = $page.url.searchParams.get("c");
    if (sessionId !== lastSessionId) {
      lastSessionId = sessionId;
      if (sessionId) {
        persona = null;
        // Reset state

        Promise.all([
          loadChatHistory(sessionId, (esf) => {
            isStartSpeech = esf.recent_turns.length < 1;
          }),
          loadPersona(sessionId),
        ]).then(([_, p]) => {
          persona = p;
        });
      }
    }
  }

  onDestroy(() => {
    disconnectTTSSocket();
  });
</script>

<main>
  <div
    class="vignette-overlay vignette-black"
    style="opacity: {blackOpacity};"
  ></div>
  <div
    class="vignette-overlay vignette-pink"
    style="opacity: {pinkOpacity};"
  ></div>
  {#if persona}
    <VrmModelViewer
      bind:this={Viewer}
      {persona}
      backgroundImage={"/chat_bg.png"}
      cssid={lastSessionId ?? ""}
      startVoiceUrl={isStartSpeech ? persona.start_voice_url : ""}
      bind:show={showChat}
      bind:closeupScale
      bind:closeupOffset
      bind:isCloseup
    />

    <ChatControls3D
      cssid={lastSessionId ?? ""}
      bind:showChat
      {persona}
      llmType={"3d"}
      bind:closeupScale
      bind:closeupOffset
      bind:isCloseup
      impl_connectTTS={async () => {
        await connectTTSSocket(async (audio: ArrayBuffer | null) => {
          if (!audio) {
            toast.error("TTS Server Busy");
            return;
          }
          // Copy same logic as onMount or refactor to function
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
      impl_changeCamera={() => (isCloseup = !isCloseup)}
      {affectionScore}
    />

    <!-- Debug UI -->
    <div class="debug-controls">
      <label>
        Affection: {affectionScore}
        <input type="range" min="0" max="100" bind:value={affectionScore} />
      </label>
      <button on:click={() => (affectionScore = 0)}>0</button>
      <button on:click={() => (affectionScore = 100)}>100</button>
    </div>
  {/if}
</main>

<style>
  main {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }

  @media (display-mode: standalone) {
    main {
      height: 100vh;
    }
  }

  .vignette-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 100;
    transition: opacity 1.5s ease-in-out;
  }

  .vignette-black {
    background: radial-gradient(
      circle at center,
      transparent 30%,
      rgba(0, 0, 0, 0.4) 80%,
      rgba(0, 0, 0, 0.95) 150%
    );
    mix-blend-mode: multiply;
  }

  .vignette-pink {
    background: radial-gradient(
      circle at center,
      transparent 30%,
      rgba(255, 182, 193, 0.4) 80%,
      rgba(255, 105, 180, 0.9) 150%
    );
    mix-blend-mode: screen;
  }
</style>

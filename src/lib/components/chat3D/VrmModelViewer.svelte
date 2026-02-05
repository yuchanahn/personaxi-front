<script lang="ts">
  import { getViewer, unload, test as viewVrmInCanvas } from "$lib/vrm/test";
  import ChatWindow from "../chat/ChatWindow.svelte";
  import ChatInput from "../chat/ChatInput.svelte";
  import { handleSendToCharacter } from "$lib/services/chat";
  import type { Model } from "$lib/vrm/core/model";
  import type { Persona } from "$lib/types";
  import { onDestroy, onMount, tick } from "svelte";
  import type { Viewer } from "$lib/vrm/core/viewer";
  import Icon from "@iconify/svelte";

  import * as THREE from "three/webgpu";
  import { sparks } from "$lib/vrm/stores";

  import ThoughtBubble from "$lib/components/chat/ThoughtBubble.svelte";
  import SpeechBubble from "$lib/components/chat/SpeechBubble.svelte";
  import { messages } from "$lib/stores/messages";
  import { ttsState } from "$lib/stores/ttsStore";

  // --- Mobile Keyboard Fix ---
  let viewportHeight = 0;
  // ----------------------------

  export let persona: Persona | null;
  export let cssid: string | null = null;
  export let show: boolean = true;
  export let backgroundImage: string | null = null;
  export let startVoiceUrl: string | undefined = undefined;

  let model: Model | null;
  let listeningTimeout: ReturnType<typeof setTimeout>;

  let canvas: HTMLCanvasElement;
  let bubbleElement: HTMLDivElement;
  let hasPlayedStartVoice = false;

  let viewer: Viewer | null = null;

  let isModelLoading = true;

  onMount(() => {
    // [Mobile Keyboard Fix]
    // Prevent layout shift by locking body scroll
    let originalOverflow = document.body.style.overflow;
    let originalHeight = document.body.style.height;
    let originalPosition = document.body.style.position;
    let originalWidth = document.body.style.width;

    // Cleanup function variable
    let cleanupListeners = () => {};

    if (typeof window !== "undefined" && window.visualViewport) {
      viewportHeight = window.visualViewport.height;

      const handleResize = () => {
        if (window.visualViewport) {
          viewportHeight = window.visualViewport.height;
          // iOS scroll fix
          if (document.body.scrollTop !== 0) {
            document.body.scrollTop = 0;
          }
        }
      };

      window.visualViewport.addEventListener("resize", handleResize);
      window.visualViewport.addEventListener("scroll", handleResize);

      // Apply Body Lock
      document.body.style.overflow = "hidden";
      document.body.style.height = "100%";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";

      cleanupListeners = () => {
        window.visualViewport?.removeEventListener("resize", handleResize);
        window.visualViewport?.removeEventListener("scroll", handleResize);
      };
    } else {
      viewportHeight = window.innerHeight;
    }

    return () => {
      cleanupListeners();
      // Restore body styles
      document.body.style.overflow = originalOverflow;
      document.body.style.height = originalHeight;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
    };
  });

  // Autoplay Start Voice (VRM)
  $: if (
    !isModelLoading &&
    viewer &&
    model &&
    startVoiceUrl &&
    !hasPlayedStartVoice
  ) {
    console.log("[VRM] Autoplay Start Voice:", startVoiceUrl);
    hasPlayedStartVoice = true;

    // [Mobile Keyboard Fix] - Moved to onMount

    setTimeout(() => {
      // VRM viewer usually has a speek or similar method, or uses TTS api directly?
      // The parent uses `connectTTSSocket` to control it.
      // But `VrmModelViewer` exposes `speek(audio: ArrayBuffer)`.
      // We only have a URL here. We need to fetch it as ArrayBuffer.

      fetch(startVoiceUrl as string)
        .then((res) => res.arrayBuffer())
        .then((buffer) => {
          if (model) {
            // Need to ensure audio context is ready.
            // Emulate TTS socket receive format if needed?
            // Or use a direct speak method if available.
            // Checking VrmModelViewer exports... it doesn't seem to export `speak`?
            // Wait, in `character/+page.svelte`, it calls `Viewer.speek(audio)`.
            speek(buffer);
          }
        })
        .catch((e) => console.error("[VRM] Start Voice Fetch Error", e));
    }, 1000);
  }

  // Thought Bubble State
  let thought1 = "";
  let thought2 = "";
  let showThought1 = false;
  let showThought2 = false;
  let isSpeaking = false;
  let speechText = "";
  let showSpeech = false;

  // Parse thoughts from the last message
  $: if ($messages.length > 0) {
    const lastMsg = $messages[$messages.length - 1];
    if (lastMsg.role === "assistant") {
      const text = lastMsg.content;

      // Extract Thought 1: Starts with ( and ends with ) before any newline or speech
      const t1Match = text.match(/^\s*\((.*?)\)/);
      if (t1Match) {
        if (thought1 !== t1Match[1]) {
          console.log("VRM Thought 1 detected:", t1Match[1]);
          thought1 = t1Match[1];
          // Only show thought1 if we haven't started speaking yet
          if (!isSpeaking && !showThought2) {
            console.log("VRM Showing Thought 1");
            showThought1 = true;
          }
        }
      }

      // Extract Thought 2: Ends with (thought)
      const t2Match = text.match(/\((.*?)\)\s*$/);
      if (t2Match) {
        if (text.trim() !== t2Match[0].trim()) {
          if (thought2 !== t2Match[1]) {
            thought2 = t2Match[1];
          }
        }
      }
    }
  }

  function handleThoughtEnded(): void {
    if ($ttsState == "connected") return;
    const lastMsg = $messages[$messages.length - 1];
    if (lastMsg.role === "assistant") {
      let content = lastMsg.content;
      content = content.replace(/\([^)]*\)/g, "");
      content = content.replace(/\[[^\]]*\]/g, "");
      console.log("content: ", content);
      speechText = content;
    }
    showSpeech = true;
    setTimeout(() => {
      showThought1 = false;
    }, 2000);
  }

  function handleSpeechEnded(): void {
    showSpeech = false;
    showThought1 = false;
    showThought2 = true;
    setTimeout(() => {
      showThought2 = false;
    }, 8000);
  }

  let cfg = {
    rotImpulseHead: 30,
    halfRotHead: 0.5,
    rotImpulseBody: 12,
    halfRotBody: 0.25,
    rotImpulseLimb: 10,
    halfRotLimb: 0.3,
  };

  $: model && (model.cfg = structuredClone(cfg)); // 항상 새 객체

  onDestroy(() => {
    unload();
    clearTimeout(listeningTimeout);
  });

  function loadVrm() {
    const minLoadTime = 3000;
    const startTime = Date.now();

    try {
      if (persona)
        viewVrmInCanvas(canvas, persona)
          .then((m) => {
            model = m;
            model?.setCanvas(canvas);
            viewer = getViewer();

            updateCameraPosition();
            if (model) model.cfg = cfg;

            // Enforce minimum load time for UX
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, minLoadTime - elapsed);

            setTimeout(() => {
              isModelLoading = false;
              console.log("## Model loaded! END TIMER END!");
            }, remaining + 5000);
          })
          .catch((error) => {
            console.error("Error loading VRM:", error);
            isModelLoading = false; // On error, hide immediately or show error state
          })
          .finally(() => {
            console.log("finally - model loaded!");
          });
    } catch (error) {
      console.error("Error loading VRM:", error);
      isModelLoading = false;
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (model) {
      // 마우스 위치를 -1 ~ 1 사이의 정규화된 좌표로 변환
      const normalizedX = (event.clientX / window.innerWidth) * 2 - 1;
      const normalizedY = (event.clientY / window.innerHeight) * 2 - 1;

      model.updateMouseGaze(normalizedX, normalizedY);
    }
  }

  function handleMouseClick(event: MouseEvent) {
    if (model) {
      // 1. 캔버스의 화면상 위치와 크기 정보를 가져옴
      const rect = canvas.getBoundingClientRect();

      // 2. 캔버스 좌측 상단을 (0, 0)으로 하는 마우스 좌표 계산
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // 3. -1 to +1 범위로 정규화 (Three.js 표준 방식)
      const mouseX = (x / rect.width) * 2 - 1;
      const mouseY = -(y / rect.height) * 2 + 1;

      // 하단 영역(다리 쪽) 클릭 무시 (채팅 입력 오작동 방지)
      // -1이 바닥, 1이 천장. -0.3 이하면 하단 35% 정도
      if (mouseY < -0.7) return;

      model.hitByMouse(mouseX, mouseY);
    }
  }

  function handleInputChange(text: string) {
    model?.stateManager?.setListening(true);

    clearTimeout(listeningTimeout);

    if (text === "") {
      model?.stateManager?.setListening(false);
      return;
    }

    listeningTimeout = setTimeout(() => {
      model?.stateManager?.setListening(false);
    }, 3000);
  }

  $: if (persona?.id) {
    (async () => {
      isModelLoading = true;
      // Wait for UI to update (show loader)
      await tick();
      // Give valid timeout to ensure paint
      setTimeout(() => {
        loadVrm();
      }, 50);
    })();
  }

  let isLoading = false;

  const send = async (prompt: string) => {
    if (!model || !persona) return;

    clearTimeout(listeningTimeout);
    model.stateManager?.setListening(false);
    //model.doGesture('Listening Intro.fbx');

    // Reset thoughts
    thought1 = "";
    thought2 = "";
    showThought1 = false;
    showThought2 = false;

    try {
      isLoading = true;
      //cameraDistanceOffset -= 0.5;
      //updateCameraPosition();
      await handleSendToCharacter(persona.id, prompt, model);
    } catch (error) {
      console.error("Error sending prompt to character:", error);
    } finally {
      //model.doGesture('Listening Outro.fbx');
      //cameraDistanceOffset += 0.5;
      //updateCameraPosition();
      isLoading = false;
    }
  };

  export function speek(audio: ArrayBuffer) {
    if (model) {
      model.stateManager?.setSpeaking(true);

      isSpeaking = true;
      // Keep thought1 visible for a bit longer into speech, then fade
      // setTimeout(() => {
      //   showThought1 = false;
      // }, 2000); // 2 seconds overlap

      showThought2 = false;
      showSpeech = false;

      model
        .speak(audio)
        .then(() => {
          model!.stateManager?.setSpeaking(false);
          isSpeaking = false;
          showThought1 = false; // Ensure thought1 is gone

          if (thought2) {
            showThought2 = true;
            setTimeout(() => {
              showThought2 = false;
            }, 8000);
          }
        })
        .catch((error) => {
          console.error("Error speaking:", error);
          isSpeaking = false;
        });
    } else {
      console.warn("Model not loaded yet, cannot speak.");
    }
  }
  // ▼▼▼ 카메라 컨트롤 변수 수정 ▼▼▼
  export let closeupScale: number = 1.0;
  export let closeupOffset: number = 0.0;
  export let isCloseup: boolean = false;

  // Reactivity for camera
  $: if (isCloseup !== undefined || closeupScale || closeupOffset) {
    updateCameraPosition();
  }

  // Internal offsets (keep them for now, or just use 0)
  let cameraDistanceOffset = 0.2;
  let cameraHeightOffset = -0.45;
  let cameraRotationOffsetY = -8;
  let cameraRotationOffsetX = 14;

  // Trigger update when internal debug offsets change (if they still exist)
  $: if (
    cameraDistanceOffset ||
    cameraHeightOffset ||
    cameraRotationOffsetY ||
    cameraRotationOffsetX
  ) {
    updateCameraPosition();
  }

  function updateCameraPosition() {
    if (!viewer || !viewer.model?.vrm) return;

    const vrm = viewer.model.vrm;
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const baseHeight = center.y + (size.y / 2) * 0.9;
    const baseDistance = size.y * 1.5;

    // Apply closeup logic
    let effectiveDistance = baseDistance + cameraDistanceOffset;
    let effectiveHeight = baseHeight + cameraHeightOffset;

    if (isCloseup) {
      // Zoom = Reduce distance
      effectiveDistance = effectiveDistance / closeupScale;

      // Vertical Position = Offset height
      // Scale factor for offset to make it feel natural (e.g. relative to model height)
      effectiveHeight += closeupOffset * size.y;
    }

    // 최종 거리와 기본 높이 계산
    const finalDistance = effectiveDistance;
    const lookAtHeight = effectiveHeight;

    // 각도를 라디안으로 변환
    const angleY = cameraRotationOffsetY * (Math.PI / 180); // 좌우 각도
    const angleX = cameraRotationOffsetX * (Math.PI / 180); // 위아래 각도

    // 구면 좌표계를 사용하여 X, Y, Z 위치 계산
    const x = center.x + finalDistance * Math.sin(angleY) * Math.cos(angleX);
    const z = center.z + finalDistance * Math.cos(angleY) * Math.cos(angleX);
    const y = lookAtHeight + finalDistance * Math.sin(angleX);

    viewer.camera.position.set(x, y, z);

    // 카메라는 항상 캐릭터의 시선 높이를 바라보도록 설정
    viewer.camera.lookAt(new THREE.Vector3(center.x, lookAtHeight, center.z));
    viewer.camera.updateProjectionMatrix();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- on:mouseenter={() => model?.startMouseFollowing()}
  on:mouseleave={() => model?.stopMouseFollowing()} -->

{#each $sparks as s (s.id)}
  <!-- svelte-ignore element_invalid_self_closing_tag -->
  <div
    class="spark"
    style="left:{s.x}px; top:{s.y}px; --r:{s.angle}deg"
    on:animationend={() => sparks.update((a) => a.filter((e) => e.id !== s.id))}
  />
{/each}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  id="character-view"
  on:mousedown={handleMouseClick}
  on:mousemove={handleMouseMove}
>
  {#if backgroundImage}
    <img
      src={backgroundImage}
      alt="background"
      class="vrm-bg"
      draggable="false"
    />
  {/if}
  <canvas bind:this={canvas} class="vrm-canvas"></canvas>

  <!-- Thought Bubbles -->
  <!-- Thought Bubbles -->
  <ThoughtBubble
    text={thought1}
    visible={showThought1}
    customStyle="top: 5vh; bottom: auto; left: 50%; transform: translateX(-50%); z-index: 20;"
    onEnded={handleThoughtEnded}
  />
  <ThoughtBubble
    text={thought2}
    visible={showThought2}
    customStyle="top: 5vh; bottom: auto; left: 50%; transform: translateX(-50%); z-index: 20;"
  />

  <SpeechBubble
    text={speechText}
    visible={showSpeech}
    customStyle="top: 25vh; left: 50%; transform: translateX(-50%); z-index: 25;"
    onEnded={handleSpeechEnded}
  />

  {#if isModelLoading}
    <!-- {console.log("Rendering Model Loader", isModelLoading)} -->
    <div class="model-loader">
      <div class="loader-content">
        <Icon icon="line-md:loading-twotone-loop" width="64" height="64" />
        <span class="loading-text">VRM 모델 로딩 중...</span>
        <small class="loading-hint"
          >잠시 화면이 멈출 수 있습니다 (정상 동작)</small
        >
      </div>
    </div>
  {/if}

  <div
    id="speech-bubble"
    class="bubble"
    style:visibility={isLoading ? "visible" : "hidden"}
    bind:this={bubbleElement}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      ><circle cx="4" cy="12" r="3" fill="currentColor"
        ><animate
          id="svgSpinners3DotsFade0"
          fill="freeze"
          attributeName="opacity"
          begin="0;svgSpinners3DotsFade1.end-0.25s"
          dur="0.75s"
          values="1;0.2"
        /></circle
      ><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.4"
        ><animate
          fill="freeze"
          attributeName="opacity"
          begin="svgSpinners3DotsFade0.begin+0.15s"
          dur="0.75s"
          values="1;0.2"
        /></circle
      ><circle cx="20" cy="12" r="3" fill="currentColor" opacity="0.3"
        ><animate
          id="svgSpinners3DotsFade1"
          fill="freeze"
          attributeName="opacity"
          begin="svgSpinners3DotsFade0.begin+0.3s"
          dur="0.75s"
          values="1;0.2"
        /></circle
      ></svg
    >
  </div>
  <!--
  <div class="hit-controls">
    <h4>Head / Neck</h4>
    <div class="slider-group">
      <label>Impulse</label>
      <input
        type="range"
        min="5"
        max="30"
        step="0.5"
        bind:value={cfg.rotImpulseHead}
      />
      <span>{cfg.rotImpulseHead.toFixed(1)}</span>
    </div>
    <div class="slider-group">
      <label>Half‑life</label>
      <input
        type="range"
        min="0.05"
        max="0.5"
        step="0.01"
        bind:value={cfg.halfRotHead}
      />
      <span>{cfg.halfRotHead.toFixed(2)}s</span>
    </div>
    <h4>Chest / Spine</h4>
    <div class="slider-group">
      <label>Impulse</label>
      <input
        type="range"
        min="5"
        max="30"
        step="0.5"
        bind:value={cfg.rotImpulseBody}
      />
      <span>{cfg.rotImpulseBody.toFixed(1)}</span>
    </div>
    <div class="slider-group">
      <label>Half‑life</label>
      <input
        type="range"
        min="0.05"
        max="0.5"
        step="0.01"
        bind:value={cfg.halfRotBody}
      />
      <span>{cfg.halfRotBody.toFixed(2)}s</span>
    </div>
    <h4>Arms / Legs</h4>
    <div class="slider-group">
      <label>Impulse</label>
      <input
        type="range"
        min="5"
        max="60"
        step="0.5"
        bind:value={cfg.rotImpulseLimb}
      />
      <span>{cfg.rotImpulseLimb.toFixed(1)}</span>
    </div>
    <div class="slider-group">
      <label>Half‑life</label>
      <input
        type="range"
        min="0.05"
        max="0.5"
        step="0.01"
        bind:value={cfg.halfRotLimb}
      />
      <span>{cfg.halfRotLimb.toFixed(2)}s</span>
    </div>
    <button
      on:click={() =>
        (cfg = {
          rotImpulseHead: 15,
          halfRotHead: 0.25,
          rotImpulseBody: 12,
          halfRotBody: 0.25,
          rotImpulseLimb: 10,
          halfRotLimb: 0.3,
        })}>Reset</button
    >
  </div>

  <div class="camera-controls">
    <div class="slider-group">
      <label for="distance">카메라 거리</label>
      <input
        id="distance"
        type="range"
        min="-2"
        max="2"
        step="0.1"
        bind:value={cameraDistanceOffset}
      />
      <span>{cameraDistanceOffset.toFixed(1)}</span>
    </div>
    <div class="slider-group">
      <label for="height">카메라 높이</label>
      <input
        id="height"
        type="range"
        min="-1"
        max="1"
        step="0.05"
        bind:value={cameraHeightOffset}
      />
      <span>{cameraHeightOffset.toFixed(2)}</span>
    </div>
    <div class="slider-group">
      <label for="rotation">카메라 각도</label>
      <input
        id="rotation"
        type="range"
        min="-180"
        max="180"
        step="1"
        bind:value={cameraRotationOffsetY}
      />
      <span>{cameraRotationOffsetY.toFixed(0)}°</span>
    </div>
    <div class="slider-group">
      <label for="rotationX">카메라 높낮이</label>
      <input
        id="rotationX"
        type="range"
        min="-45"
        max="45"
        step="1"
        bind:value={cameraRotationOffsetX}
      />
      <span>{cameraRotationOffsetX.toFixed(0)}°</span>
    </div>
  </div>
  -->
  <div
    class="chat-container select-none"
    style:height={viewportHeight ? `${viewportHeight}px` : "100%"}
  >
    <div class="chat-content">
      <ChatWindow showChat={show} {isLoading} {persona} />
      <ChatInput
        onSend={send}
        onChangeInput={handleInputChange}
        placeholderName={persona?.name}
      />
    </div>
  </div>
</div>

<style>
  #character-view {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background-color: #000;
  }

  .vrm-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
    opacity: 0.6;
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
    position: absolute;
    bottom: 0;
    width: 100%;
    height: 100vh;
    height: 100dvh;

    padding-bottom: env(safe-area-inset-bottom, 0px);

    background-color: rgba(255, 255, 255, 0);

    display: flex;
    flex-direction: column;
    z-index: 2;
  }

  @media (display-mode: standalone) {
    .chat-container {
      height: 100vh;
    }
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
  }
  .chat-content :global(.chat-input-wrapper) {
    position: sticky;
    bottom: 0;
    background: var(--color-accent);
    z-index: 10;

    background-color: rgba(255, 255, 255, 0); /* 배경색을 반투명하게 설정 */
  }

  .camera-controls {
    position: absolute;
    bottom: 20px;
    left: 20px;
    z-index: 100;
    background-color: rgba(0, 0, 0, 0.6);
    padding: 15px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    color: white;
    font-size: 0.9em;
    min-width: 250px;

    /* visibility: hidden; */
  }

  .hit-controls {
    position: absolute;
    bottom: 220px;
    left: 20px;
    z-index: 100;
    background-color: rgba(0, 0, 0, 0.6);
    padding: 15px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    color: white;
    font-size: 0.9em;
    min-width: 250px;

    /* visibility: hidden; */
  }

  .slider-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .slider-group label {
    width: 80px; /* 라벨 너비 고정 */
  }

  .slider-group input[type="range"] {
    flex: 1; /* 슬라이더가 남은 공간을 모두 차지하도록 */
  }

  .slider-group span {
    width: 40px; /* 숫자 표시 공간 확보 */
    text-align: right;
  }

  .bubble {
    position: absolute; /* 부모 요소(#character-view)를 기준으로 위치를 잡음 */
    left: 50%; /* 왼쪽에서 50% 지점으로 이동 */
    top: 20vh; /* 화면 상단에서 35% 높이(viewport height)에 위치 */
    transform: translateX(
      -50%
    ); /* 자기 너비의 절반만큼 왼쪽으로 이동해 완벽한 중앙 정렬 */

    /* visibility는 Svelte의 style:visibility 로 제어되므로 그대로 둠 */
  }

  .model-loader {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    z-index: 99999; /* Boost z-index to ensure visibility */
    /* GPU acceleration */
    /* transform: translateZ(0); REMOVED to avoid stacking context issues */
    will-change: opacity;
  }

  .loader-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    /* GPU acceleration for smooth rendering */
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  .loading-text {
    color: white;
    font-size: 1.2rem;
    font-weight: 500;
    text-align: center;
  }

  .loading-hint {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.875rem;
    text-align: center;
    max-width: 300px;
    line-height: 1.4;
  }

  .spark {
    position: absolute;
    width: 64px; /* ← 32 → 64 픽셀로 확대  */
    height: 64px;
    background: url("/tex/spark.png") 0 0/576px 64px no-repeat;
    pointer-events: none;

    /* 캔버스(.vrm‑canvas z‑index 1)보다 높게 */
    z-index: 10; /*  1 보다만 크면 됩니다 */

    animation:
      sparkSheet 0.36s steps(9) forwards,
      scaleFade 0.36s ease-out forwards;
  }
  @keyframes sparkSheet {
    to {
      background-position-x: -576px;
    }
  }
  @keyframes scaleFade {
    0% {
      transform: scale(0.4) rotate(var(--r));
      opacity: 1;
    }
    100% {
      transform: scale(1) rotate(var(--r));
      opacity: 0;
    }
  }
</style>

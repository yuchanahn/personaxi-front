<script lang="ts">
  import { getViewer, unload, test as viewVrmInCanvas } from "$lib/vrm/test";
  import ChatWindow from "../chat/ChatWindow.svelte";
  import ChatInput from "../chat/ChatInput.svelte";
  import { handleSendToCharacter } from "$lib/services/chat";
  import type { Model } from "$lib/vrm/core/model";
  import type { Persona } from "$lib/types";
  import { onDestroy, tick } from "svelte";
  import type { Viewer } from "$lib/vrm/core/viewer";
  import Icon from "@iconify/svelte";

  import * as THREE from "three/webgpu";
  import { sparks } from "$lib/vrm/stores";

  export let persona: Persona | null;
  export let cssid: string | null = null;
  export let show: boolean = true;

  let model: Model | null;
  let listeningTimeout: ReturnType<typeof setTimeout>;

  let canvas: HTMLCanvasElement;
  let bubbleElement: HTMLDivElement;

  let viewer: Viewer | null = null;

  let isModelLoading = true;

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
    try {
      if (persona)
        viewVrmInCanvas(canvas, persona)
          .then((m) => {
            model = m;
            model?.setCanvas(canvas);
            viewer = getViewer();
            isModelLoading = false;
            updateCameraPosition();
            if (model) model.cfg = cfg;
          })
          .catch((error) => {
            console.error("Error loading VRM:", error);
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
    isModelLoading = true;
    // Use setTimeout to ensure loading UI is rendered before heavy VRM parsing starts
    // This gives the browser time to paint the loading screen (50-100ms is sufficient)
    setTimeout(() => {
      loadVrm();
    }, 100);
  }

  let isLoading = false;

  const send = async (prompt: string) => {
    if (!model || !persona) return;

    clearTimeout(listeningTimeout);
    model.stateManager?.setListening(false);
    //model.doGesture('Listening Intro.fbx');

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
      model
        .speak(audio)
        .then(() => {
          model!.stateManager?.setSpeaking(false);
        })
        .catch((error) => {
          console.error("Error speaking:", error);
        });
    } else {
      console.warn("Model not loaded yet, cannot speak.");
    }
  }
  // ▼▼▼ 카메라 컨트롤 변수 수정 ▼▼▼
  let cameraDistanceOffset = 0.2;
  let cameraHeightOffset = -0.45;
  let cameraRotationOffsetY = -8; // Y축 회전(궤도) 오프셋 추가
  let cameraRotationOffsetX = 14;

  // $: 블록을 사용해 슬라이더 값이 바뀔 때마다 카메라 위치를 즉시 업데이트
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

    // 최종 거리와 기본 높이 계산
    const finalDistance = baseDistance + cameraDistanceOffset;
    const lookAtHeight = baseHeight + cameraHeightOffset;

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
  <canvas bind:this={canvas} class="vrm-canvas"></canvas>
  {#if isModelLoading}
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
  <div class="chat-container select-none">
    <div class="chat-content">
      <ChatWindow cssid={cssid ?? ""} showChat={show} {isLoading} />
      <ChatInput onSend={send} onChangeInput={handleInputChange} />
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
    position: absolute;
    bottom: 0;
    width: 100%;
    height: 100vh;

    padding-bottom: env(safe-area-inset-bottom, 0px);

    background-color: rgba(255, 255, 255, 0);

    display: flex;
    flex-direction: column;
    z-index: 2;
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
    z-index: 1000;
    /* GPU acceleration */
    transform: translateZ(0);
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

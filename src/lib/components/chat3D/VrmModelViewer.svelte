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

  import * as THREE from "three";

  export let persona: Persona | null;
  export let cssid: string | null = null;
  export let show: boolean = false;
  let model: Model | null;

  let canvas: HTMLCanvasElement;
  let bubbleElement: HTMLDivElement;

  let viewer: Viewer | null = null;

  let isModelLoading = true;

  onDestroy(() => {
    unload();
  });

  function loadVrm() {
    try {
      if (persona)
        viewVrmInCanvas(canvas, persona)
          .then((m) => {
            model = m;
            viewer = getViewer();
            isModelLoading = false;
            updateCameraPosition();
            console.log(
              "############ \n\n\n\n model lodded! \n\n\n\n ##############",
            );
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

  $: if (persona?.id) {
    tick().then(loadVrm);
  }

  let isLoading = false;

  const send = async (prompt: string) => {
    if (!model || !persona) return;

    try {
      isLoading = true;
      cameraDistanceOffset -= 0.5;
      updateCameraPosition();
      await handleSendToCharacter(persona.id, prompt, model);
    } catch (error) {
      console.error("Error sending prompt to character:", error);
    } finally {
      cameraDistanceOffset += 0.5;
      updateCameraPosition();
      isLoading = false;
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

  let cameraDistanceOffset = -1.0; // Z축 거리 오프셋
  let cameraHeightOffset = -0.1; // Y축 높이 오프셋

  function updateCameraPosition() {
    if (!viewer || !viewer.model?.vrm) return;

    const vrm = viewer.model.vrm;
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // 기본 높이와 거리를 계산
    const baseHeight = center.y + (size.y / 2) * 0.9;
    const baseDistance = size.y * 1.5;

    // 슬라이더의 오프셋 값을 더해 최종 위치 결정
    viewer.camera.position.set(
      center.x,
      baseHeight + cameraHeightOffset,
      baseDistance + cameraDistanceOffset,
    );
    viewer.camera.lookAt(
      new THREE.Vector3(center.x, baseHeight + cameraHeightOffset, center.z),
    );
    viewer.camera.updateProjectionMatrix();
  }
</script>

<div id="character-view">
  <canvas bind:this={canvas} class="vrm-canvas"></canvas>
  {#if isModelLoading}
    <div class="model-loader">
      <Icon icon="line-md:loading-twotone-loop" width="64" height="64" />
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
  <!-- <div class="camera-controls">
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
      <span>{cameraDistanceOffset.toFixed(0.5)}</span>
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
      <span>{cameraHeightOffset.toFixed(0.4)}</span>
    </div>
  </div> -->
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

    visibility: hidden;
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
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 5;
    color: white;
  }
</style>

<script lang="ts">
  import SettingsButton from "$lib/components/common/SettingsButton.svelte";
  import SettingsModal from "$lib/components/modal/SettingModal.svelte";
  import AffectionGauge from "$lib/components/affection/AffectionGauge.svelte";
  import type { Persona } from "$lib/types";
  import { onMount, onDestroy } from "svelte";

  export let cssid: string;
  export let showChat: boolean;
  export let persona: Persona; // persona prop 추가
  export let llmType: string; // llmType prop 추가

  let isSettingsModalOpen = false;
  let affectionScore = 0; // Default

  function handleAffectionUpdate(e: CustomEvent) {
    if (e.detail.score !== undefined) {
      affectionScore = e.detail.score;
    }
  }

  onMount(() => {
    window.addEventListener(
      "affection-update",
      handleAffectionUpdate as EventListener,
    );
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener(
        "affection-update",
        handleAffectionUpdate as EventListener,
      );
    }
  });
</script>

{#if isSettingsModalOpen}
  <SettingsModal
    {persona}
    isOpen={isSettingsModalOpen}
    {llmType}
    on:close={() => (isSettingsModalOpen = false)}
  />
{/if}

<div class="affection-wrapper">
  <AffectionGauge score={affectionScore} />
</div>

<div class="control-box">
  <SettingsButton onClick={() => (isSettingsModalOpen = true)} />
  <!-- 보이기/안보이기 버튼 -->
  <button class="toggle-chat-button" on:click={() => (showChat = !showChat)}>
    {#if showChat}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        ><path
          fill="currentColor"
          d="M12 9a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3m0 8a5 5 0 0 1-5-5a5 5 0 0 1 5-5a5 5 0 0 1 5 5a5 5 0 0 1-5 5m0-12.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5"
        /></svg
      >
    {:else}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        ><mask id="lineMdWatchOff0"
          ><g
            fill="none"
            stroke="#fff"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            ><circle cx="12" cy="12" r="0" fill="#fff" stroke="none"
              ><animate
                fill="freeze"
                attributeName="r"
                dur="0.2s"
                values="0;3"
              /></circle
            ><path
              d="M4 12c1.38 -0.77 4.42 -1.3 8 -1.3c3.58 0 6.62 0.53 8 1.3c-1.38 0.77 -4.42 1.3 -8 1.3c-3.58 0 -6.62 -0.53 -8 -1.3Z"
              ><animate
                fill="freeze"
                attributeName="d"
                dur="0.5s"
                values="M4 12c1.38 -0.77 4.42 -1.3 8 -1.3c3.58 0 6.62 0.53 8 1.3c-1.38 0.77 -4.42 1.3 -8 1.3c-3.58 0 -6.62 -0.53 -8 -1.3Z;M2 12c1.72 -3.83 5.53 -6.5 10 -6.5c4.47 0 8.28 2.67 10 6.5c-1.72 3.83 -5.53 6.5 -10 6.5c-4.47 0 -8.28 -2.67 -10 -6.5Z"
              /></path
            ><path
              stroke="#000"
              stroke-dasharray="28"
              stroke-dashoffset="28"
              d="M0 11h24"
              transform="rotate(45 12 12)"
              ><animate
                fill="freeze"
                attributeName="stroke-dashoffset"
                begin="0.5s"
                dur="0.4s"
                values="28;0"
              /></path
            ><path
              stroke-dasharray="28"
              stroke-dashoffset="28"
              d="M0 13h24"
              transform="rotate(45 12 12)"
              ><animate
                fill="freeze"
                attributeName="stroke-dashoffset"
                begin="0.5s"
                dur="0.4s"
                values="28;0"
              /></path
            ></g
          ></mask
        ><rect
          width="24"
          height="24"
          fill="currentColor"
          mask="url(#lineMdWatchOff0)"
        /></svg
      >
    {/if}
  </button>
</div>

<style>
  .affection-wrapper {
    position: absolute;
    top: 70px;
    left: 20px;
    z-index: 1000;
    /* Independent positioning, no background container */
  }

  .control-box {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1000;
    display: flex;
    flex-direction: column; /* NEW: 세로 정렬 */
    gap: 10px; /* 버튼 사이 간격 */
    background-color: rgba(0, 0, 0, 0.3); /* 반투명 배경 */
    padding: 6px;
    border-radius: 6px;
    backdrop-filter: blur(5px); /* 블러 효과 */
    border: 0.5px solid rgba(255, 255, 255, 0.15); /* 테두리 */
    align-items: center; /* Center items */
  }

  .settings-button,
  .toggle-chat-button {
    background: none;
    border: none;
    color: #bdbdbd;
    font-size: 24px;
    cursor: pointer;
    transition: color 0.3s ease;
    padding: 0;
  }

  .settings-button svg,
  .toggle-chat-button svg {
    width: 32px;
    height: 32px;
  }

  .settings-button:hover,
  .toggle-chat-button:hover {
    color: #ffffff;
  }
</style>

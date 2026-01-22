<script lang="ts">
  import SettingsButton from "$lib/components/common/SettingsButton.svelte";
  import SettingsModal from "$lib/components/modal/SettingModal.svelte";
  import AffectionGauge from "$lib/components/affection/AffectionGauge.svelte";
  import type { Persona } from "$lib/types";
  import { onMount, onDestroy } from "svelte";

  export let cssid: string;
  export let showChat: boolean;
  export let persona: Persona; // persona prop 추가
  export let llmType: string;
  export let impl_connectTTS: () => void = () => {};
  export let impl_disconnectTTS: () => void = () => {};

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
    bind:showChat
    {impl_connectTTS}
    {impl_disconnectTTS}
    mode="3d"
    on:close={() => (isSettingsModalOpen = false)}
  />
{/if}

<div class="affection-wrapper">
  <AffectionGauge score={affectionScore} />
</div>

<div class="control-box">
  <SettingsButton onClick={() => (isSettingsModalOpen = true)} />
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

<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { isLocalWebHost } from "$lib/utils/appShell";
  import Icon from "@iconify/svelte";

  let isLocal = $state(false);
  let showPanel = $state(false);
  let isMinimized = $state(false);

  interface TokenMetadata {
    prompt_tokens: number;
    candidate_tokens: number;
    total_tokens: number;
    settled_cost: number;
  }

  let metadata = $state<TokenMetadata | null>(null);
  let animateTrigger = $state(false);

  function handleMetadata(e: Event) {
    const customEvent = e as CustomEvent<TokenMetadata>;
    if (customEvent.detail) {
      metadata = customEvent.detail;
      showPanel = true;

      // Trigger micro-animation on update
      animateTrigger = true;
      setTimeout(() => {
        animateTrigger = false;
      }, 500);
    }
  }

  onMount(() => {
    isLocal = isLocalWebHost();
    if (isLocal) {
      window.addEventListener("token-metadata", handleMetadata);
    }
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("token-metadata", handleMetadata);
    }
  });
</script>

{#if isLocal && showPanel}
  <div
    class="token-debug-panel"
    class:minimized={isMinimized}
    class:animate-pop={animateTrigger}
  >
    <div class="panel-header">
      <div class="header-title">
        <Icon icon="ph:cpu-fill" class="cpu-icon" />
        <span>Token Debug</span>
      </div>
      <button
        class="toggle-btn"
        onclick={() => isMinimized = !isMinimized}
        aria-label="Toggle token debug panel"
      >
        <Icon icon={isMinimized ? "ph:caret-left-bold" : "ph:caret-right-bold"} />
      </button>
    </div>

    {#if !isMinimized && metadata}
      <div class="panel-body">
        <div class="data-row">
          <span class="label">📥 Prompt</span>
          <span class="value">{metadata.prompt_tokens.toLocaleString()}</span>
        </div>
        <div class="data-row">
          <span class="label">📤 Completion</span>
          <span class="value">{metadata.candidate_tokens.toLocaleString()}</span>
        </div>
        <div class="data-divider"></div>
        <div class="data-row highlight">
          <span class="label">📊 Total</span>
          <span class="value">{metadata.total_tokens.toLocaleString()}</span>
        </div>
        <div class="data-row cost">
          <span class="label">⚡ Cost</span>
          <span class="value">{(metadata.settled_cost / 1000000).toFixed(6)} N</span>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .token-debug-panel {
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 9999;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 10px;
    width: 200px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    color: #f8fafc;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.8rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .token-debug-panel.minimized {
    width: 120px;
    padding: 6px 10px;
    background: rgba(15, 23, 42, 0.6);
  }

  .token-debug-panel.animate-pop {
    transform: scale(1.05);
    border-color: rgba(99, 102, 241, 0.8);
    box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
    user-select: none;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #a5b4fc;
  }

  :global(.token-debug-panel .cpu-icon) {
    color: #6366f1;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  .toggle-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 2px;
    border-radius: 4px;
    transition: background-color 0.2s, color 0.2s;
  }

  .toggle-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #f8fafc;
  }

  .panel-body {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .data-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 2px 0;
  }

  .label {
    color: #94a3b8;
  }

  .value {
    color: #e2e8f0;
    font-weight: 500;
  }

  .data-row.highlight .label {
    color: #cbd5e1;
    font-weight: bold;
  }

  .data-row.highlight .value {
    color: #38bdf8;
    font-weight: bold;
  }

  .data-row.cost .label {
    color: #cbd5e1;
    font-weight: bold;
  }

  .data-row.cost .value {
    color: #facc15;
    font-weight: bold;
  }
</style>

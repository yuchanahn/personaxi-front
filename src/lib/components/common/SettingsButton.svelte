<script lang="ts">
  let isSettingsModalOpen = false;

  export let onClick: () => {};
</script>

<!-- svelte-ignore a11y_consider_explicit_label -->
<button class="settings-button" on:click={onClick}>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    ><circle cx="12" cy="5" r="2" fill="currentColor" /><circle
      cx="12"
      cy="12"
      r="2"
      fill="currentColor"
    /><circle cx="12" cy="19" r="2" fill="currentColor" /></svg
  >
</button>

<style>
  .settings-button {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition:
      color 0.2s ease,
      transform 0.2s ease;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .settings-button svg {
    width: 20px;
    height: 20px;
  }

  .settings-button:hover {
    color: rgba(255, 255, 255, 0.9);
    transform: scale(1.1);
  }
</style>

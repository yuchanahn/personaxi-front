<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  import NoticeModal from "$lib/components/modal/NoticeModal.svelte";
  import { api } from "$lib/api";

  let isModalOpen = false;

  onMount(async () => {
    if (await api.isLoggedIn()) {
      goto("/hub");
      return;
    }
    isModalOpen = true;
  });
</script>

<main>
  {#if isModalOpen}
    <NoticeModal
      on:close={() => {
        isModalOpen = false;
        goto("/hub");
      }}
    />
  {/if}
</main>

<style>
</style>

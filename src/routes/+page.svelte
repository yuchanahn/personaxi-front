<script lang="ts">
  import { onMount } from "svelte";
  import { getCurrentUser, loginWithAuthKey } from "$lib/api/auth";
  import { goto } from "$app/navigation";

  import NoticeModal from "$lib/components/modal/NoticeModal.svelte";

  let isModalOpen = false;

  onMount(async () => {
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

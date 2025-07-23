<script lang="ts">
  import { onMount } from "svelte";
  import { getCurrentUser, loginWithAuthKey } from "$lib/api/auth";
  import { is_login } from "$lib/stores/user";
  import { goto } from "$app/navigation";

  import "$lib/styles/theme.css";
  import NoticeModal from "$lib/components/modal/NoticeModal.svelte";

  let isModalOpen = false;

  onMount(async () => {
    const url = new URL(window.location.href);
    const authKey = url.searchParams.get("auth_key");
    if (authKey) {
      await loginWithAuthKey(authKey);
    } else {
      isModalOpen = true;
    }
    let user = await getCurrentUser();
    if (user != null) {
      is_login.set(true);
      goto("/hub");
    }
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
  :global(body) {
    margin: 0;
    background: var(--color-bg);
    color: var(--color-text);
    font-family: "Segoe UI", sans-serif;
  }
</style>

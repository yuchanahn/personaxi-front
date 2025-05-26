<script lang="ts">
  import { onMount } from "svelte";
  import { getCurrentUser, loginWithAuthKey } from "$lib/api/auth";
  import { is_login } from "$lib/stores/user";
  import { goto } from "$app/navigation";

  import "$lib/styles/theme.css";

  onMount(async () => {
    const url = new URL(window.location.href);
    const authKey = url.searchParams.get("auth_key");
    if (authKey) {
      await loginWithAuthKey(authKey);
    }

    let user = await getCurrentUser();

    if (user != null) {
      is_login.set(true);
      goto("/personaxi-front/hub");
    }
  });
</script>

<main></main>

<style>
  :global(body) {
    margin: 0;
    background: var(--color-bg);
    color: var(--color-text);
    font-family: "Segoe UI", sans-serif;
  }
</style>

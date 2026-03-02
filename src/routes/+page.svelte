<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";

  onMount(async () => {
    // Always redirect to hub, removing the spammy NoticeModal
    goto("/hub");
  });
</script>

<main>
  <!-- Modal removed, redirects immediately -->
</main>

<style>
</style>

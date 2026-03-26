<script lang="ts">
    import Login from "$lib/components/login/login.svelte";
    import { page } from "$app/stores";

    $: postLoginPath = $page.url.searchParams.get("next") || "/hub";
</script>

<Login {postLoginPath} />

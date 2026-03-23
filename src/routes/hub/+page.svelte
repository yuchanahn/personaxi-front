<script lang="ts">
    import ContentHub from "$lib/components/portal/ContentHub.svelte";
    import { t } from "svelte-i18n";
</script>

<svelte:head>
    <title>{$t("hub.metaTitle")}</title>
    <meta
        name="description"
        content={$t("hub.metaDescription")}
    />
    <meta property="og:title" content={$t("hub.metaTitle")} />
    <meta
        property="og:description"
        content={$t("hub.metaOgDescription")}
    />
</svelte:head>

<main>
    <div class="select-none">
        <ContentHub />
    </div>
</main>

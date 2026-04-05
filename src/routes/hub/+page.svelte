<script lang="ts">
    import ContentHub from "$lib/components/portal/ContentHub.svelte";
    import { branding } from "$lib/branding/config";
</script>

<svelte:head>
    <title>Explore - {branding.publicBrandName}</title>
    <meta
        name="description"
        content={`Explore expressive AI chat experiences across 2D, Live2D, and VRM on ${branding.publicBrandName}.`}
    />
    <meta property="og:title" content={`Explore - ${branding.publicBrandName}`} />
    <meta
        property="og:description"
        content={`Explore expressive AI chat experiences across 2D, Live2D, and VRM on ${branding.publicBrandName}.`}
    />
</svelte:head>

<main>
    <div class="select-none">
        <ContentHub />
    </div>
</main>

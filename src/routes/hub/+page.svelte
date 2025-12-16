<script lang="ts">
    import ContentHub from "$lib/components/portal/ContentHub.svelte";
</script>

<svelte:head>
    <title>탐색 - PersonaXi</title>
    <meta
        name="description"
        content="다양한 AI 페르소나를 탐색하고 대화하세요. 2D, 3D, Live2D 캐릭터들이 기다립니다."
    />
    <meta property="og:title" content="탐색 - PersonaXi" />
    <meta
        property="og:description"
        content="다양한 AI 페르소나를 탐색하고 대화하세요."
    />
</svelte:head>

<main>
    <div class="select-none">
        <ContentHub />
    </div>
</main>

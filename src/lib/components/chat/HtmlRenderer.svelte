<script lang="ts">
    export let content: string;

    let htmlContent = "";
    let styleContent = "";

    const styleRegex = /<style>([\s\S]*?)<\/style>/g;

    $: {
        let styles = "";

        htmlContent = content.replace(styleRegex, (match, css) => {
            styles += css;
            return "";
        });

        styleContent = styles;
    }
</script>

<svelte:head>
    {@html `<style>${styleContent}</style>`}
</svelte:head>

<div class="narration-block">
    {@html htmlContent}
</div>

<style>
    :global(.custom-italic) {
        font-style: italic;
    }
</style>

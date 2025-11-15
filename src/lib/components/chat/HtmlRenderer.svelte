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

        htmlContent = htmlContent
            .replace(/\*(.*?)\*/g, '<i class="custom-italic">$1</i>')
            .replace(/\*\*(.?)\*\*/g, '<b class="custom-bold">$1</b>');

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
    :global(.custom-bold) {
        font-weight: bold;
    }
</style>

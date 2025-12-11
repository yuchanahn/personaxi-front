<script lang="ts">
    import DOMPurify from "isomorphic-dompurify";
    import { marked } from "marked";

    export let content: string;

    let htmlContent = "";
    let styleContent = "";

    const styleRegex = /<style>([\s\S]*?)<\/style>/g;

    $: {
        let styles = "";

        let cleanContent = content.replace(styleRegex, (match, css) => {
            styles += css;
            return "";
        });

        const parsed = marked.parse(cleanContent, {
            breaks: true,
            gfm: true,
        }) as string;

        htmlContent = DOMPurify.sanitize(parsed);

        styleContent = styles;
    }
</script>

<svelte:head>
    {@html `<style>${styleContent}</style>`}
</svelte:head>

<div class="narration-block markdown-body">
    {@html htmlContent}
</div>

<style>
    .narration-block :global(p) {
        margin: 0 0 1em 0;
    }
    .narration-block :global(ul),
    .narration-block :global(ol) {
        padding-left: 1.5em;
    }
</style>

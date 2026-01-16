<script lang="ts">
    import DOMPurify from "isomorphic-dompurify";
    import { marked } from "marked";
    import TypewriterHtml from "../common/TypewriterHtml.svelte";
    import { createEventDispatcher } from "svelte";

    export let content: string;
    export let typewriter: boolean = false;
    export let active: boolean = true;
    export let instant: boolean = false;

    const dispatch = createEventDispatcher();

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
    {#if typewriter}
        <TypewriterHtml
            content={htmlContent}
            speed={30}
            {active}
            {instant}
            on:complete={() => dispatch("complete")}
            on:type={() => dispatch("type")}
        />
    {:else}
        {@html htmlContent}
    {/if}
</div>

<!-- 
<style>
    @import url("https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap");
    .narration-block {
        font-family: "Gowun Batang", "Batang", serif;
        line-height: 1.8;
        color: #f0e6d2;
        letter-spacing: -0.03em;
        word-break: keep-all;
    }

    .narration-block :global(p) {
        margin: 0 0 1.2em 0;
        text-align: justify;
    }

    .narration-block :global(strong),
    .narration-block :global(b) {
        color: #ffd700;
        font-weight: 700;
        text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);
    }
    .narration-block :global(ul),
    .narration-block :global(ol) {
        padding-left: 1.2em;
        margin-bottom: 1.2em;
        background: rgba(0, 0, 0, 0.2);
        padding: 1rem 1rem 1rem 2rem;
        border-left: 3px solid #8b6c42;
        border-radius: 0 4px 4px 0;
    }
    .narration-block :global(li) {
        margin-bottom: 0.5em;
        list-style-type: none;
        position: relative;
    }
    .narration-block :global(li)::before {
        content: "✦";
        position: absolute;
        left: -1.2em;
        color: #d4af37;
    }
</style> -->

<style>
    .narration-block {
        font-family: "Pretendard", "Batang", serif;
        font-size: 0.97rem;
        color: var(--text-color);
    }

    .narration-block :global(p) {
        margin: 0 0 1em 0;
    }
    .narration-block :global(ul),
    .narration-block :global(ol) {
        padding-left: 1.5em;
    }
</style>

<script lang="ts">
    import DOMPurify from "isomorphic-dompurify";
    import { marked } from "marked";

    export let content: string;

    let prevContent = "";
    let htmlContent = "";
    let styleContent = "";

    const styleRegex = /<style>([\s\S]*?)<\/style>/g;

    $: if (content !== prevContent) {
        prevContent = content;
    }

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

    $: if (typeof document !== "undefined" && styleContent) {
        const styleId = "markdown-dynamic-style";
        let styleEl = document.getElementById(styleId);

        if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }

        styleEl.textContent = styleContent;
    }
</script>

<div class="narration-block markdown-body">
    {@html htmlContent}
</div>

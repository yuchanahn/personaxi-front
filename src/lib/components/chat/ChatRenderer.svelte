<script lang="ts">
    import DOMPurify from "isomorphic-dompurify";
    import { marked } from "marked";
    import { onDestroy } from "svelte";

    export let content: string;
    export let isMessage: boolean = false;

    let prevContent = "";
    let htmlContent = "";
    let styleContent = "";

    // Unique style ID per component instance to avoid collisions
    const styleId = `chat-dynamic-style-${Math.random().toString(36).slice(2, 9)}`;

    const styleRegex = /<style>([\s\S]*?)<\/style>/g;
    const rawHtmlRegex =
        /<(div|table|thead|tbody|tr|td|th|p|span|section|article|header|footer|main|aside|blockquote|ul|ol|li|h[1-6]|br)\b/i;

    // Only re-parse when content actually changes — prevents redundant marked+DOMPurify during typing
    $: if (content !== prevContent) {
        prevContent = content;

        let styles = "";

        let cleanContent = content.replace(styleRegex, (match, css) => {
            styles += css;
            return "";
        });

        const shouldBypassMarkdown = rawHtmlRegex.test(cleanContent);

        if (shouldBypassMarkdown) {
            htmlContent = DOMPurify.sanitize(cleanContent, {
                USE_PROFILES: { html: true },
            });
        } else {
            const parsed = marked.parse(cleanContent, {
                breaks: true,
                gfm: true,
            }) as string;

            htmlContent = DOMPurify.sanitize(parsed, {
                USE_PROFILES: { html: true },
            });
        }

        styleContent = styles;
    }

    $: if (typeof document !== "undefined") {
        let styleEl = document.getElementById(styleId);

        if (styleContent) {
            if (!styleEl) {
                styleEl = document.createElement("style");
                styleEl.id = styleId;
                document.head.appendChild(styleEl);
            }
            styleEl.textContent = styleContent;
        } else if (styleEl) {
            // No styles → remove the tag
            styleEl.remove();
        }
    }

    // Cleanup: remove injected style when component is destroyed
    onDestroy(() => {
        if (typeof document !== "undefined") {
            const el = document.getElementById(styleId);
            if (el) el.remove();
        }
    });
</script>

<div class={isMessage ? "message" : "narration-block markdown-body"}>
    {@html htmlContent}
</div>

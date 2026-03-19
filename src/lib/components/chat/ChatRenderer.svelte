<script lang="ts">
    import DOMPurify from "isomorphic-dompurify";
    import { marked } from "marked";
    import { onDestroy } from "svelte";

    export let content: string;
    export let isMessage: boolean = false;
    export let wrapperClass: string = "";

    let prevContent = "";
    let htmlContent = "";
    let styleContent = "";
    let containsStructuralHtml = false;
    let containsMarkdownSyntax = false;
    let shouldPreferRawHtml = false;

    // Unique style ID per component instance to avoid collisions
    const styleId = `chat-dynamic-style-${Math.random().toString(36).slice(2, 9)}`;

    const styleRegex = /<style>([\s\S]*?)<\/style>/g;
    const structuralHtmlRegex =
        /<(div|section|article|header|footer|main|aside|table|thead|tbody|tr|td|th|ul|ol|li|form|button|input|select|textarea|figure|figcaption|details|summary|blockquote|h[1-6])\b/i;
    const markdownSyntaxRegex =
        /(\*\*|__|`{1,3}|!\[[^\]]*?\]\([^)]+?\)|\[[^\]]+?\]\([^)]+?\)|^\s*[-*+]\s+|^\s*\d+\.\s+|^>\s+)/m;
    // Only re-parse when content actually changes — prevents redundant marked+DOMPurify during typing
    $: if (content !== prevContent) {
        prevContent = content;

        let styles = "";

        let cleanContent = content.replace(styleRegex, (match, css) => {
            styles += css;
            return "";
        });

        containsStructuralHtml = structuralHtmlRegex.test(cleanContent);
        containsMarkdownSyntax = markdownSyntaxRegex.test(cleanContent);
        shouldPreferRawHtml = containsStructuralHtml && !containsMarkdownSyntax;

        if (shouldPreferRawHtml) {
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

    $: effectiveWrapperClass = [
        wrapperClass,
        !isMessage && containsStructuralHtml ? "px-narration--html" : "",
    ]
        .filter(Boolean)
        .join(" ");
</script>

<div
    class={isMessage
        ? `message ${effectiveWrapperClass}`.trim()
        : `narration-block markdown-body ${effectiveWrapperClass}`.trim()}
>
    {@html htmlContent}
</div>

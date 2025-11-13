<script lang="ts">
    export let content: string;

    let htmlContent = "";
    let styleContent = "";

    // <style> 태그와 그 안의 내용을 찾는 정규식
    const styleRegex = /<style>([\s\S]*?)<\/style>/g;

    $: {
        let styles = "";

        // 1. content가 변경될 때마다 (스트리밍)
        //    <style> 태그를 찾아서 styleContent를 만들고,
        //    HTML 본문에서는 <style> 태그를 제거합니다.
        htmlContent = content.replace(styleRegex, (match, css) => {
            styles += css;
            return ""; // HTML 본문에서 <style> 태그 제거
        });

        // 2. Kintsugi가 생성하는 *이탤릭* 이나 줄바꿈 등을 처리합니다.
        //    (기존 applyInlineStyles 로직)
        htmlContent = htmlContent
            .replace(/\*(.*?)\*/g, '<i class="custom-italic">$1</i>')
            .replace(/\n/g, "<br>");

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
    .narration-block {
        align-self: center;
        width: 100%;
        max-width: 90%;
        text-align: center;
        font-style: italic;
        color: var(--muted-foreground);
        line-height: 1.6;
        white-space: pre-wrap;
    }

    /* {@html} 내부에서 사용되는 클래스는 :global로 선언해야 합니다. */
    :global(.custom-italic) {
        font-style: italic;
    }
</style>

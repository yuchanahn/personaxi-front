<script>
    import { locale, t } from "svelte-i18n";
    import { marked } from "marked";
    import { get } from "svelte/store";

    let termsContent = "";

    let loc = get(locale) || "en";

    import(`$lib/i18n/locales/${loc}/terms.md?raw`)
        .then(async (module) => {
            termsContent = await marked(module.default);
        })
        .catch((error) => {
            console.error("Error loading terms.md:", error);
            termsContent = $t("terms.loadError");
        });
</script>

<svelte:head>
    <title>{$t("terms.pageTitle")}</title>
</svelte:head>

<div class="terms-container">
    {@html termsContent}
</div>

<style>
    .terms-container {
        max-width: 800px;
        margin: 40px auto;
        padding: 40px;
        background-color: var(--card);
        border: 1px solid var(--border-card);
        border-radius: var(--radius-card);
        line-height: 1.8;
        color: var(--foreground);
    }

    /* Markdown Element Styles (Global) */
    .terms-container :global(h1) {
        font-size: 2.25em;
        font-weight: 800;
        margin-bottom: 30px;
        color: var(--foreground);
        border-bottom: 2px solid var(--border);
        padding-bottom: 10px;
    }

    .terms-container :global(h2) {
        font-size: 1.8em;
        font-weight: 700;
        margin-top: 40px;
        margin-bottom: 20px;
        color: var(--foreground);
    }

    .terms-container :global(h3) {
        font-size: 1.4em;
        font-weight: 600;
        margin-top: 30px;
        margin-bottom: 15px;
        color: var(--foreground);
        opacity: 0.9;
    }

    .terms-container :global(p) {
        margin-bottom: 16px;
        color: var(--muted-foreground);
    }

    .terms-container :global(ul),
    .terms-container :global(ol) {
        margin-bottom: 20px;
        padding-left: 24px;
        color: var(--muted-foreground);
    }

    .terms-container :global(li) {
        margin-bottom: 8px;
    }

    .terms-container :global(ul) {
        list-style-type: disc;
    }

    .terms-container :global(ol) {
        list-style-type: decimal;
    }

    .terms-container :global(a) {
        color: var(--primary);
        text-decoration: none;
    }

    .terms-container :global(a:hover) {
        text-decoration: underline;
    }

    .terms-container :global(table) {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        border: 1px solid var(--border);
    }

    .terms-container :global(th),
    .terms-container :global(td) {
        padding: 12px;
        border: 1px solid var(--border);
        text-align: left;
        font-size: 0.95em;
    }

    .terms-container :global(th) {
        background-color: var(--muted);
        font-weight: 600;
        color: var(--foreground);
    }

    .terms-container :global(blockquote) {
        border-left: 4px solid var(--primary);
        padding-left: 16px;
        margin: 20px 0;
        color: var(--muted-foreground);
        font-style: italic;
    }
</style>

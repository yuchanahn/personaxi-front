<script>
    import { t, locale } from "svelte-i18n";
    import { marked } from "marked";
    import { get } from "svelte/store";

    let licensesContent = "";

    let loc = get(locale) || "en";

    import(`$lib/i18n/locales/${loc}/licenses.md?raw`)
        .then(async (module) => {
            licensesContent = await marked(module.default);
        })
        .catch((error) => {
            console.error("Error loading licenses.md:", error);
            licensesContent = $t("licenses.loadError");
        });
</script>

<svelte:head>
    <title>{$t("licenses.pageTitle")}</title>
</svelte:head>

<div class="licenses-container">
    {@html licensesContent}
</div>

<style>
    .licenses-container {
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
    .licenses-container :global(h1) {
        font-size: 2.25em;
        font-weight: 800;
        margin-bottom: 30px;
        color: var(--foreground);
        border-bottom: 2px solid var(--border);
        padding-bottom: 10px;
    }

    .licenses-container :global(h2) {
        font-size: 1.8em;
        font-weight: 700;
        margin-top: 40px;
        margin-bottom: 20px;
        color: var(--foreground);
    }

    .licenses-container :global(h3) {
        font-size: 1.4em;
        font-weight: 600;
        margin-top: 30px;
        margin-bottom: 15px;
        color: var(--foreground);
        opacity: 0.9;
    }

    .licenses-container :global(p) {
        margin-bottom: 16px;
        color: var(--muted-foreground);
    }

    .licenses-container :global(ul),
    .licenses-container :global(ol) {
        margin-bottom: 20px;
        padding-left: 24px;
        color: var(--muted-foreground);
    }

    .licenses-container :global(li) {
        margin-bottom: 8px;
    }

    .licenses-container :global(ul) {
        list-style-type: disc;
    }

    .licenses-container :global(ol) {
        list-style-type: decimal;
    }

    .licenses-container :global(a) {
        color: var(--primary);
        text-decoration: none;
    }

    .licenses-container :global(a:hover) {
        text-decoration: underline;
    }

    .licenses-container :global(table) {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        border: 1px solid var(--border);
    }

    .licenses-container :global(th),
    .licenses-container :global(td) {
        padding: 12px;
        border: 1px solid var(--border);
        text-align: left;
        font-size: 0.95em;
    }

    .licenses-container :global(th) {
        background-color: var(--muted);
        font-weight: 600;
        color: var(--foreground);
    }

    .licenses-container :global(blockquote) {
        border-left: 4px solid var(--primary);
        padding-left: 16px;
        margin: 20px 0;
        color: var(--muted-foreground);
        font-style: italic;
    }
</style>

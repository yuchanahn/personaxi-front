<script>
    import { locale, t } from "svelte-i18n";
    import { marked } from "marked";
    import { get } from "svelte/store";

    let refundContent = "";

    let loc = get(locale) || "en";

    // Load refund.md based on locale
    import(`$lib/i18n/locales/${loc}/refund.md?raw`)
        .then(async (module) => {
            refundContent = await marked(module.default);
        })
        .catch((error) => {
            console.error("Error loading refund.md:", error);
            refundContent = `<p>${$t("terms.loadError", { default: "Failed to load content." })}</p>`;
        });
</script>

<svelte:head>
    <title>{$t("legal.refundPolicy", { default: "Refund Policy" })}</title>
</svelte:head>

<div class="policy-container">
    {@html refundContent}
</div>

<style>
    .policy-container {
        max-width: 800px;
        margin: 40px auto;
        padding: 40px;
        background-color: var(--card);
        border: 1px solid var(--border-card);
        border-radius: var(--radius-card);
        line-height: 1.8;
        color: var(--foreground);
    }

    /* Markdown Styles */
    .policy-container :global(h1) {
        font-size: 2.25em;
        font-weight: 800;
        margin-bottom: 30px;
        color: var(--foreground);
        border-bottom: 2px solid var(--border);
        padding-bottom: 10px;
    }

    .policy-container :global(h2) {
        font-size: 1.8em;
        font-weight: 700;
        margin-top: 40px;
        margin-bottom: 20px;
        color: var(--foreground);
    }

    .policy-container :global(h3) {
        font-size: 1.4em;
        font-weight: 600;
        margin-top: 30px;
        margin-bottom: 15px;
        color: var(--foreground);
        opacity: 0.9;
    }

    .policy-container :global(p) {
        margin-bottom: 16px;
        color: var(--muted-foreground);
    }

    .policy-container :global(ul),
    .policy-container :global(ol) {
        margin-bottom: 20px;
        padding-left: 24px;
        color: var(--muted-foreground);
    }

    .policy-container :global(li) {
        margin-bottom: 8px;
    }

    .policy-container :global(ul) {
        list-style-type: disc;
    }

    .policy-container :global(ol) {
        list-style-type: decimal;
    }

    .policy-container :global(strong) {
        font-weight: 700;
        color: var(--foreground);
    }
</style>

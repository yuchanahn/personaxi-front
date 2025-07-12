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
        padding: 20px;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        line-height: 1.8;
        color: #333;
    }
    h2 {
        color: #2c3e50;
        font-size: 2em;
        margin-top: 30px;
        margin-bottom: 15px;
        border-bottom: 2px solid #eee;
        padding-bottom: 5px;
    }
    h3 {
        color: #34495e;
        font-size: 1.5em;
        margin-top: 25px;
        margin-bottom: 10px;
    }
    p,
    ul {
        margin-bottom: 15px;
    }
    ul {
        list-style-type: disc;
        margin-left: 20px;
    }
</style>

<script>
    import { locale, t } from "svelte-i18n";
    import { marked } from "marked";
    import { get } from "svelte/store";

    let policyContent = "";
    let loc = get(locale) || "en";

    import(`$lib/i18n/locales/${loc}/policy.md?raw`)
        .then(async (module) => {
            policyContent = await marked(module.default);
        })
        .catch((error) => {
            console.error("Error loading policy.md:", error);
            policyContent = $t("policy.loadError");
        });
</script>

<svelte:head>
    <title>{$t("policy.pageTitle")}</title>
</svelte:head>

<div class="policy-container">
    {@html policyContent}
</div>

<style>
    .policy-container {
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
    ul ul {
        list-style-type: circle;
        margin-left: 20px;
    }
    a {
        color: #007bff;
        text-decoration: none;
    }
    a:hover {
        text-decoration: underline;
    }
</style>

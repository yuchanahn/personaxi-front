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
        padding: 20px;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        line-height: 1.8;
        color: #333;
    }
</style>

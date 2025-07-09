<script>
    import { t } from "svelte-i18n";
    import { marked } from "marked";

    let licensesContent = "";

    import("$lib/i18n/locales/ko/licenses.md?raw")
        .then((module) => {
            licensesContent = marked(module.default);
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
    h1 {
        color: #2c3e50;
        font-size: 2.5em;
        margin-bottom: 20px;
        text-align: center;
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
    .vrm-model-card {
        border: 1px solid #eee;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        background-color: #f9f9f9;
    }
    a {
        color: #007bff;
        text-decoration: none;
    }
    a:hover {
        text-decoration: underline;
    }
    hr {
        border: 0;
        height: 1px;
        background: #eee;
        margin: 30px 0;
    }
</style>
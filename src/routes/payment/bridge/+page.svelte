<script lang="ts">
    import { t } from "svelte-i18n";

    const error = "Payment bridge is disabled in this build.";
</script>

<div class="container">
    <div class="error">
        <p>{error}</p>
        <button on:click={() => window.close()}>
            {$t("common.close", { default: "Close" })}
        </button>
    </div>
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100dvh; /* Use dynamic viewport height for mobile */
        background-color: #1a1a1a;
        color: white;
        text-align: center;
        font-family: sans-serif;
    }
    .error {
        color: #ff4444;
    }
    button {
        margin-top: 20px;
        padding: 10px 20px;
        background: #333;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }
</style>

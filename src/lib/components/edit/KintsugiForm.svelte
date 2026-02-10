<script lang="ts">
    import { t } from "svelte-i18n";

    export let k_description: string;
    export let k_personality: string;
    export let k_userPersona: string;
    export let k_scenario: string;
</script>

<div class="kintsugi-fields">
    <div class="form-group">
        <label for="k-description"
            >{$t("editPage.kintsugi.descriptionLabel")}</label
        >
        <p class="description">
            {$t("editPage.kintsugi.descriptionDesc")}
        </p>
        <textarea
            id="k-description"
            bind:value={k_description}
            placeholder={$t("editPage.kintsugi.descriptionPlaceholder")}
            rows="5"
            maxlength="1000"
        ></textarea>
        <div
            class="char-counter"
            class:warning={k_description.length > 900}
            class:error={k_description.length >= 1000}
        >
            {k_description.length} / 1000
        </div>
    </div>
    <div class="form-group">
        <label for="k-personality"
            >{$t("editPage.kintsugi.personalityLabel")}</label
        >
        <p class="description">
            {$t("editPage.kintsugi.personalityDesc")}
        </p>
        <textarea
            id="k-personality"
            bind:value={k_personality}
            placeholder={$t("editPage.kintsugi.personalityPlaceholder")}
            rows="5"
            maxlength="1000"
        ></textarea>
        <div
            class="char-counter"
            class:warning={k_personality.length > 900}
            class:error={k_personality.length >= 1000}
        >
            {k_personality.length} / 1000
        </div>
    </div>
    <div class="form-group">
        <label for="k-userPersona"
            >{$t("editPage.kintsugi.userPersonaLabel")}</label
        >
        <p class="description">
            {$t("editPage.kintsugi.userPersonaDesc")}
        </p>
        <textarea
            id="k-userPersona"
            bind:value={k_userPersona}
            placeholder={$t("editPage.kintsugi.userPersonaPlaceholder")}
            rows="5"
            maxlength="800"
        ></textarea>
        <div
            class="char-counter"
            class:warning={k_userPersona.length > 700}
            class:error={k_userPersona.length >= 800}
        >
            {k_userPersona.length} / 800
        </div>
    </div>
    <div class="form-group">
        <label for="k-scenario">
            {$t("editPage.kintsugi.scenarioLabel")}
        </label>
        <p class="description">
            {$t("editPage.kintsugi.scenarioDesc")}
        </p>
        <textarea
            id="k-scenario"
            bind:value={k_scenario}
            placeholder={$t("editPage.kintsugi.scenarioPlaceholder")}
            rows="2"
            maxlength="200"
        ></textarea>
        <div
            class="char-counter"
            class:warning={k_scenario.length > 180}
            class:error={k_scenario.length >= 200}
        >
            {k_scenario.length} / 200
        </div>
    </div>
</div>

<style>
    .kintsugi-fields {
        border-top: 1px solid var(--border);
        padding-top: 1.5rem;
    }
    .kintsugi-fields .form-group:last-child {
        margin-bottom: 0;
    }
    .kintsugi-fields label {
        font-weight: 600;
    }
    .kintsugi-fields p.description {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        margin-top: -0.25rem;
        margin-bottom: 0.75rem;
    }
    .form-group {
        margin-bottom: 1.5rem;
    }
    textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-input);
        background: var(--input);
        color: var(--foreground);
        box-sizing: border-box;
        transition:
            border-color 0.2s,
            box-shadow 0.2s;
    }
    textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 2px var(--ring);
    }
    .char-counter {
        font-size: 0.8rem;
        color: var(--muted-foreground);
        text-align: right;
        margin-top: 0.25rem;
    }
    .char-counter.warning {
        color: orange;
    }
    .char-counter.error {
        color: var(--destructive);
    }
</style>

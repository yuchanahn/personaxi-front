<script lang="ts">
    import { t } from "svelte-i18n";
    import {
        formatWeightedCharCount,
        getWeightedRawMaxLength,
        getWeightedCharCount,
        isWeightedLimitReached,
    } from "$lib/utils/weightedText";

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
            maxlength={getWeightedRawMaxLength(k_description, 1000)}
        ></textarea>
        <div
            class="char-counter"
            class:warning={getWeightedCharCount(k_description) > 900}
            class:error={isWeightedLimitReached(k_description, 1000)}
        >
            {formatWeightedCharCount(k_description)} / 1000
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
            maxlength={getWeightedRawMaxLength(k_personality, 1000)}
        ></textarea>
        <div
            class="char-counter"
            class:warning={getWeightedCharCount(k_personality) > 900}
            class:error={isWeightedLimitReached(k_personality, 1000)}
        >
            {formatWeightedCharCount(k_personality)} / 1000
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
            maxlength={getWeightedRawMaxLength(k_userPersona, 800)}
        ></textarea>
        <div
            class="char-counter"
            class:warning={getWeightedCharCount(k_userPersona) > 700}
            class:error={isWeightedLimitReached(k_userPersona, 800)}
        >
            {formatWeightedCharCount(k_userPersona)} / 800
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
            maxlength={getWeightedRawMaxLength(k_scenario, 200)}
        ></textarea>
        <div
            class="char-counter"
            class:warning={getWeightedCharCount(k_scenario) > 180}
            class:error={isWeightedLimitReached(k_scenario, 200)}
        >
            {formatWeightedCharCount(k_scenario)} / 200
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

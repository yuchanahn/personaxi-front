<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { settings } from "$lib/stores/settings";
    import {
        formatWeightedCharCount,
        getWeightedRawMaxLength,
        getWeightedCharCount,
        isWeightedLimitReached,
    } from "$lib/utils/weightedText";
    import type { Persona } from "$lib/types";

    export let persona: Persona;

    function toggleAdult() {
        if (persona.tags.includes("1003")) {
            persona.tags = persona.tags.filter((id) => id !== "1003");
        } else {
            persona.tags = [...persona.tags, "1003"];
        }
    }
</script>

<div class="step-basic">
    <!-- Character Name -->
    <div class="field-group">
        <label for="e3-name" class="field-label">
            <Icon icon="ph:text-aa-duotone" width="18" />
            {persona.contentType === "story"
                ? $t("editPage.storyNameLabel")
                : $t("editPage.nameLabel")}
            <span class="required">*</span>
        </label>
        <input
            id="e3-name"
            type="text"
            class="field-input"
            bind:value={persona.name}
            required
            placeholder={persona.contentType === "story"
                ? $t("editPage.storyNamePlaceholder")
                : $t("editPage.namePlaceholder")}
            maxlength="50"
        />
    </div>

    <!-- One-Liner -->
    <div class="field-group">
        <label for="e3-oneliner" class="field-label">
            <Icon icon="ph:quotes-duotone" width="18" />
            {persona.contentType === "story"
                ? $t("editPage.storyOneLinerLabel")
                : $t("editPage.oneLinerLabel")}
        </label>
        <p class="field-hint">
            {$t("edit3.basicInfo.oneLinerHint")}
        </p>
        <input
            id="e3-oneliner"
            type="text"
            class="field-input"
            bind:value={persona.one_liner}
            placeholder={$t("editPage.oneLinerPlaceholder")}
            maxlength={getWeightedRawMaxLength(persona.one_liner, 60)}
        />
        <div
            class="char-counter"
            class:warning={getWeightedCharCount(persona.one_liner) > 50}
            class:error={isWeightedLimitReached(persona.one_liner, 60)}
        >
            {formatWeightedCharCount(persona.one_liner)}/60
        </div>
    </div>

    <!-- Greeting -->
    <div class="field-group">
        <label for="e3-greeting" class="field-label">
            <Icon icon="ph:hand-waving-duotone" width="18" />
            {$t("editPage.greetingLabel")}
            <span class="required">*</span>
        </label>
        <p class="field-hint">{$t("edit3.basicInfo.greetingHint")}</p>
        <textarea
            id="e3-greeting"
            class="field-textarea"
            bind:value={persona.greeting}
            placeholder={$t("editPage.greetingPlaceholder")}
            maxlength={getWeightedRawMaxLength(persona.greeting, 200)}
            rows="3"
        ></textarea>
        <div
            class="char-counter"
            class:warning={getWeightedCharCount(persona.greeting) > 160}
            class:error={isWeightedLimitReached(persona.greeting, 200)}
        >
            {formatWeightedCharCount(persona.greeting)} / 200
        </div>
    </div>

    <!-- Visibility -->
    <div class="field-group">
        <label class="field-label">
            <Icon icon="ph:eye-duotone" width="18" />
            {$t("editPage.visibilityLabel")}
        </label>
        <div class="visibility-toggle">
            <button
                class="vis-btn"
                class:active={persona.visibility === "public"}
                on:click={() => (persona.visibility = "public")}
            >
                <Icon icon="ph:globe-duotone" width="20" />
                <div class="vis-text">
                    <span class="vis-label">{$t("editPage.public")}</span>
                    <span class="vis-desc">{$t("editPage.publicDesc")}</span>
                </div>
            </button>
            <button
                class="vis-btn"
                class:active={persona.visibility === "link"}
                on:click={() => (persona.visibility = "link")}
            >
                <Icon icon="ph:link-duotone" width="20" />
                <div class="vis-text">
                    <span class="vis-label">{$t("editPage.linkPublic")}</span>
                    <span class="vis-desc">{$t("editPage.linkPublicDesc")}</span>
                </div>
            </button>
            <button
                class="vis-btn"
                class:active={persona.visibility === "private"}
                on:click={() => (persona.visibility = "private")}
            >
                <Icon icon="ph:lock-duotone" width="20" />
                <div class="vis-text">
                    <span class="vis-label">{$t("editPage.private")}</span>
                    <span class="vis-desc">{$t("editPage.privateDesc")}</span>
                </div>
            </button>
        </div>
    </div>

    <!-- Adult Rating Toggle (Only when Safety Filter is OFF) -->
    {#if !$settings.safetyFilterOn}
        <div class="field-group">
            <label class="field-label">
                <Icon icon="ph:warning-octagon-duotone" width="18" />
                {$t("editPage.adultContentLabel")}
            </label>
            <p class="field-hint">
                {$t("editPage.adultContentDesc")}
            </p>
            <div class="visibility-toggle">
                <button
                    class="vis-btn"
                    class:active={!persona.tags.includes("1003")}
                    on:click={() => {
                        if (persona.tags.includes("1003")) {
                            toggleAdult();
                        }
                    }}
                >
                    <Icon icon="ph:baby-duotone" width="20" />
                    <div class="vis-text">
                        <span class="vis-label">{$t("editPage.allAges")}</span>
                        <span class="vis-desc"
                            >{$t("editPage.allAgesDesc")}</span
                        >
                    </div>
                </button>
                <button
                    class="vis-btn"
                    class:active={persona.tags.includes("1003")}
                    class:danger-active={persona.tags.includes("1003")}
                    on:click={() => {
                        if (!persona.tags.includes("1003")) {
                            toggleAdult();
                        }
                    }}
                >
                    <Icon icon="ph:warning-octagon-duotone" width="20" />
                    <div class="vis-text">
                        <span class="vis-label">{$t("editPage.adult")}</span>
                        <span class="vis-desc">{$t("editPage.adultDesc")}</span>
                    </div>
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    .step-basic {
        display: flex;
        flex-direction: column;
        gap: 1.75rem;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .field-label {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--foreground);
    }

    .required {
        color: var(--destructive);
    }

    .field-hint {
        font-size: 0.82rem;
        color: var(--muted-foreground);
        margin: 0;
        line-height: 1.4;
    }

    .field-input {
        padding: 0.85rem 1rem;
        border-radius: 12px;
        border: 1.5px solid var(--border);
        background: var(--input);
        color: var(--foreground);
        font-size: 0.95rem;
        transition: all 0.2s;
        width: 100%;
        box-sizing: border-box;
    }

    .field-input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px hsla(var(--primary-hsl, 0 0% 50%) / 0.12);
    }

    .field-textarea {
        padding: 0.85rem 1rem;
        border-radius: 12px;
        border: 1.5px solid var(--border);
        background: var(--input);
        color: var(--foreground);
        font-size: 0.95rem;
        resize: vertical;
        min-height: 80px;
        font-family: inherit;
        transition: all 0.2s;
        width: 100%;
        box-sizing: border-box;
    }

    .field-textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px hsla(var(--primary-hsl, 0 0% 50%) / 0.12);
    }

    .char-counter {
        font-size: 0.78rem;
        color: var(--muted-foreground);
        text-align: right;
    }
    .char-counter.warning {
        color: orange;
    }
    .char-counter.error {
        color: var(--destructive);
    }

    /* ── Visibility Toggle ── */
    .visibility-toggle {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
    }

    .vis-btn {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        border-radius: 12px;
        border: 2px solid var(--border);
        background: var(--card);
        cursor: pointer;
        transition: all 0.2s ease;
        color: var(--muted-foreground);
        text-align: left;
    }

    .vis-btn:hover {
        border-color: var(--primary);
        transform: translateY(-1px);
    }

    .vis-btn.active {
        border-color: var(--primary);
        background: hsla(var(--primary-hsl, 0 0% 50%) / 0.08);
        color: var(--foreground);
    }

    .vis-btn.danger-active {
        border-color: var(--destructive);
        background: hsla(0, 80%, 50%, 0.08);
        color: var(--foreground);
    }

    .vis-text {
        display: flex;
        flex-direction: column;
    }

    .vis-label {
        font-weight: 700;
        font-size: 0.9rem;
        color: inherit;
    }

    .vis-desc {
        font-size: 0.75rem;
        color: var(--muted-foreground);
    }

    @media (max-width: 400px) {
        .visibility-toggle {
            grid-template-columns: 1fr;
        }
    }
</style>

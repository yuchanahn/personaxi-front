<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { onMount } from "svelte";
    import type { Persona } from "$lib/types";

    export let persona: Persona;
    export let previousPersonaType: string = "";

    function toggleTag(tagId: string) {
        if (persona.tags.includes(tagId)) {
            persona.tags = persona.tags.filter((id) => id !== tagId);
        } else {
            // R18 system tag (1003) is exempt from the 3-tag limit
            persona.tags = [...persona.tags, tagId];
        }
    }
</script>

<div class="form-section-card">
    <h2>{$t("editPage.basicInfo")}</h2>
    <div class="form-group">
        <label for="name">
            {persona.contentType === "story"
                ? $t("editPage.storyNameLabel")
                : $t("editPage.nameLabel")}
        </label>
        <input
            id="name"
            bind:value={persona.name}
            required
            placeholder={persona.contentType === "story"
                ? $t("editPage.storyNamePlaceholder")
                : $t("editPage.namePlaceholder")}
        />
    </div>
    <div class="form-group">
        <label for="one_liner">
            {persona.contentType === "story"
                ? $t("editPage.storyOneLinerLabel")
                : $t("editPage.oneLinerLabel")}
        </label>
        <p class="description">
            {persona.contentType === "story"
                ? $t("editPage.storyOneLinerDescription")
                : $t("editPage.oneLinerDescription")}
        </p>
        <input
            id="one_liner"
            placeholder={persona.contentType === "story"
                ? $t("editPage.oneLinerPlaceholder")
                : $t("editPage.oneLinerPlaceholder")}
            bind:value={persona.one_liner}
            maxlength="60"
            class="input-field"
        />
        <div
            class="char-counter {(persona.one_liner || '').length > 60
                ? 'error'
                : ''}"
        >
            {(persona.one_liner || "").length}/60
        </div>
    </div>
    <div class="form-group">
        <label for="greeting"
            >{$t("editPage.greetingLabel", {
                default: $t("editPage.greetingLabelDefault"),
            })}</label
        >
        <p class="description">
            {$t("editPage.greetingDescription", {
                default: $t("editPage.greetingDescriptionDefault"),
            })}
        </p>
        <textarea
            id="greeting"
            bind:value={persona.greeting}
            placeholder={$t("editPage.greetingPlaceholder", {
                default: $t("editPage.greetingPlaceholderDefault"),
            })}
            rows="3"
            maxlength="200"
        ></textarea>
        <div
            class="char-counter"
            class:warning={persona.greeting.length > 160}
            class:error={persona.greeting.length >= 200}
        >
            {persona.greeting.length} / 200
        </div>
    </div>
    <div class="form-group">
        <label for="personaType">{$t("editPage.typeLabel")}</label>
        <select
            id="personaType"
            bind:value={persona.personaType}
            on:change={() => {
                if (
                    (previousPersonaType === "3D" ||
                        previousPersonaType === "2.5D") &&
                    persona.personaType === "2D"
                ) {
                    persona.first_scene = "";
                }
                previousPersonaType = persona.personaType;
            }}
            required
        >
            <option value="" disabled>{$t("editPage.typeSelectDefault")}</option
            >
            <option value="2D">Chat</option>
            {#if persona.contentType !== "story"}
                <option value="2.5D">Live2D(beta)</option>
                <option value="3D">3D(beta)</option>
            {/if}
        </select>
    </div>

    <div class="form-group">
        <label for="visibility">{$t("editPage.visibilityLabel")}</label>
        <div class="content-type-selector">
            <button
                class:active={persona.visibility === "public"}
                on:click={() => (persona.visibility = "public")}
                type="button"
            >
                <Icon icon="ph:globe-duotone" width="24" />
                <div class="text">
                    <span class="title">{$t("editPage.public")}</span>
                    <span class="desc"
                        >{$t("editPage.publicDesc", {
                            default: "Anyone can see and chat",
                        })}</span
                    >
                </div>
            </button>
            <button
                class:active={persona.visibility === "private"}
                on:click={() => (persona.visibility = "private")}
                type="button"
            >
                <Icon icon="ph:lock-key-duotone" width="24" />
                <div class="text">
                    <span class="title">{$t("editPage.private")}</span>
                    <span class="desc"
                        >{$t("editPage.privateDesc", {
                            default: "Only you can access",
                        })}</span
                    >
                </div>
            </button>
        </div>
    </div>

    <div class="form-group">
        <label for="r18-toggle">
            {$t("editPage.adultContentLabel")}
        </label>
        <div class="content-type-selector">
            <button
                class:active={!persona.tags.includes("1003")}
                on:click={() => {
                    if (persona.tags.includes("1003")) {
                        toggleTag("1003");
                    }
                }}
                type="button"
            >
                <Icon icon="ph:baby-duotone" width="24" />
                <div class="text">
                    <span class="title">{$t("editPage.allAges")}</span>
                    <span class="desc">Safe for all audiences</span>
                </div>
            </button>
            <button
                class:active={persona.tags.includes("1003")}
                on:click={() => {
                    if (!persona.tags.includes("1003")) {
                        toggleTag("1003");
                    }
                }}
                type="button"
            >
                <Icon icon="ph:warning-octagon-duotone" width="24" />
                <div class="text">
                    <span class="title">19+</span>
                    <span class="desc">Adult content only</span>
                </div>
            </button>
        </div>
        <p class="description" style="margin-top: 0.75rem;">
            {$t("editPage.adultContentDesc")}
        </p>
    </div>
</div>

<style>
    .form-section-card {
        background-color: var(--card);
        border: 1px solid var(--border-card);
        border-radius: var(--radius-card);
        padding: 1.5rem;
    }
    .form-section-card h2 {
        margin-top: 0;
        margin-bottom: 1.5rem;
        font-size: 1.25rem;
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.75rem;
    }
    .form-group {
        margin-bottom: 1.5rem;
    }
    .form-group:last-child {
        margin-bottom: 0;
    }
    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
    }
    .description {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        margin-top: -0.25rem;
        margin-bottom: 0.75rem;
    }
    input,
    select,
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
    input:focus,
    select:focus,
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
    .content-type-selector {
        display: flex;
        gap: 1rem;
    }
    .content-type-selector button {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
    }
    .content-type-selector button:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
    }
    .content-type-selector button.active {
        border-color: var(--primary);
        color: var(--primary);
    }
    .content-type-selector .text {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }
    .content-type-selector .title {
        font-weight: 600;
        font-size: 1rem;
    }
    .content-type-selector .desc {
        font-size: 0.8rem;
        opacity: 0.7;
    }
</style>

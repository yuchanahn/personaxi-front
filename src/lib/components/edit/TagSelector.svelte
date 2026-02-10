<script lang="ts">
    import { t } from "svelte-i18n";
    import { allCategories } from "$lib/constants";
    import { toast } from "$lib/stores/toast";

    export let persona: Persona;

    function toggleTag(tagId: string) {
        if (persona.tags.includes(tagId)) {
            persona.tags = persona.tags.filter((id) => id !== tagId);
        } else {
            // Count only category tags (ID < 1000)
            const categoryTagsCount = persona.tags.filter(
                (id) => parseInt(id) < 1000,
            ).length;

            if (categoryTagsCount < 3) {
                persona.tags = [...persona.tags, tagId];
            } else {
                toast.warning($t("editPage.validation.maxTags"));
            }
        }
    }
</script>

<div class="form-group">
    <label for="tags-container">{$t("editPage.tagsLabel")}</label>
    <p class="description">
        {$t("editPage.tagsDescriptionCategory", {
            default: "카테고리를 선택하세요.",
        })}
    </p>
    <div class="category-button-container" id="tags-container">
        {#each allCategories.filter((category) => category.id < 1000) as category (category.id)}
            <button
                type="button"
                class="category-button"
                class:active={persona.tags.includes(category.id.toString())}
                class:disabled={persona.tags.filter((id) => parseInt(id) < 1000)
                    .length >= 3 &&
                    !persona.tags.includes(category.id.toString())}
                on:click={() => toggleTag(category.id.toString())}
            >
                {$t(category.nameKey)}
            </button>
        {/each}
    </div>
</div>

<style>
    .form-group {
        margin-bottom: 1.5rem;
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
    .category-button-container {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding-top: 0.25rem;
    }
    .category-button {
        padding: 0.5rem 1rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background-color: var(--muted);
        color: var(--muted-foreground);
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
    }
    .category-button:not(.active):hover {
        background-color: var(--secondary);
        border-color: var(--border-hover);
        transform: translateY(-1px);
    }
    .category-button.active {
        background: var(--primary-gradient);
        color: var(--primary-foreground);
        border-color: transparent;
        font-weight: 600;
    }
    .category-button.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>

<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { allCategories } from "$lib/constants";
    import { toast } from "$lib/stores/toast";
    import AssetPreview from "$lib/components/AssetPreview.svelte";
    import type { Persona } from "$lib/types";

    export let persona: Persona;
    export let validationErrors: string[];

    function toggleTag(tagId: string) {
        if (persona.tags.includes(tagId)) {
            persona.tags = persona.tags.filter((id) => id !== tagId);
        } else {
            const categoryTagsCount = persona.tags.filter(
                (id) => parseInt(id) < 1000,
            ).length;

            if (categoryTagsCount < 3) {
                persona.tags = [...persona.tags, tagId];
            } else {
                toast.warning(
                    $t("editPage.validation.maxTags", {
                        default: "최대 3개의 태그만 선택 가능합니다.",
                    }),
                );
            }
        }
    }

    $: categoryTags = allCategories.filter((c) => c.id < 1000);
    $: selectedCount = persona.tags.filter((id) => parseInt(id) < 1000).length;
</script>

<div class="step-review">
    <!-- Tags -->
    <section class="review-section">
        <h3 class="section-title">
            <Icon icon="ph:tag-duotone" width="20" />
            카테고리 태그 선택
            <span class="required">*</span>
        </h3>
        <p class="section-hint">
            캐릭터의 장르/성격을 나타내는 태그를 최대 3개 선택하세요. ({selectedCount}/3)
        </p>
        <div class="tags-grid">
            {#each categoryTags as category (category.id)}
                <button
                    type="button"
                    class="tag-chip"
                    class:active={persona.tags.includes(category.id.toString())}
                    class:disabled={selectedCount >= 3 &&
                        !persona.tags.includes(category.id.toString())}
                    on:click={() => toggleTag(category.id.toString())}
                >
                    {$t(category.nameKey)}
                </button>
            {/each}
        </div>
    </section>

    <!-- Preview Card -->
    <section class="review-section">
        <h3 class="section-title">
            <Icon icon="ph:eye-duotone" width="20" />
            미리보기
        </h3>

        <div class="preview-card">
            <div class="preview-portrait">
                {#if persona.portrait_url}
                    <AssetPreview
                        asset={{
                            url: persona.portrait_url,
                            description: "",
                        }}
                    />
                {:else}
                    <div class="portrait-placeholder">
                        <Icon icon="ph:user-duotone" width="40" />
                    </div>
                {/if}
            </div>
            <div class="preview-info">
                <h4 class="preview-name">
                    {persona.name || "이름 없음"}
                </h4>
                {#if persona.one_liner}
                    <p class="preview-oneliner">{persona.one_liner}</p>
                {/if}
                <div class="preview-meta">
                    <span class="preview-type">
                        {persona.personaType || "타입 미선택"}
                    </span>
                    <span class="preview-visibility">
                        <Icon
                            icon={persona.visibility === "public"
                                ? "ph:globe"
                                : "ph:lock"}
                            width="14"
                        />
                        {persona.visibility === "public" ? "공개" : "비공개"}
                    </span>
                </div>
                {#if persona.greeting}
                    <p class="preview-greeting">
                        "{persona.greeting}"
                    </p>
                {/if}
            </div>
        </div>
    </section>

    <!-- Validation -->
    {#if validationErrors.length > 0}
        <section class="review-section">
            <div class="validation-box">
                <h4 class="validation-title">
                    <Icon icon="ph:warning-circle-duotone" width="20" />
                    작성이 필요한 항목
                </h4>
                <ul class="validation-list">
                    {#each validationErrors as err}
                        <li>{err}</li>
                    {/each}
                </ul>
            </div>
        </section>
    {:else}
        <section class="review-section">
            <div class="success-box">
                <Icon icon="ph:check-circle-duotone" width="24" />
                <span
                    >모든 필수 항목이 작성되었습니다. 저장할 준비가 되었어요!</span
                >
            </div>
        </section>
    {/if}
</div>

<style>
    .step-review {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .review-section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .section-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--foreground);
        margin: 0;
    }

    .required {
        color: var(--destructive);
    }

    .section-hint {
        font-size: 0.82rem;
        color: var(--muted-foreground);
        margin: 0;
    }

    /* ── Tags ── */
    .tags-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
    }

    .tag-chip {
        padding: 0.55rem 1.1rem;
        border-radius: 999px;
        border: 1.5px solid var(--border);
        background: var(--card);
        color: var(--muted-foreground);
        font-size: 0.88rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .tag-chip:hover:not(.disabled) {
        border-color: var(--primary);
        transform: translateY(-1px);
    }
    .tag-chip.active {
        background: var(--primary-gradient);
        color: var(--primary-foreground);
        border-color: transparent;
        font-weight: 600;
    }
    .tag-chip.disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    /* ── Preview Card ── */
    .preview-card {
        display: flex;
        gap: 1rem;
        padding: 1.25rem;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--card);
    }

    .preview-portrait {
        width: 80px;
        height: 80px;
        border-radius: 14px;
        overflow: hidden;
        flex-shrink: 0;
        border: 1px solid var(--border);
    }

    .portrait-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--muted);
        color: var(--muted-foreground);
    }

    .preview-info {
        flex: 1;
        min-width: 0;
    }

    .preview-name {
        font-size: 1.1rem;
        font-weight: 700;
        margin: 0;
        color: var(--foreground);
    }

    .preview-oneliner {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        margin: 0.15rem 0 0;
    }

    .preview-meta {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-top: 0.5rem;
    }

    .preview-type {
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0.2rem 0.6rem;
        border-radius: 6px;
        background: var(--muted);
        color: var(--foreground);
        text-transform: uppercase;
    }

    .preview-visibility {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.78rem;
        color: var(--muted-foreground);
    }

    .preview-greeting {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        font-style: italic;
        margin: 0.5rem 0 0;
        line-height: 1.4;
    }

    /* ── Validation Box ── */
    .validation-box {
        padding: 1rem 1.25rem;
        border-radius: 12px;
        background: hsla(0, 80%, 50%, 0.08);
        border: 1px solid hsla(0, 80%, 50%, 0.2);
    }

    .validation-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--destructive);
        margin: 0 0 0.5rem;
    }

    .validation-list {
        margin: 0;
        padding-left: 1.5rem;
        font-size: 0.88rem;
        color: var(--destructive);
        line-height: 1.6;
    }

    .success-box {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        border-radius: 12px;
        background: hsla(130, 60%, 40%, 0.08);
        border: 1px solid hsla(130, 60%, 40%, 0.2);
        color: hsl(130, 60%, 40%);
        font-size: 0.9rem;
        font-weight: 600;
    }
</style>

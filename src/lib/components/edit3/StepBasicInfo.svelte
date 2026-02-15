<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import type { Persona } from "$lib/types";

    export let persona: Persona;
</script>

<div class="step-basic">
    <!-- Character Name -->
    <div class="field-group">
        <label for="e3-name" class="field-label">
            <Icon icon="ph:text-aa-duotone" width="18" />
            {persona.contentType === "story"
                ? $t("editPage.storyNameLabel", { default: "스토리 이름" })
                : $t("editPage.nameLabel", { default: "캐릭터 이름" })}
            <span class="required">*</span>
        </label>
        <input
            id="e3-name"
            type="text"
            class="field-input"
            bind:value={persona.name}
            required
            placeholder={persona.contentType === "story"
                ? $t("editPage.storyNamePlaceholder", {
                      default: "스토리의 이름을 입력하세요",
                  })
                : $t("editPage.namePlaceholder", {
                      default: "캐릭터의 이름을 입력하세요",
                  })}
            maxlength="50"
        />
    </div>

    <!-- One-Liner -->
    <div class="field-group">
        <label for="e3-oneliner" class="field-label">
            <Icon icon="ph:quotes-duotone" width="18" />
            {persona.contentType === "story"
                ? $t("editPage.storyOneLinerLabel", {
                      default: "스토리 한줄 소개",
                  })
                : $t("editPage.oneLinerLabel", { default: "한줄 소개" })}
        </label>
        <p class="field-hint">
            프로필 카드에 표시됩니다. 매력적인 한 줄로 사람들의 관심을
            끌어보세요!
        </p>
        <input
            id="e3-oneliner"
            type="text"
            class="field-input"
            bind:value={persona.one_liner}
            placeholder={$t("editPage.oneLinerPlaceholder", {
                default: "예: 당신만을 위한 수호천사",
            })}
            maxlength="60"
        />
        <div
            class="char-counter"
            class:warning={(persona.one_liner || "").length > 50}
            class:error={(persona.one_liner || "").length > 60}
        >
            {(persona.one_liner || "").length}/60
        </div>
    </div>

    <!-- Greeting -->
    <div class="field-group">
        <label for="e3-greeting" class="field-label">
            <Icon icon="ph:hand-waving-duotone" width="18" />
            {$t("editPage.greetingLabel", { default: "인사말" })}
            <span class="required">*</span>
        </label>
        <p class="field-hint">프로필 페이지에서 캐릭터가 하는 첫 인사입니다.</p>
        <textarea
            id="e3-greeting"
            class="field-textarea"
            bind:value={persona.greeting}
            placeholder={$t("editPage.greetingPlaceholder", {
                default: "안녕! 오늘도 만나서 반가워~",
            })}
            maxlength="200"
            rows="3"
        ></textarea>
        <div
            class="char-counter"
            class:warning={persona.greeting.length > 160}
            class:error={persona.greeting.length >= 200}
        >
            {persona.greeting.length} / 200
        </div>
    </div>

    <!-- Visibility -->
    <div class="field-group">
        <label class="field-label">
            <Icon icon="ph:eye-duotone" width="18" />
            {$t("editPage.visibilityLabel", { default: "공개 설정" })}
        </label>
        <div class="visibility-toggle">
            <button
                class="vis-btn"
                class:active={persona.visibility === "public"}
                on:click={() => (persona.visibility = "public")}
            >
                <Icon icon="ph:globe-duotone" width="20" />
                <div class="vis-text">
                    <span class="vis-label"
                        >{$t("editPage.public", { default: "공개" })}</span
                    >
                    <span class="vis-desc"
                        >{$t("editPage.publicDesc", {
                            default: "모두가 볼 수 있어요",
                        })}</span
                    >
                </div>
            </button>
            <button
                class="vis-btn"
                class:active={persona.visibility === "private"}
                on:click={() => (persona.visibility = "private")}
            >
                <Icon icon="ph:lock-duotone" width="20" />
                <div class="vis-text">
                    <span class="vis-label"
                        >{$t("editPage.private", { default: "비공개" })}</span
                    >
                    <span class="vis-desc"
                        >{$t("editPage.privateDesc", {
                            default: "나만 볼 수 있어요",
                        })}</span
                    >
                </div>
            </button>
        </div>
    </div>
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

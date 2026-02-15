<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { tick } from "svelte";
    import FirstSceneBuilder from "$lib/components/FirstSceneBuilder.svelte";
    import KintsugiForm from "$lib/components/edit/KintsugiForm.svelte";
    import type { Persona } from "$lib/types";

    export let persona: Persona;
    export let selectedTemplate: string;
    export let singleInstruction: string;
    export let k_description: string;
    export let k_personality: string;
    export let k_userPersona: string;
    export let k_scenario: string;
    export let firstSceneJson: string;
    export let availableExpressions: string[];
    export let availableMotions: string[];
    export let kintsugiTemplateId: string;

    let firstSceneTextarea: HTMLTextAreaElement;
    let toggleDialogueTag = false;

    const jsonPlaceholder =
        '{"greeting": "안녕하세요!", "expression": "happy", "motion": "idle"}';

    function insertDialogueTag() {
        if (!firstSceneTextarea) return;
        const target = toggleDialogueTag ? "{{user}}" : "{{char}}";
        const snippet = `<dialogue speaker="${target}"></dialogue>`;
        const start = firstSceneTextarea.selectionStart;
        const end = firstSceneTextarea.selectionEnd;
        const before = persona.first_scene.substring(0, start);
        const after = persona.first_scene.substring(end);
        persona.first_scene = before + snippet + after;
        const newPos = start + snippet.indexOf("></") + 1;
        tick().then(() => {
            firstSceneTextarea.focus();
            firstSceneTextarea.selectionStart = newPos;
            firstSceneTextarea.selectionEnd = newPos;
        });
    }
</script>

<div class="step-prompt">
    <!-- First Scene -->
    <div class="field-group">
        <label for="e3-first-scene" class="field-label">
            <Icon icon="ph:film-script-duotone" width="18" />
            {persona.personaType === "3D" || persona.personaType === "2.5D"
                ? $t("editPage.characterSettings.title", {
                      default: "캐릭터 설정",
                  })
                : $t("editPage.firstSceneLabel", { default: "첫 장면" })}
            <span class="required">*</span>
        </label>

        {#if persona.personaType === "3D" || persona.personaType === "2.5D"}
            <!-- FirstSceneBuilder for 3D & 2.5D -->
            <FirstSceneBuilder
                initialData={persona.first_scene}
                {availableExpressions}
                {availableMotions}
                mode={persona.personaType === "3D" ? "3d" : "live2d"}
                onChange={(json) => {
                    firstSceneJson = json;
                    persona.first_scene = json;
                }}
            />
        {:else}
            <p class="field-hint">
                {$t("editPage.firstSceneDescription", {
                    default:
                        "대화가 시작될 때의 첫 장면을 작성하세요. 에셋 이미지를 본문에 넣으려면 <img 0>, <img 1> 형태의 태그를 삽입하세요.",
                })}
            </p>

            {#if persona.contentType !== "story"}
                <div class="tag-tools">
                    <div class="toggle-row">
                        <span
                            class="toggle-label"
                            class:active={!toggleDialogueTag}>{"{{char}}"}</span
                        >
                        <label class="toggle-switch">
                            <input
                                type="checkbox"
                                bind:checked={toggleDialogueTag}
                            />
                            <span class="slider"></span>
                        </label>
                        <span
                            class="toggle-label"
                            class:active={toggleDialogueTag}>{"{{user}}"}</span
                        >
                    </div>
                    <button
                        type="button"
                        class="btn-util"
                        on:click={insertDialogueTag}
                    >
                        <Icon icon="ph:plus-bold" width="14" />
                        {$t("editPage.aiSettings.addDialogueTag", {
                            default: "대화 태그 삽입",
                        })}
                    </button>
                </div>
            {/if}

            <textarea
                id="e3-first-scene"
                class="field-textarea"
                bind:this={firstSceneTextarea}
                bind:value={persona.first_scene}
                rows="8"
                maxlength="2500"
                placeholder={$t("editPage.firstScenePlaceholder", {
                    default:
                        "예: 학교 옥상에서 바람이 불어오는 오후. {{char}}가 난간에 기대어 하늘을 바라보고 있다.",
                })}
            ></textarea>
            <div
                class="char-counter"
                class:warning={persona.first_scene.length > 2400}
                class:error={persona.first_scene.length >= 2500}
            >
                {persona.first_scene.length} / 2500
            </div>
        {/if}
    </div>

    <!-- Prompt Template (2D only) -->
    {#if persona.personaType !== "3D" && persona.personaType !== "2.5D"}
        <div class="field-group">
            <label for="e3-template" class="field-label">
                <Icon icon="ph:file-code-duotone" width="18" />
                {$t("editPage.aiSettings.templateLabel", {
                    default: "프롬프트 템플릿",
                })}
            </label>
            <select
                id="e3-template"
                class="field-select"
                bind:value={selectedTemplate}
            >
                <option value="custom"
                    >{$t("editPage.aiSettings.templateCustom", {
                        default: "자유 형식",
                    })}</option
                >
                <option value="conversation"
                    >{$t("editPage.aiSettings.templateConversation", {
                        default: "대화형",
                    })}</option
                >
                <option value="simulation"
                    >{$t("editPage.aiSettings.templateSimulation", {
                        default: "시뮬레이션",
                    })}</option
                >
                <option value={kintsugiTemplateId}
                    >{$t("editPage.aiSettings.templateKintsugi", {
                        default: "Kintsugi",
                    })}</option
                >
            </select>
        </div>
    {/if}

    <!-- Instructions -->
    <div class="field-group">
        <label for="e3-instructions" class="field-label">
            <Icon icon="ph:notepad-duotone" width="18" />
            {$t("editPage.instructionsLabel", {
                default: "지시사항 (Instructions)",
            })}
            <span class="required">*</span>
        </label>
        <p class="field-hint">
            {$t("editPage.instructionsDescription", {
                default:
                    "캐릭터의 성격, 말투, 행동 규칙 등을 자유롭게 작성하세요.",
            })}
        </p>

        {#if selectedTemplate !== kintsugiTemplateId}
            <textarea
                id="e3-instructions"
                class="field-textarea"
                bind:value={singleInstruction}
                rows="8"
                maxlength="3000"
                placeholder={$t("editPage.instructionsPlaceholder", {
                    default: "캐릭터의 성격과 말투를 설명하세요...",
                })}
            ></textarea>
            <div
                class="char-counter"
                class:warning={singleInstruction.length > 2800}
                class:error={singleInstruction.length >= 3000}
            >
                {singleInstruction.length} / 3000
            </div>
        {:else}
            <KintsugiForm
                bind:k_description
                bind:k_personality
                bind:k_userPersona
                bind:k_scenario
            />
        {/if}
    </div>
</div>

<style>
    .step-prompt {
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

    .field-textarea {
        padding: 0.85rem 1rem;
        border-radius: 12px;
        border: 1.5px solid var(--border);
        background: var(--input);
        color: var(--foreground);
        font-size: 0.95rem;
        resize: vertical;
        min-height: 100px;
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

    .field-select {
        padding: 0.85rem 1rem;
        border-radius: 12px;
        border: 1.5px solid var(--border);
        background: var(--input);
        color: var(--foreground);
        font-size: 0.95rem;
        width: 100%;
        box-sizing: border-box;
        cursor: pointer;
    }
    .field-select:focus {
        outline: none;
        border-color: var(--primary);
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

    /* ── Tag Tools ── */
    .tag-tools {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 0.75rem;
        background: var(--muted);
        border-radius: 10px;
        margin-bottom: 0.25rem;
    }

    .toggle-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .toggle-label {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--muted-foreground);
        font-family: "Fira Code", monospace;
    }
    .toggle-label.active {
        color: var(--primary);
    }

    .toggle-switch {
        position: relative;
        display: inline-block;
        width: 40px;
        height: 22px;
    }
    .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background-color: var(--muted-foreground);
        transition: 0.3s;
        border-radius: 22px;
    }
    .slider::before {
        content: "";
        position: absolute;
        height: 16px;
        width: 16px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        border-radius: 50%;
        transition: 0.3s;
    }
    .toggle-switch input:checked + .slider {
        background-color: var(--primary);
    }
    .toggle-switch input:checked + .slider::before {
        transform: translateX(18px);
    }

    .btn-util {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.4rem 0.75rem;
        font-size: 0.8rem;
        font-weight: 600;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--foreground);
        cursor: pointer;
        transition: all 0.2s;
    }
    .btn-util:hover {
        background: var(--secondary);
    }
</style>

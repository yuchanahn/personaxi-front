<script lang="ts">
    import type { PersonaVariable, Persona } from "$lib/types";
    import Icon from "@iconify/svelte";
    import { t } from "svelte-i18n";

    export let persona: Persona;

    let showAdvanced = false;
    let newVarName = "";
    let newVarType: PersonaVariable["var_type"] = "text";
    let newVarDefault = "";
    let newVarDesc = "";
    let newVarMin = "";
    let newVarMax = "";

    function addVariable() {
        const name = newVarName.trim();
        if (!name) return;
        if (
            persona.variables &&
            persona.variables.some((v) => v.name === name)
        ) {
            return; // Duplicate
        }

        const newVar: PersonaVariable = {
            name,
            var_type: newVarType,
            default_value: newVarDefault.trim() || "0",
        };

        const desc = String(newVarDesc ?? "").trim();
        if (desc) {
            newVar.description = desc;
        }
        if (newVarType === "number") {
            const min = String(newVarMin ?? "").trim();
            const max = String(newVarMax ?? "").trim();
            if (min) newVar.min_value = min;
            if (max) newVar.max_value = max;
        }

        persona.variables = [...(persona.variables || []), newVar];
        newVarName = "";
        newVarDefault = "";
        newVarDesc = "";
        newVarMin = "";
        newVarMax = "";
    }

    function removeVariable(index: number) {
        const vars = [...(persona.variables || [])];
        vars.splice(index, 1);
        persona.variables = vars;
    }

    const varSyntax = "{{{var}}}";
</script>

<div class="variable-editor">
    <button
        class="advanced-toggle"
        on:click={() => (showAdvanced = !showAdvanced)}
        type="button"
    >
        <Icon
            icon={showAdvanced ? "ph:caret-down-bold" : "ph:caret-right-bold"}
            width="14"
        />
        <Icon icon="ph:gear-six-duotone" width="18" />
        <span>{$t("editPage.variableEditor.advancedToggle")}</span>
        {#if persona.variables && persona.variables.length > 0}
            <span class="badge">{persona.variables.length}</span>
        {/if}
    </button>

    {#if showAdvanced}
        <div class="advanced-content">
            <!-- Variable List -->
            <div class="section">
                <h4 class="section-title">
                    <Icon icon="ph:variable-duotone" width="16" />
                    {$t("editPage.variableEditor.sectionTitle")}
                </h4>
                <p class="section-desc">
                    {$t("editPage.variableEditor.sectionDesc", {
                        values: { syntax: varSyntax },
                    })}
                </p>

                {#if persona.variables && persona.variables.length > 0}
                    <div class="var-list">
                        {#each persona.variables as v, i}
                            <div class="var-item">
                                <div class="var-item-header">
                                    <span class="var-name">{v.name}</span>
                                    <span class="var-type">{v.var_type}</span>
                                    <span class="var-default"
                                        >{$t(
                                            "editPage.variableEditor.defaultLabel",
                                            {
                                                values: {
                                                    value: v.default_value,
                                                },
                                            },
                                        )}</span
                                    >
                                    {#if v.var_type === "number" && (v.min_value || v.max_value)}
                                        <span class="var-range"
                                            >{v.min_value ||
                                                "−∞"}~{v.max_value || "∞"}</span
                                        >
                                    {/if}
                                    <button
                                        class="var-remove"
                                        type="button"
                                        on:click={() => removeVariable(i)}
                                        title={$t(
                                            "editPage.variableEditor.deleteTooltip",
                                        )}
                                    >
                                        <Icon
                                            icon="ph:trash-duotone"
                                            width="14"
                                        />
                                    </button>
                                </div>
                                {#if v.description}
                                    <div class="var-desc">{v.description}</div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}

                <!-- Add Variable Form -->
                <div class="add-var-form">
                    <div class="add-var-row">
                        <input
                            class="var-input name-input"
                            bind:value={newVarName}
                            placeholder={$t(
                                "editPage.variableEditor.namePlaceholder",
                            )}
                            maxlength="30"
                        />
                        <select class="var-select" bind:value={newVarType}>
                            <option value="text"
                                >{$t(
                                    "editPage.variableEditor.typeText",
                                )}</option
                            >
                            <option value="number"
                                >{$t(
                                    "editPage.variableEditor.typeNumber",
                                )}</option
                            >
                            <option value="enum"
                                >{$t(
                                    "editPage.variableEditor.typeEnum",
                                )}</option
                            >
                            <option value="boolean"
                                >{$t(
                                    "editPage.variableEditor.typeBoolean",
                                )}</option
                            >
                        </select>
                    </div>
                    <div class="add-var-row">
                        <input
                            class="var-input default-input"
                            bind:value={newVarDefault}
                            placeholder={$t(
                                "editPage.variableEditor.defaultPlaceholder",
                            )}
                            maxlength="50"
                        />
                        {#if newVarType === "number"}
                            <input
                                class="var-input range-input"
                                bind:value={newVarMin}
                                placeholder={$t(
                                    "editPage.variableEditor.minPlaceholder",
                                )}
                                type="text"
                                inputmode="numeric"
                            />
                            <input
                                class="var-input range-input"
                                bind:value={newVarMax}
                                placeholder={$t(
                                    "editPage.variableEditor.maxPlaceholder",
                                )}
                                type="text"
                                inputmode="numeric"
                            />
                        {/if}
                    </div>
                    <div class="add-var-row">
                        <input
                            class="var-input desc-input"
                            bind:value={newVarDesc}
                            placeholder={$t(
                                "editPage.variableEditor.descriptionPlaceholder",
                            )}
                            maxlength="100"
                        />
                        <button
                            class="add-btn"
                            type="button"
                            on:click={addVariable}
                            disabled={!newVarName.trim()}
                        >
                            <Icon icon="ph:plus-bold" width="14" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Status Template -->
            <div class="section">
                <h4 class="section-title">
                    <Icon icon="ph:paint-brush-duotone" width="16" />
                    {$t("editPage.variableEditor.statusTitle")}
                </h4>
                <p class="section-desc">
                    {$t("editPage.variableEditor.statusDesc", {
                        values: { syntax: varSyntax },
                    })}
                </p>

                <textarea
                    class="template-textarea"
                    bind:value={persona.status_template}
                    placeholder={`<div class="stats">
  <div>📍 Location: {"{{{location}}}"}</div>
  <div>❤️ HP: {"{{{hp}}}"}</div>
</div>`}
                    rows="6"
                ></textarea>
            </div>

            <!-- Status Template CSS -->
            <div class="section">
                <h4 class="section-title">
                    <Icon icon="ph:code-duotone" width="16" />
                    {$t("editPage.variableEditor.cssTitle")}
                </h4>
                <p class="section-desc">
                    {$t("editPage.variableEditor.cssDesc")}
                </p>

                <textarea
                    class="template-textarea css-textarea"
                    bind:value={persona.status_template_css}
                    placeholder={`.stats { 
  display: flex; 
  gap: 12px; 
  color: #aaa; 
  font-size: 0.85em; 
}`}
                    rows="5"
                ></textarea>
            </div>
        </div>
    {/if}
</div>

<style>
    .variable-editor {
        margin-top: 0.5rem;
    }

    .advanced-toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.75rem 1rem;
        border: 1.5px dashed var(--border);
        border-radius: 12px;
        background: transparent;
        color: var(--muted-foreground);
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
    }
    .advanced-toggle:hover {
        color: var(--foreground);
        border-color: var(--primary);
        background: var(--input);
    }

    .badge {
        background: var(--primary);
        color: var(--primary-foreground, #fff);
        border-radius: 999px;
        padding: 0 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1.6;
    }

    .advanced-content {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        border: 1.5px solid var(--border);
        border-radius: 12px;
        padding: 1rem;
        margin-top: 0.5rem;
        background: var(--input);
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .section-title {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--foreground);
        margin: 0;
    }
    .section-desc {
        font-size: 0.8rem;
        color: var(--muted-foreground);
        margin: 0 0 0.25rem;
    }

    .var-list {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }
    .var-item {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        padding: 0.4rem 0.75rem;
        background: var(--background);
        border-radius: 8px;
        font-size: 0.85rem;
    }
    .var-item-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .var-name {
        font-weight: 600;
        color: var(--primary);
    }
    .var-type {
        color: var(--muted-foreground);
        font-size: 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        padding: 1px 6px;
        border-radius: 4px;
    }
    .var-default {
        color: var(--muted-foreground);
        font-size: 0.8rem;
        flex: 1;
    }
    .var-range {
        color: var(--muted-foreground);
        font-size: 0.75rem;
        background: rgba(100, 200, 255, 0.1);
        padding: 1px 6px;
        border-radius: 4px;
    }
    .var-desc {
        font-size: 0.75rem;
        color: var(--muted-foreground);
        opacity: 0.8;
        padding-left: 0.25rem;
    }
    .var-remove {
        background: none;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
    }
    .var-remove:hover {
        color: #ff6b6b;
        background: rgba(255, 107, 107, 0.1);
    }

    .add-var-form {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        margin-top: 0.4rem;
    }
    .add-var-row {
        display: flex;
        gap: 0.4rem;
    }
    .var-input {
        flex: 1;
        min-width: 0;
        padding: 0.5rem 0.75rem;
        border: 1.5px solid var(--border);
        border-radius: 8px;
        background: var(--background);
        color: var(--foreground);
        font-size: 0.85rem;
        box-sizing: border-box;
    }
    .var-input:focus {
        outline: none;
        border-color: var(--primary);
    }
    .range-input {
        flex: 0 0 70px;
        text-align: center;
    }
    /* Hide number input spinners */
    .range-input::-webkit-outer-spin-button,
    .range-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    .var-select {
        flex-shrink: 0;
        padding: 0.5rem;
        border: 1.5px solid var(--border);
        border-radius: 8px;
        background: var(--background);
        color: var(--foreground);
        font-size: 0.85rem;
        cursor: pointer;
    }
    .add-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        background: var(--primary);
        color: var(--primary-foreground, #fff);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: opacity 0.2s;
    }
    .add-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .add-btn:hover:not(:disabled) {
        opacity: 0.85;
    }

    .template-textarea {
        padding: 0.75rem;
        border: 1.5px solid var(--border);
        border-radius: 8px;
        background: var(--background);
        color: var(--foreground);
        font-family: "JetBrains Mono", monospace;
        font-size: 0.82rem;
        resize: vertical;
        line-height: 1.5;
        box-sizing: border-box;
        width: 100%;
    }
    .template-textarea:focus {
        outline: none;
        border-color: var(--primary);
    }
    .css-textarea {
        color: #a1c4fd;
    }
</style>

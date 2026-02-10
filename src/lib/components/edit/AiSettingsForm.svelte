<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { tick } from "svelte";
    import KintsugiForm from "./KintsugiForm.svelte";
    import FirstSceneBuilder from "$lib/components/FirstSceneBuilder.svelte";
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

    function insertDialogueTag() {
        if (!firstSceneTextarea) return;

        const target = toggleDialogueTag ? "{{user}}" : "{{char}}";
        const snippet = `<dialogue speaker="${target}"></dialogue>`;

        const pos = firstSceneTextarea.selectionStart;
        const currentVal = persona.first_scene;

        persona.first_scene =
            currentVal.substring(0, pos) + snippet + currentVal.substring(pos);

        const newPos = pos + `<dialogue speaker="${target}">`.length;

        tick().then(() => {
            firstSceneTextarea.focus();
            firstSceneTextarea.selectionStart = newPos;
            firstSceneTextarea.selectionEnd = newPos;
        });
    }
</script>

<div class="form-section-card">
    <h2>{$t("editPage.aiSettings.title")}</h2>
    <div class="form-group">
        <label for="first_scene">
            {persona.personaType === "3D" || persona.personaType === "2.5D"
                ? $t("editPage.characterSettings.title")
                : $t("editPage.firstSceneLabel")}
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
            <!-- Original textarea for non-3D -->
            {#if persona.contentType !== "story"}
                <div class="toggle-container">
                    <span class:active={!toggleDialogueTag}>{"{{char}}"}</span>
                    <label class="toggle-switch">
                        <input
                            type="checkbox"
                            bind:checked={toggleDialogueTag}
                        />
                        <span class="slider"></span>
                    </label>
                    <span class:active={toggleDialogueTag}>{"{{user}}"}</span>
                    <div class="tooltip-icon">
                        <Icon icon="ph:question-bold" />
                        <div class="tooltip-text">
                            <p>
                                <strong>{"{{char}}"}</strong>: {$t(
                                    "editPage.tooltip.char",
                                    { default: "캐릭터 이름" },
                                )}
                            </p>
                            <p>
                                <strong>{"{{user}}"}</strong>: {$t(
                                    "editPage.tooltip.user",
                                    { default: "사용자 이름" },
                                )}
                            </p>
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    class="btn-util"
                    on:click={insertDialogueTag}
                >
                    {$t("editPage.aiSettings.addDialogueTag")}
                </button>
            {/if}

            <p class="description">
                {$t("editPage.firstSceneDescription")}
            </p>
            <textarea
                id="first_scene"
                bind:this={firstSceneTextarea}
                bind:value={persona.first_scene}
                placeholder={$t("editPage.firstScenePlaceholder")}
                rows="5"
                maxlength="2500"
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
    <div class="form-group">
        {#if persona.personaType !== "3D" && persona.personaType !== "2.5D"}
            <div class="form-group">
                <label for="prompt-template"
                    >{$t("editPage.aiSettings.templateSelectLabel")}</label
                >
                <select id="prompt-template" bind:value={selectedTemplate}>
                    <option value="custom"
                        >{$t("editPage.aiSettings.templateCustom")}</option
                    >
                    <option value="conversation"
                        >{$t(
                            "editPage.aiSettings.templateConversation",
                        )}</option
                    >
                    <option value="simulation"
                        >{$t("editPage.aiSettings.templateSimulation")}</option
                    >
                    <option value={kintsugiTemplateId}
                        >{$t("editPage.aiSettings.templateKintsugi")}</option
                    >
                </select>
            </div>
        {/if}

        {#if selectedTemplate !== kintsugiTemplateId}
            <div class="form-group">
                <label for="instruction-input"
                    >{$t("editPage.instructionsLabel")}</label
                >
                <p class="description">
                    {$t("editPage.instructionsDescription")}
                </p>
                <textarea
                    id="instruction-input"
                    bind:value={singleInstruction}
                    placeholder={$t("editPage.instructionsPlaceholder")}
                    rows="10"
                    maxlength="3000"
                ></textarea>
                <div
                    class="char-counter"
                    class:warning={singleInstruction.length > 2500}
                    class:error={singleInstruction.length >= 3000}
                >
                    {singleInstruction.length} / 3000
                </div>
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
    <div class="form-group">
        <!-- TagSelector slot or component could be placed here if linked to AI settings, but usually tags are separate -->
        <slot name="tags" />
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
    .btn-util {
        padding: 0.25rem 0.75rem;
        font-size: 0.8rem;
        font-weight: 600;
        border: 1px solid var(--border);
        border-radius: var(--radius-button);
        background: var(--secondary);
        color: var(--secondary-foreground);
        cursor: pointer;
        transition: all 0.2s;
    }
    .btn-util:hover {
        opacity: 0.9;
    }
    .toggle-container {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-family: monospace;
        font-size: 0.9em;
    }
    .toggle-container span {
        color: var(--muted-foreground);
        transition: color 0.2s;
    }
    .toggle-container span.active {
        color: var(--primary);
        font-weight: bold;
    }
    .toggle-switch {
        position: relative;
        display: inline-block;
        width: 34px;
        height: 20px;
    }
    .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--muted);
        transition: 0.4s;
        border-radius: 20px;
    }
    .slider:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.4s;
        border-radius: 50%;
    }
    input:checked + .slider {
        background-color: var(--primary);
    }
    input:checked + .slider:before {
        transform: translateX(14px);
    }
    .tooltip-icon {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-left: 0.5rem;
        cursor: help;
        color: var(--muted-foreground);
    }
    .tooltip-text {
        visibility: hidden;
        width: max-content;
        max-width: 250px;
        min-width: 150px;
        background-color: var(--popover);
        color: var(--popover-foreground);
        text-align: left;
        border-radius: 6px;
        padding: 0.8rem;
        position: absolute;
        z-index: 10;
        bottom: 130%;
        left: 50%;
        transform: translateX(-50%);
        opacity: 0;
        transition: opacity 0.2s;
        box-shadow: var(--shadow-popover);
        border: 1px solid var(--border);
        font-size: 0.85rem;
        pointer-events: none;
        word-wrap: break-word;
        white-space: normal;
    }
    .tooltip-text p {
        margin: 0.2rem 0;
    }
    .tooltip-icon:hover .tooltip-text {
        visibility: visible;
        opacity: 1;
    }
</style>

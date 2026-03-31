<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { tick } from "svelte";
    import "$lib/styles/chat2d-shared-block-defaults.css";
    import FirstSceneBuilder from "$lib/components/FirstSceneBuilder.svelte";
    import VariableEditor from "$lib/components/edit3/VariableEditor.svelte";
    import LoreLinker from "$lib/components/lore/LoreLinker.svelte";
    import ChatRenderer from "$lib/components/chat/ChatRenderer.svelte";
    import {
        formatWeightedCharCount,
        getWeightedRawMaxLength,
        getWeightedCharCount,
        isWeightedLimitReached,
    } from "$lib/utils/weightedText";
    import type { Persona } from "$lib/types";
    import { parseChat2DMessages } from "$lib/chat2d/parser";
    import type { Chat2DBlock } from "$lib/chat2d/types";
    import type { Message } from "$lib/stores/messages";

    export let persona: Persona;
    export let singleInstruction: string;
    export let firstSceneJson: string;
    export let availableExpressions: string[];
    export let availableMotions: string[];
    export let pendingLoreLinks = new Set<string>();
    $: void pendingLoreLinks;

    let firstSceneTextarea: HTMLTextAreaElement;
    let toggleDialogueTag = false;
    let isAvatarPersona = false;
    let isStoryPersona = false;
    let showStylePreview = false;

    function insertDialogueTag() {
        if (!firstSceneTextarea) return;
        const target = toggleDialogueTag ? "{{user}}" : "{{char}}";
        const snippet = `<say speaker="${target}"></say>`;
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
    let activeTab = "prompt"; // prompt, variable, lore, style
    $: isAvatarPersona =
        persona.personaType === "3D" || persona.personaType === "2.5D";
    $: isStoryPersona = persona.contentType === "story" && !isAvatarPersona;

    const tabs = [
        {
            id: "prompt",
            label: "editPage.tabs.prompt",
            icon: "ph:pencil-circle-duotone",
        },
        {
            id: "variable",
            label: "editPage.tabs.variable",
            icon: "ph:sliders-horizontal-duotone",
        },
        {
            id: "lore",
            label: "editPage.tabs.lorebook",
            icon: "ph:book-bookmark-duotone",
        },
        {
            id: "style",
            label: "edit3.prompt.sharedStyle.tabLabel",
            icon: "ph:paint-brush-broad-duotone",
        },
    ];

    $: stylePreviewMessages = buildStylePreviewMessages(persona);
    $: stylePreviewBlocks = parseChat2DMessages(
        stylePreviewMessages,
        {
            persona,
            userName: "User",
        },
        {
            showVariableStatus: false,
            revealVariableStatus: false,
        },
    );

    function buildStylePreviewMessages(currentPersona: Persona): Message[] {
        const previewContent =
            currentPersona.first_scene?.trim() ||
            $t("edit3.prompt.sharedStyle.previewSample");

        return [
            {
                role: "assistant",
                content: previewContent,
                done: true,
                key: "style-preview",
            },
        ];
    }

    function containsPreviewHtml(content: string): boolean {
        return /<\/?[a-z][^>]*>/i.test(content);
    }
</script>

<div class="step-prompt">
    <!-- Tab Navigation -->
    <div class="tabs">
        {#each tabs as tab}
            {#if tab.id === "variable" && isAvatarPersona}
                <!-- Skip Variable tab for 3D/2.5D -->
            {:else if tab.id === "lore" && isAvatarPersona}
                <!-- Skip Lore tab for 3D/2.5D -->
            {:else}
                <button
                    class="tab-btn"
                    class:active={activeTab === tab.id}
                    on:click={() => (activeTab = tab.id)}
                >
                    <Icon icon={tab.icon} width="18" />
                        <span class="tab-label">
                            {#if tab.id === "style" && isAvatarPersona}
                            {$t("edit3.prompt.advancedTabLabel")}
                        {:else}
                            {$t(tab.label, {
                                default: tab.label.split(".").pop(),
                            })}
                        {/if}
                    </span>
                </button>
            {/if}
        {/each}
    </div>

    <!-- Tab Content -->
    <div class="tab-content" class:active={activeTab === "prompt"}>
        {#if activeTab === "prompt"}
        <!-- First Scene -->
        <div class="field-group">
            <label for="e3-first-scene" class="field-label">
                <Icon icon="ph:film-script-duotone" width="18" />
                {persona.personaType === "3D" || persona.personaType === "2.5D"
                    ? $t("editPage.characterSettings.title")
                    : $t("editPage.firstSceneLabel")}
                <span class="required">*</span>
            </label>

            {#if isAvatarPersona}
                {#if persona.personaType === "2.5D"}
                    <p class="field-hint">
                        {$t("edit3.prompt.live2dAdvancedHint")}
                    </p>
                {/if}
                <!-- FirstSceneBuilder for 3D & 2.5D -->
                <FirstSceneBuilder
                    initialData={persona.first_scene}
                    {availableExpressions}
                    {availableMotions}
                    mode={persona.personaType === "3D" ? "3d" : "live2d"}
                    showLive2DMappingSections={persona.personaType === "3D"}
                    hideRuntimeStateFields={persona.personaType === "2.5D"}
                    showAdvancedFieldEditors={false}
                    onChange={(json) => {
                        firstSceneJson = json;
                        persona.first_scene = json;
                    }}
                />
            {:else}
                <p class="field-hint">
                    {$t("edit3.prompt.firstSceneHint")}
                </p>

                {#if persona.contentType !== "story"}
                    <div class="tag-tools">
                        <div class="toggle-row">
                            <span
                                class="toggle-label"
                                class:active={!toggleDialogueTag}
                                >{"{{char}}"}</span
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
                                class:active={toggleDialogueTag}
                                >{"{{user}}"}</span
                            >
                        </div>
                        <button
                            type="button"
                            class="btn-util"
                            on:click={insertDialogueTag}
                        >
                            <Icon icon="ph:plus-bold" width="14" />
                            {$t("editPage.aiSettings.addDialogueTag")}
                        </button>
                    </div>
                {/if}

                <textarea
                    id="e3-first-scene"
                    class="field-textarea"
                    bind:this={firstSceneTextarea}
                    bind:value={persona.first_scene}
                    rows="8"
                    maxlength={getWeightedRawMaxLength(persona.first_scene, 2500)}
                    placeholder={$t("edit3.prompt.firstScenePlaceholder", {
                        values: { char: "{{char}}" },
                    })}
                ></textarea>
                <div
                    class="char-counter"
                    class:warning={getWeightedCharCount(persona.first_scene) > 2400}
                    class:error={isWeightedLimitReached(persona.first_scene, 2500)}
                >
                    {formatWeightedCharCount(persona.first_scene)} / 2500
                </div>
            {/if}
        </div>

        {#if isStoryPersona}
            <div class="field-group">
                <label class="field-label">
                    <Icon icon="ph:cursor-click-duotone" width="18" />
                    {$t("edit3.prompt.interactiveUi.label")}
                </label>
                <p class="field-hint">
                    {$t("edit3.prompt.interactiveUi.description")}
                </p>
                <div class="visibility-toggle">
                    <button
                        type="button"
                        class="vis-btn"
                        class:active={!persona.interactiveUIEnabled}
                        on:click={() => (persona.interactiveUIEnabled = false)}
                    >
                        <Icon icon="ph:textbox-duotone" width="20" />
                        <div class="vis-text">
                            <span class="vis-label">
                                {$t("edit3.prompt.interactiveUi.offTitle")}
                            </span>
                            <span class="vis-desc">
                                {$t("edit3.prompt.interactiveUi.offDesc")}
                            </span>
                        </div>
                    </button>
                    <button
                        type="button"
                        class="vis-btn"
                        class:active={!!persona.interactiveUIEnabled}
                        on:click={() => (persona.interactiveUIEnabled = true)}
                    >
                        <Icon icon="ph:app-window-duotone" width="20" />
                        <div class="vis-text">
                            <span class="vis-label">
                                {$t("edit3.prompt.interactiveUi.onTitle")}
                            </span>
                            <span class="vis-desc">
                                {$t("edit3.prompt.interactiveUi.onDesc")}
                            </span>
                        </div>
                    </button>
                </div>
            </div>
        {/if}

        {#if !isAvatarPersona}
            <!-- Instructions -->
            <div class="field-group">
                <label for="e3-instructions" class="field-label">
                    <Icon icon="ph:notepad-duotone" width="18" />
                    {$t("editPage.instructionsLabel")}
                    <span class="required">*</span>
                </label>
                <p class="field-hint">
                    {$t("editPage.instructionsDescription")}
                </p>
                <textarea
                    id="e3-instructions"
                    class="field-textarea"
                    bind:value={singleInstruction}
                    rows="8"
                    maxlength={getWeightedRawMaxLength(singleInstruction, 3000)}
                    placeholder={$t("editPage.instructionsPlaceholder")}
                ></textarea>
                <div
                    class="char-counter"
                    class:warning={getWeightedCharCount(singleInstruction) > 2800}
                    class:error={isWeightedLimitReached(singleInstruction, 3000)}
                >
                    {formatWeightedCharCount(singleInstruction)} / 3000
                </div>
            </div>
        {/if}
        {/if}
    </div>
    <!-- End Prompt Tab -->

    <div class="tab-content" class:active={activeTab === "variable"}>
        {#if activeTab === "variable"}
        <!-- Variable System (Advanced Settings) -->
        {#if !isAvatarPersona}
            <VariableEditor bind:persona />
        {/if}
        {/if}
    </div>

    <div class="tab-content" class:active={activeTab === "lore"}>
        {#if activeTab === "lore"}
            <!-- Lorebook System (Advanced Context) -->
            <div class="field-group">
                <label class="field-label">
                    <Icon icon="ph:book-bookmark-duotone" width="18" />
                    {$t("editPage.lorebookLabel")}
                </label>
                <p class="field-hint">
                    {$t("editPage.lorebookDescription")}
                </p>
                <LoreLinker personaId={persona.id} />
            </div>
        {/if}
    </div>

    <div class="tab-content" class:active={activeTab === "style"}>
        {#if activeTab === "style"}
            {#if isAvatarPersona}
                <div class="field-group">
                    <label class="field-label">
                        <Icon icon="ph:sliders-horizontal-duotone" width="18" />
                        {$t("edit3.prompt.advancedTabLabel")}
                    </label>
                    <p class="field-hint">
                        Live2D/VRM 캐릭터의 고급 설정을 관리합니다.
                    </p>
                    <FirstSceneBuilder
                        initialData={persona.first_scene}
                        {availableExpressions}
                        {availableMotions}
                        mode={persona.personaType === "3D" ? "3d" : "live2d"}
                        showLive2DMappingSections={false}
                        hideRuntimeStateFields={persona.personaType === "2.5D"}
                        showCoreFieldEditors={false}
                        showAdvancedFieldEditors={true}
                        onChange={(json) => {
                            firstSceneJson = json;
                            persona.first_scene = json;
                        }}
                    />
                </div>
            {:else}
                <div class="field-group prompt-advanced-group">
                    <div class="field-section-header">
                        <span class="section-kicker">
                            {$t("edit3.prompt.sharedStyle.kicker")}
                        </span>
                        <h3 class="section-title">
                            {$t("edit3.prompt.sharedStyle.sectionTitle")}
                        </h3>
                    </div>
                    <label
                        for="e3-chat-style-css"
                        class="field-label"
                    >
                        <Icon icon="ph:paint-brush-broad-duotone" width="18" />
                        {$t("edit3.prompt.sharedStyle.label")}
                    </label>
                    <p class="field-hint">
                        {$t("edit3.prompt.sharedStyle.description")}
                    </p>
                    <p class="field-hint subtle">
                        {$t("edit3.prompt.sharedStyle.note")}
                    </p>
                    <div class="style-preview-actions">
                        <button
                            type="button"
                            class="btn-util preview-btn"
                            on:click={() => (showStylePreview = true)}
                        >
                            <Icon icon="ph:eye-duotone" width="16" />
                            {$t("edit3.prompt.sharedStyle.previewButton")}
                        </button>
                    </div>
                    <textarea
                        id="e3-chat-style-css"
                        class="field-textarea code-textarea"
                        bind:value={persona.chat_style_css}
                        rows="8"
                        maxlength="12000"
                        placeholder={$t("edit3.prompt.sharedStyle.placeholder")}
                    ></textarea>
                    <div
                        class="char-counter"
                        class:warning={(persona.chat_style_css?.length || 0) > 11000}
                        class:error={(persona.chat_style_css?.length || 0) >= 12000}
                    >
                        {persona.chat_style_css?.length || 0} / 12000
                    </div>
                </div>
            {/if}
        {/if}
    </div>
</div>

{#if showStylePreview}
    <div
        class="style-preview-overlay"
        role="button"
        tabindex="0"
        aria-label={$t("edit3.prompt.sharedStyle.closePreview")}
        on:click={() => (showStylePreview = false)}
        on:keydown={(e) => {
            if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
                showStylePreview = false;
            }
        }}
    >
        <div
            class="style-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="style-preview-title"
            on:click={(e) => e.stopPropagation()}
        >
            {#if persona.chat_style_css?.trim()}
                <svelte:element this={"style"}>{persona.chat_style_css}</svelte:element>
            {/if}

            <div class="style-preview-header">
                <div>
                    <span class="style-preview-kicker">
                        {$t("edit3.prompt.sharedStyle.previewKicker")}
                    </span>
                    <h3 id="style-preview-title" class="style-preview-title">
                        {$t("edit3.prompt.sharedStyle.previewTitle")}
                    </h3>
                    <p class="style-preview-description">
                        {$t("edit3.prompt.sharedStyle.previewDescription")}
                    </p>
                </div>
                <button
                    type="button"
                    class="style-preview-close"
                    on:click={() => (showStylePreview = false)}
                    aria-label={$t("edit3.prompt.sharedStyle.closePreview")}
                >
                    <Icon icon="ph:x-bold" width="18" />
                </button>
            </div>

            <div class="style-preview-body">
                {#if !persona.first_scene?.trim()}
                    <div class="style-preview-empty">
                        {$t("edit3.prompt.sharedStyle.previewEmpty")}
                    </div>
                {/if}

                <div class="style-preview-chat chat2d-surface">
                    {#each stylePreviewBlocks as block (block.id)}
                        {#if block.type === "narration"}
                            {#if containsPreviewHtml(block.content)}
                                <div class="preview-html-block">
                                    {@html block.content}
                                </div>
                            {:else}
                                <ChatRenderer content={block.content} wrapperClass="px-narration" />
                            {/if}
                        {:else if block.type === "dialogue"}
                            <div class="preview-dialogue-wrap">
                                <div class="speaker-name">{block.speaker}</div>
                                <div class="preview-dialogue px-dialogue">
                                    <ChatRenderer
                                        content={block.content}
                                        isMessage={true}
                                        wrapperClass="px-dialogue__content"
                                    />
                                </div>
                            </div>
                        {:else if block.type === "image"}
                            <figure class="preview-image-card">
                                <img
                                    src={block.metadata.static_url || block.url}
                                    alt={block.alt}
                                />
                                <figcaption>
                                    {block.alt || `Image ${block.index}`}
                                </figcaption>
                            </figure>
                        {:else if block.type === "markdown_image"}
                            <figure class="preview-image-card">
                                <img src={block.url} alt={block.alt} />
                                <figcaption>{block.alt || "Generated image"}</figcaption>
                            </figure>
                        {:else if block.type === "code"}
                            <pre class="preview-code"><code>{block.content}</code></pre>
                        {:else if block.type === "user-interaction"}
                            <div class="preview-system-badge">{block.content}</div>
                        {/if}
                    {/each}
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .step-prompt {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .field-section-header {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        margin-bottom: 0.75rem;
    }

    .section-kicker {
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: var(--primary);
    }

    .section-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: var(--foreground);
    }

    /* Tabs */
    .tabs {
        display: flex;
        gap: 0.5rem;
        border-bottom: 2px solid var(--border);
        padding-bottom: 0px;
        margin-bottom: 0.5rem;
    }

    .tab-btn {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.6rem 1rem;
        border: none;
        background: transparent;
        color: var(--muted-foreground);
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
        transition: all 0.2s;
    }

    .tab-btn:hover {
        color: var(--foreground);
        background-color: var(--muted);
        border-radius: 6px 6px 0 0;
    }

    .tab-btn.active {
        color: var(--primary);
        border-bottom-color: var(--primary);
    }

    .tab-label {
        display: inline;
    }

    .tab-content {
        display: none;
        flex-direction: column;
        gap: 1.75rem;
        animation: fadeIn 0.2s ease-in-out;
    }

    .tab-content.active {
        display: flex;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(5px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .visibility-toggle {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
    }

    .vis-btn {
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
        padding: 1rem;
        border-radius: 16px;
        border: 1.5px solid var(--border);
        background: color-mix(in srgb, var(--card) 92%, transparent);
        color: var(--foreground);
        text-align: left;
        transition:
            border-color 0.2s ease,
            background 0.2s ease,
            transform 0.2s ease,
            box-shadow 0.2s ease;
    }

    .vis-btn:hover {
        border-color: color-mix(in srgb, var(--primary) 50%, var(--border));
        transform: translateY(-1px);
    }

    .vis-btn.active {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 12%, var(--card));
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 28%, transparent);
    }

    .vis-text {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        min-width: 0;
    }

    .vis-label {
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--foreground);
    }

    .vis-desc {
        font-size: 0.82rem;
        line-height: 1.35;
        color: var(--muted-foreground);
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

    @media (max-width: 640px) {
        .tabs {
            gap: 0.25rem;
            justify-content: space-between;
        }

        .tab-btn {
            flex: 1 1 0;
            justify-content: center;
            gap: 0;
            padding: 0.7rem 0.4rem;
        }

        .tab-label {
            display: none;
        }
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

    .prompt-advanced-group {
        padding-top: 0.5rem;
        border-top: 1px solid var(--border);
    }

    .style-preview-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 0.2rem;
    }

    .preview-btn {
        gap: 0.45rem;
    }

    .style-preview-overlay {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        background: rgba(10, 12, 18, 0.72);
        backdrop-filter: blur(10px);
    }

    .style-preview-modal {
        width: min(860px, 100%);
        max-height: min(84vh, 920px);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: var(--card);
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.35);
    }

    .style-preview-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.25rem 1.35rem 1rem;
        border-bottom: 1px solid var(--border);
    }

    .style-preview-kicker {
        display: inline-block;
        margin-bottom: 0.25rem;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: var(--primary);
    }

    .style-preview-title {
        margin: 0;
        font-size: 1.08rem;
        font-weight: 800;
        color: var(--foreground);
    }

    .style-preview-description {
        margin: 0.35rem 0 0;
        font-size: 0.85rem;
        line-height: 1.45;
        color: var(--muted-foreground);
    }

    .style-preview-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--background);
        color: var(--foreground);
        cursor: pointer;
        flex-shrink: 0;
    }

    .style-preview-body {
        overflow: auto;
        padding: 1.1rem 1.35rem 1.35rem;
        background:
            radial-gradient(circle at top, rgba(255, 255, 255, 0.04), transparent 38%),
            var(--background);
    }

    .style-preview-empty {
        margin-bottom: 0.9rem;
        padding: 0.8rem 0.95rem;
        border-radius: 14px;
        background: color-mix(in srgb, var(--muted) 82%, transparent);
        color: var(--muted-foreground);
        font-size: 0.85rem;
        line-height: 1.45;
    }

    .style-preview-chat {
        display: flex;
        flex-direction: column;
        gap: 0.95rem;
    }

    .preview-html-block {
        color: var(--foreground);
    }

    .preview-dialogue-wrap {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        align-items: flex-start;
    }

    .preview-dialogue {
        max-width: min(560px, 100%);
    }

    .preview-image-card {
        margin: 0;
        overflow: hidden;
        border-radius: 18px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--muted) 78%, transparent);
    }

    .preview-image-card img {
        display: block;
        width: 100%;
        max-height: 340px;
        object-fit: cover;
    }

    .preview-image-card figcaption {
        padding: 0.75rem 0.9rem;
        font-size: 0.82rem;
        color: var(--muted-foreground);
    }

    .preview-code {
        margin: 0;
        padding: 0.95rem 1rem;
        border-radius: 16px;
        background: #0b1020;
        color: #dbe6ff;
        overflow: auto;
        font-size: 0.84rem;
        line-height: 1.6;
    }

    .preview-system-badge {
        display: inline-flex;
        align-items: center;
        align-self: flex-start;
        padding: 0.45rem 0.75rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        color: var(--primary);
        font-size: 0.8rem;
        font-weight: 700;
    }

    .field-hint.subtle {
        margin-top: -0.1rem;
    }

    .code-textarea {
        font-family:
            "JetBrains Mono", "Fira Code", "SFMono-Regular", Consolas,
            "Liberation Mono", monospace;
        font-size: 0.85rem;
        line-height: 1.6;
        white-space: pre;
    }

    @media (max-width: 640px) {
        .visibility-toggle {
            grid-template-columns: 1fr;
        }

        .style-preview-overlay {
            padding: 0.9rem;
        }

        .style-preview-modal {
            max-height: 88vh;
            border-radius: 20px;
        }

        .style-preview-header,
        .style-preview-body {
            padding-left: 1rem;
            padding-right: 1rem;
        }
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

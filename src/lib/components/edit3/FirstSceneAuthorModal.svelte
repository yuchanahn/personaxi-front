<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import ChatRenderer from "$lib/components/chat/ChatRenderer.svelte";
    import AssetPreview from "$lib/components/AssetPreview.svelte";
    import type { ImageMetadata, Persona } from "$lib/types";
    import {
        formatWeightedCharCount,
        getWeightedCharCount,
        isWeightedLimitReached,
    } from "$lib/utils/weightedText";

    export let persona: Persona;

    type EditorBlock =
        | { id: string; kind: "narration"; text: string }
        | { id: string; kind: "dialogue"; speaker: string; text: string }
        | { id: string; kind: "image"; index: number }
        | { id: string; kind: "classBlock"; className: string; text: string };

    const dispatch = createEventDispatcher<{ close: void }>();
    const TOKEN_REGEX =
        /<((?:say|dialogue)) speaker="([^"]+)">([\s\S]*?)<\/(?:say|dialogue)>|<(img) (\d+)>|<div class="([^"]+)">([\s\S]*?)<\/div>/g;

    let editorBlocks: EditorBlock[] = [];
    let selectedBlockId = "";
    let customSpeaker = "";

    onMount(() => {
        editorBlocks = parseFirstSceneBlocks(persona.first_scene || "");
        if (editorBlocks.length > 0) {
            selectedBlockId = editorBlocks[0].id;
        }
    });

    function createBlockId() {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
            return crypto.randomUUID();
        }

        return `block-${Math.random().toString(36).slice(2, 10)}`;
    }

    function createNarrationBlock(text = ""): EditorBlock {
        return { id: createBlockId(), kind: "narration", text };
    }

    function createDialogueBlock(speaker = "{{char}}", text = "..."): EditorBlock {
        return { id: createBlockId(), kind: "dialogue", speaker, text };
    }

    function createImageBlock(index: number): EditorBlock {
        return {
            id: createBlockId(),
            kind: "image",
            index: Math.max(0, Number.isFinite(index) ? index : 0),
        };
    }

    function createClassBlock(className: string, text = "..."): EditorBlock {
        return { id: createBlockId(), kind: "classBlock", className, text };
    }

    function closeModal() {
        dispatch("close");
    }

    function handleWindowKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            closeModal();
        }
    }

    function replacePlaceholders(text: string) {
        return text
            .replaceAll("{{char}}", persona.name || "Character")
            .replaceAll("{{user}}", "User");
    }

    function pushNarrationBlocks(target: EditorBlock[], rawText: string) {
        const normalized = rawText.replace(/\r\n/g, "\n");
        const segments = normalized
            .split(/\n{2,}/)
            .map((segment) => segment.trim())
            .filter(Boolean);

        for (const segment of segments) {
            target.push(createNarrationBlock(segment));
        }
    }

    function parseFirstSceneBlocks(raw: string) {
        const blocks: EditorBlock[] = [];
        const source = raw.replace(/\r\n/g, "\n").trim();

        if (!source) return blocks;

        let cursor = 0;
        let match: RegExpExecArray | null;

        while ((match = TOKEN_REGEX.exec(source)) !== null) {
            const leading = source.slice(cursor, match.index);
            if (leading.trim()) {
                pushNarrationBlocks(blocks, leading);
            }

            if (match[1]) {
                blocks.push(createDialogueBlock(match[2].trim(), match[3].trim()));
            } else if (match[4]) {
                blocks.push(createImageBlock(parseInt(match[5], 10)));
            } else if (match[6]) {
                blocks.push(createClassBlock(match[6].trim(), match[7].trim()));
            }

            cursor = match.index + match[0].length;
        }

        const trailing = source.slice(cursor);
        if (trailing.trim()) {
            pushNarrationBlocks(blocks, trailing);
        }

        return blocks;
    }

    function serializeFirstSceneBlocks(blocks: EditorBlock[]) {
        return blocks
            .map((block) => {
                if (block.kind === "narration") {
                    return block.text.trim();
                }

                if (block.kind === "dialogue") {
                    const safeSpeaker = block.speaker.trim().replaceAll('"', "'");
                    const safeText = block.text.trim();
                    return safeSpeaker && safeText
                        ? `<say speaker="${safeSpeaker}">${safeText}</say>`
                        : "";
                }

                if (block.kind === "image") {
                    const safeIndex = Number.isFinite(block.index)
                        ? Math.max(0, Math.floor(block.index))
                        : 0;
                    return `<img ${safeIndex}>`;
                }

                const safeClassName = block.className.trim().replaceAll('"', "'");
                const safeText = block.text.trim();
                return safeClassName && safeText
                    ? `<div class="${safeClassName}">\n${safeText}\n</div>`
                    : "";
            })
            .filter(Boolean)
            .join("\n\n")
            .trim();
    }

    function syncBlocks(nextBlocks: EditorBlock[], nextSelectedId = selectedBlockId) {
        editorBlocks = nextBlocks;
        selectedBlockId = nextSelectedId;
        persona.first_scene = serializeFirstSceneBlocks(editorBlocks);
    }

    function getSelectedInsertIndex() {
        const selectedIndex = editorBlocks.findIndex(
            (block) => block.id === selectedBlockId,
        );

        if (selectedIndex === -1) {
            return editorBlocks.length;
        }

        return selectedIndex + 1;
    }

    function insertBlock(block: EditorBlock) {
        const insertIndex = getSelectedInsertIndex();
        const nextBlocks = [...editorBlocks];
        nextBlocks.splice(insertIndex, 0, block);
        syncBlocks(nextBlocks, block.id);
    }

    function insertNarration() {
        insertBlock(createNarrationBlock("..."));
    }

    function insertDialogue(speaker: string) {
        insertBlock(createDialogueBlock(speaker, "..."));
    }

    function insertCustomSpeakerDialogue() {
        const speaker = customSpeaker.trim().replaceAll('"', "'");
        if (!speaker) return;
        insertDialogue(speaker);
    }

    function insertClassBlock(className: string) {
        insertBlock(createClassBlock(className, "..."));
    }

    function insertImage(index: number) {
        insertBlock(createImageBlock(index));
    }

    function moveBlock(blockId: string, direction: -1 | 1) {
        const index = editorBlocks.findIndex((block) => block.id === blockId);
        const nextIndex = index + direction;

        if (index < 0 || nextIndex < 0 || nextIndex >= editorBlocks.length) {
            return;
        }

        const nextBlocks = [...editorBlocks];
        const [target] = nextBlocks.splice(index, 1);
        nextBlocks.splice(nextIndex, 0, target);
        syncBlocks(nextBlocks, blockId);
    }

    function removeBlock(blockId: string) {
        const nextBlocks = editorBlocks.filter((block) => block.id !== blockId);
        const nextSelectedId =
            selectedBlockId === blockId
                ? nextBlocks[Math.max(0, nextBlocks.length - 1)]?.id || ""
                : selectedBlockId;
        syncBlocks(nextBlocks, nextSelectedId);
    }

    function updateNarration(blockId: string, text: string) {
        syncBlocks(
            editorBlocks.map((block) =>
                block.id === blockId && block.kind === "narration"
                    ? { ...block, text }
                    : block,
            ),
            blockId,
        );
    }

    function updateDialogueSpeaker(blockId: string, speaker: string) {
        syncBlocks(
            editorBlocks.map((block) =>
                block.id === blockId && block.kind === "dialogue"
                    ? { ...block, speaker }
                    : block,
            ),
            blockId,
        );
    }

    function updateDialogueText(blockId: string, text: string) {
        syncBlocks(
            editorBlocks.map((block) =>
                block.id === blockId && block.kind === "dialogue"
                    ? { ...block, text }
                    : block,
            ),
            blockId,
        );
    }

    function updateClassName(blockId: string, className: string) {
        syncBlocks(
            editorBlocks.map((block) =>
                block.id === blockId && block.kind === "classBlock"
                    ? { ...block, className }
                    : block,
            ),
            blockId,
        );
    }

    function updateClassText(blockId: string, text: string) {
        syncBlocks(
            editorBlocks.map((block) =>
                block.id === blockId && block.kind === "classBlock"
                    ? { ...block, text }
                    : block,
            ),
            blockId,
        );
    }

    function updateImageIndex(blockId: string, rawValue: string) {
        const parsed = parseInt(rawValue, 10);
        const nextIndex = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;

        syncBlocks(
            editorBlocks.map((block) =>
                block.id === blockId && block.kind === "image"
                    ? { ...block, index: nextIndex }
                    : block,
            ),
            blockId,
        );
    }

    function buildPreviewAsset(
        metadata?: ImageMetadata,
        fallbackUrl = "",
    ): ImageMetadata | null {
        if (!metadata) {
            return fallbackUrl
                ? {
                      url: fallbackUrl,
                      description: "scene image",
                      type: "image",
                  }
                : null;
        }

        if (metadata.is_secret) {
            if (!metadata.blur_url) {
                return null;
            }

            return {
                ...metadata,
                url: metadata.blur_url,
                type: metadata.type || "image",
            };
        }

        return {
            ...metadata,
            url: metadata.static_url || metadata.url || fallbackUrl,
        };
    }

    function getAsset(block: Extract<EditorBlock, { kind: "image" }>) {
        return persona.image_metadatas?.[block.index];
    }

    function getPreviewUrl(asset: ImageMetadata) {
        if (asset.is_secret) {
            return asset.blur_url || asset.static_url || "";
        }

        return asset.static_url || asset.url || "";
    }

    function getBlockLabel(block: EditorBlock) {
        if (block.kind === "dialogue") {
            return $t("edit3.prompt.firstSceneComposer.blockDialogue");
        }

        if (block.kind === "image") {
            return $t("edit3.prompt.firstSceneComposer.blockImage");
        }

        if (block.kind === "classBlock") {
            return `${$t("edit3.prompt.firstSceneComposer.blockClass")} ${block.className}`;
        }

        return $t("edit3.prompt.firstSceneComposer.blockNarration");
    }

    function isSelected(blockId: string) {
        return selectedBlockId === blockId;
    }

    $: weightedCount = formatWeightedCharCount(persona.first_scene || "");
    $: weightedCountRaw = getWeightedCharCount(persona.first_scene || "");
    $: isLimitWarning = weightedCountRaw > 2400;
    $: isLimitReached = isWeightedLimitReached(persona.first_scene || "", 2500);
</script>

<svelte:window on:keydown={handleWindowKeydown} />

<div
    class="composer-overlay"
    role="button"
    tabindex="0"
    aria-label={$t("common.close")}
    on:click={closeModal}
    on:keydown={(event) => {
        if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
            closeModal();
        }
    }}
>
    <div
        class="composer-modal"
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-label={$t("edit3.prompt.firstSceneComposer.title")}
        on:click={(event) => event.stopPropagation()}
    >
        <button
            type="button"
            class="composer-close"
            on:click={closeModal}
            aria-label={$t("common.close")}
        >
            <Icon icon="ph:x-bold" width="18" />
        </button>

        <div class="composer-layout">
            <aside class="composer-sidebar">
                <div class="composer-panel composer-panel--tools">
                    <div class="panel-header">
                        <div>
                            <div class="panel-title">
                                {$t("edit3.prompt.firstSceneComposer.toolkitLabel")}
                            </div>
                            <p class="panel-hint">
                                {$t("edit3.prompt.firstSceneComposer.toolkitHint")}
                            </p>
                        </div>
                    </div>

                    <div class="tool-grid">
                        <button type="button" class="tool-btn" on:click={insertNarration}>
                            <Icon icon="ph:text-t-duotone" width="18" />
                            {$t("edit3.prompt.firstSceneComposer.insertNarration")}
                        </button>
                        <button
                            type="button"
                            class="tool-btn"
                            on:click={() => insertDialogue("{{char}}")}
                        >
                            <Icon icon="ph:chat-circle-text-duotone" width="18" />
                            {$t("edit3.prompt.firstSceneComposer.insertCharDialogue")}
                        </button>
                        <button
                            type="button"
                            class="tool-btn"
                            on:click={() => insertDialogue("{{user}}")}
                        >
                            <Icon icon="ph:user-circle-duotone" width="18" />
                            {$t("edit3.prompt.firstSceneComposer.insertUserDialogue")}
                        </button>
                        <button
                            type="button"
                            class="tool-btn"
                            on:click={() => insertClassBlock("px-thought")}
                        >
                            <Icon icon="ph:brain-duotone" width="18" />
                            {$t("edit3.prompt.firstSceneComposer.insertThought")}
                        </button>
                        <button
                            type="button"
                            class="tool-btn"
                            on:click={() => insertClassBlock("px-sfx")}
                        >
                            <Icon icon="ph:waves-duotone" width="18" />
                            {$t("edit3.prompt.firstSceneComposer.insertSfx")}
                        </button>
                        <button
                            type="button"
                            class="tool-btn"
                            on:click={() => insertClassBlock("px-system")}
                        >
                            <Icon icon="ph:terminal-window-duotone" width="18" />
                            {$t("edit3.prompt.firstSceneComposer.insertSystem")}
                        </button>
                        <button
                            type="button"
                            class="tool-btn"
                            on:click={() => insertClassBlock("px-choice-tension")}
                        >
                            <Icon icon="ph:sword-duotone" width="18" />
                            {$t("edit3.prompt.firstSceneComposer.insertChoice")}
                        </button>
                        <button
                            type="button"
                            class="tool-btn"
                            on:click={() => insertClassBlock("px-image-tag")}
                        >
                            <Icon icon="ph:image-square-duotone" width="18" />
                            {$t("edit3.prompt.firstSceneComposer.insertImageTag")}
                        </button>
                    </div>

                    <div class="custom-speaker-box">
                        <label class="custom-speaker-label" for="first-scene-custom-speaker">
                            {$t("edit3.prompt.firstSceneComposer.customSpeakerLabel")}
                        </label>
                        <div class="custom-speaker-row">
                            <input
                                id="first-scene-custom-speaker"
                                class="custom-speaker-input"
                                type="text"
                                bind:value={customSpeaker}
                                placeholder={$t(
                                    "edit3.prompt.firstSceneComposer.customSpeakerPlaceholder",
                                )}
                            />
                            <button
                                type="button"
                                class="tool-btn tool-btn--accent"
                                on:click={insertCustomSpeakerDialogue}
                                disabled={!customSpeaker.trim()}
                            >
                                <Icon icon="ph:pen-nib-duotone" width="18" />
                                {$t(
                                    "edit3.prompt.firstSceneComposer.insertCustomSpeaker",
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div class="composer-panel composer-panel--assets">
                    <div class="panel-header">
                        <div>
                            <div class="panel-title">
                                {$t("edit3.prompt.firstSceneComposer.assetsLabel")}
                            </div>
                            <p class="panel-hint">
                                {$t("edit3.prompt.firstSceneComposer.assetsHint")}
                            </p>
                        </div>
                    </div>

                    {#if persona.image_metadatas?.length}
                        <div class="asset-list">
                            {#each persona.image_metadatas as asset, index}
                                <button
                                    type="button"
                                    class="asset-card"
                                    on:click={() => insertImage(index)}
                                >
                                    <div class="asset-thumb">
                                        {#if getPreviewUrl(asset)}
                                            <img
                                                src={getPreviewUrl(asset)}
                                                alt={asset.description || `img ${index}`}
                                                loading="lazy"
                                            />
                                        {:else}
                                            <div class="asset-fallback">
                                                <Icon icon="ph:image-duotone" width="18" />
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="asset-meta">
                                        <div class="asset-index">{`<img ${index}>`}</div>
                                        <div class="asset-description">
                                            {asset.description ||
                                                $t(
                                                    "edit3.prompt.firstSceneComposer.assetFallback",
                                                )}
                                        </div>
                                    </div>
                                </button>
                            {/each}
                        </div>
                    {:else}
                        <div class="empty-state">
                            {$t("edit3.prompt.firstSceneComposer.noAssets")}
                        </div>
                    {/if}
                </div>
            </aside>

            <section class="composer-editor">
                <div class="composer-panel composer-panel--preview">
                    <div class="panel-header panel-header--preview">
                        <div>
                            <div class="panel-title">
                                {$t("edit3.prompt.firstSceneComposer.previewLabel")}
                            </div>
                            <p class="panel-hint">
                                {$t("edit3.prompt.firstSceneComposer.previewHint")}
                            </p>
                            <p class="panel-hint subtle">
                                {$t("edit3.prompt.firstSceneComposer.previewHelper")}
                            </p>
                        </div>
                        <div
                            class="char-counter"
                            class:warning={isLimitWarning}
                            class:error={isLimitReached}
                        >
                            {weightedCount} / 2500
                        </div>
                    </div>

                    {#if !editorBlocks.length}
                        <div class="empty-canvas">
                            <p>{$t("edit3.prompt.firstSceneComposer.emptyPreview")}</p>
                            <button type="button" class="tool-btn" on:click={insertNarration}>
                                <Icon icon="ph:plus-bold" width="16" />
                                {$t("edit3.prompt.firstSceneComposer.insertNarration")}
                            </button>
                        </div>
                    {:else}
                        <div class="editor-canvas">
                            {#each editorBlocks as block, index (block.id)}
                                <article
                                    class="editable-block"
                                    class:selected={isSelected(block.id)}
                                    role="button"
                                    tabindex="0"
                                    on:click={() => (selectedBlockId = block.id)}
                                    on:keydown={(event) => {
                                        if (
                                            event.key === "Enter" ||
                                            event.key === " "
                                        ) {
                                            selectedBlockId = block.id;
                                        }
                                    }}
                                >
                                    <div class="block-toolbar">
                                        <span class="block-badge">{getBlockLabel(block)}</span>
                                        <div class="block-actions">
                                            <button
                                                type="button"
                                                class="icon-btn"
                                                on:click|stopPropagation={() =>
                                                    moveBlock(block.id, -1)}
                                                disabled={index === 0}
                                                aria-label={$t(
                                                    "edit3.prompt.firstSceneComposer.moveUp",
                                                )}
                                            >
                                                <Icon icon="ph:arrow-up-bold" width="14" />
                                            </button>
                                            <button
                                                type="button"
                                                class="icon-btn"
                                                on:click|stopPropagation={() =>
                                                    moveBlock(block.id, 1)}
                                                disabled={index === editorBlocks.length - 1}
                                                aria-label={$t(
                                                    "edit3.prompt.firstSceneComposer.moveDown",
                                                )}
                                            >
                                                <Icon icon="ph:arrow-down-bold" width="14" />
                                            </button>
                                            <button
                                                type="button"
                                                class="icon-btn danger"
                                                on:click|stopPropagation={() =>
                                                    removeBlock(block.id)}
                                                aria-label={$t(
                                                    "edit3.prompt.firstSceneComposer.deleteBlock",
                                                )}
                                            >
                                                <Icon icon="ph:trash-duotone" width="14" />
                                            </button>
                                        </div>
                                    </div>

                                    {#if block.kind === "narration"}
                                        {#if isSelected(block.id)}
                                            <textarea
                                                class="inline-editor inline-editor--narration"
                                                rows="4"
                                                value={block.text}
                                                on:input={(event) =>
                                                    updateNarration(
                                                        block.id,
                                                        (event.currentTarget as HTMLTextAreaElement)
                                                            .value,
                                                    )}
                                            ></textarea>
                                        {:else}
                                            <ChatRenderer
                                                content={replacePlaceholders(block.text)}
                                                wrapperClass="px-narration"
                                            />
                                        {/if}
                                    {:else if block.kind === "dialogue"}
                                        {#if isSelected(block.id)}
                                            <div class="dialogue-editor">
                                                <input
                                                    class="inline-speaker"
                                                    type="text"
                                                    value={block.speaker}
                                                    on:input={(event) =>
                                                        updateDialogueSpeaker(
                                                            block.id,
                                                            (event.currentTarget as HTMLInputElement)
                                                                .value,
                                                        )}
                                                    placeholder={"{{char}} / {{user}} / 이름"}
                                                />
                                                <div class="preview-dialogue px-dialogue">
                                                    <textarea
                                                        class="inline-editor inline-editor--dialogue"
                                                        rows="3"
                                                        value={block.text}
                                                        on:input={(event) =>
                                                            updateDialogueText(
                                                                block.id,
                                                                (event.currentTarget as HTMLTextAreaElement)
                                                                    .value,
                                                            )}
                                                    ></textarea>
                                                </div>
                                            </div>
                                        {:else}
                                            <div class="preview-dialogue-wrap">
                                                <div class="speaker-name">
                                                    {replacePlaceholders(block.speaker)}
                                                </div>
                                                <div class="preview-dialogue px-dialogue">
                                                    <ChatRenderer
                                                        content={replacePlaceholders(block.text)}
                                                        isMessage={true}
                                                        wrapperClass="px-dialogue__content"
                                                    />
                                                </div>
                                            </div>
                                        {/if}
                                    {:else if block.kind === "classBlock"}
                                        {#if isSelected(block.id)}
                                            <div class="class-block-editor">
                                                <input
                                                    class="inline-classname"
                                                    type="text"
                                                    value={block.className}
                                                    on:input={(event) =>
                                                        updateClassName(
                                                            block.id,
                                                            (event.currentTarget as HTMLInputElement)
                                                                .value,
                                                        )}
                                                    placeholder="px-thought"
                                                />
                                                <div class="class-block-surface">
                                                    <textarea
                                                        class="inline-editor inline-editor--class"
                                                        rows="4"
                                                        value={block.text}
                                                        on:input={(event) =>
                                                            updateClassText(
                                                                block.id,
                                                                (event.currentTarget as HTMLTextAreaElement)
                                                                    .value,
                                                            )}
                                                    ></textarea>
                                                </div>
                                            </div>
                                        {:else}
                                            <div class={block.className}>
                                                <ChatRenderer
                                                    content={replacePlaceholders(block.text)}
                                                />
                                            </div>
                                        {/if}
                                    {:else if block.kind === "image"}
                                        {@const previewAsset = buildPreviewAsset(
                                            getAsset(block),
                                            getAsset(block)?.url || "",
                                        )}
                                        <div class="image-editor">
                                            <div class="preview-image-card">
                                                {#if previewAsset}
                                                    <AssetPreview
                                                        asset={previewAsset}
                                                        showVideoPosterFallback={true}
                                                        enableVideoPlayback={true}
                                                        useSimpleVideoLayout={previewAsset.type ===
                                                            "video"}
                                                    />
                                                {:else}
                                                    <div class="missing-image">
                                                        <Icon
                                                            icon="ph:image-broken-duotone"
                                                            width="24"
                                                        />
                                                        <span>
                                                            {$t(
                                                                "edit3.prompt.firstSceneComposer.missingAsset",
                                                            )}
                                                        </span>
                                                    </div>
                                                {/if}
                                            </div>
                                            <div class="image-meta-editor">
                                                <label class="meta-field">
                                                    <span>
                                                        {$t(
                                                            "edit3.prompt.firstSceneComposer.imageIndexLabel",
                                                        )}
                                                    </span>
                                                    <input
                                                        class="inline-number"
                                                        type="number"
                                                        min="0"
                                                        value={block.index}
                                                        on:input={(event) =>
                                                            updateImageIndex(
                                                                block.id,
                                                                (event.currentTarget as HTMLInputElement)
                                                                    .value,
                                                            )}
                                                    />
                                                </label>
                                                <div class="image-description">
                                                    {getAsset(block)?.description ||
                                                        $t(
                                                            "edit3.prompt.firstSceneComposer.assetFallback",
                                                        )}
                                                </div>
                                            </div>
                                        </div>
                                    {/if}
                                </article>
                            {/each}
                        </div>
                    {/if}
                </div>
            </section>
        </div>
    </div>
</div>

<style>
    .composer-overlay {
        position: fixed;
        inset: 0;
        z-index: 1100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(8, 10, 18, 0.78);
        backdrop-filter: blur(10px);
    }

    .composer-modal {
        position: relative;
        width: min(1480px, 100%);
        height: min(92vh, 1120px);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        border-radius: 24px;
        border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
        background: color-mix(in srgb, var(--card) 94%, black 6%);
        box-shadow: 0 36px 90px rgba(0, 0, 0, 0.4);
    }

    .composer-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        top: 1rem;
        right: 1rem;
        z-index: 2;
        width: 38px;
        height: 38px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
        background: color-mix(in srgb, var(--background) 86%, black 14%);
        color: var(--foreground);
        cursor: pointer;
        flex-shrink: 0;
    }

    .composer-layout {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: 360px minmax(0, 1fr);
        gap: 1rem;
        padding: 3.25rem 1.35rem 1.35rem;
        overflow: hidden;
    }

    .composer-sidebar,
    .composer-editor {
        min-height: 0;
    }

    .composer-sidebar {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        overflow: hidden;
    }

    .composer-editor {
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .composer-panel {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        padding: 1rem;
        border-radius: 20px;
        border: 1px solid color-mix(in srgb, var(--border) 84%, transparent);
        background: color-mix(in srgb, var(--background) 82%, var(--card));
        min-height: 0;
    }

    .composer-panel--tools {
        flex: 0 0 auto;
    }

    .composer-panel--assets {
        flex: 1 1 auto;
        overflow: hidden;
    }

    .composer-panel--preview {
        flex: 1 1 auto;
        overflow: hidden;
    }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.75rem;
        flex: 0 0 auto;
    }

    .panel-header--preview {
        padding-bottom: 0.8rem;
        border-bottom: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
    }

    .panel-title {
        font-size: 0.96rem;
        font-weight: 800;
        color: var(--foreground);
    }

    .panel-hint {
        margin: 0.22rem 0 0;
        font-size: 0.8rem;
        line-height: 1.45;
        color: var(--muted-foreground);
    }

    .panel-hint.subtle {
        opacity: 0.85;
    }

    .tool-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.7rem;
    }

    .tool-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        min-height: 42px;
        padding: 0.65rem 0.8rem;
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
        background: color-mix(in srgb, var(--card) 88%, transparent);
        color: var(--foreground);
        font-size: 0.86rem;
        font-weight: 700;
        cursor: pointer;
        transition:
            border-color 0.18s ease,
            background 0.18s ease,
            transform 0.18s ease;
    }

    .tool-btn:hover:not(:disabled) {
        border-color: color-mix(in srgb, var(--primary) 55%, var(--border));
        background: color-mix(in srgb, var(--primary) 10%, var(--card));
        transform: translateY(-1px);
    }

    .tool-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }

    .tool-btn--accent {
        white-space: nowrap;
    }

    .custom-speaker-box {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .custom-speaker-label {
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--foreground);
    }

    .custom-speaker-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 0.65rem;
    }

    .custom-speaker-input,
    .inline-speaker,
    .inline-classname,
    .inline-number,
    .inline-editor {
        width: 100%;
        box-sizing: border-box;
        border-radius: 14px;
        border: 1.5px solid color-mix(in srgb, var(--border) 88%, transparent);
        background: var(--input);
        color: var(--foreground);
        padding: 0.8rem 0.9rem;
        font-family: inherit;
        transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease;
    }

    .custom-speaker-input:focus,
    .inline-speaker:focus,
    .inline-classname:focus,
    .inline-number:focus,
    .inline-editor:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px hsla(var(--primary-hsl, 0 0% 50%) / 0.12);
    }

    .inline-editor {
        resize: vertical;
        line-height: 1.72;
    }

    .inline-editor--dialogue {
        min-height: 110px;
        background: transparent;
        border: none;
        box-shadow: none;
        padding: 0;
        color: inherit;
    }

    .inline-editor--dialogue:focus {
        box-shadow: none;
        border: none;
    }

    .inline-editor--narration,
    .inline-editor--class {
        min-height: 120px;
    }

    .asset-list {
        flex: 1;
        min-height: 0;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
        padding-right: 0.15rem;
    }

    .asset-card {
        display: grid;
        grid-template-columns: 92px minmax(0, 1fr);
        gap: 0.75rem;
        align-items: center;
        padding: 0.7rem;
        border-radius: 16px;
        border: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
        background: color-mix(in srgb, var(--card) 88%, transparent);
        color: inherit;
        text-align: left;
        cursor: pointer;
        transition:
            border-color 0.18s ease,
            transform 0.18s ease,
            background 0.18s ease;
    }

    .asset-card:hover {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--primary) 55%, var(--border));
        background: color-mix(in srgb, var(--primary) 8%, var(--card));
    }

    .asset-thumb {
        overflow: hidden;
        border-radius: 12px;
        aspect-ratio: 16 / 9;
        border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
        background: color-mix(in srgb, var(--background) 82%, var(--card));
    }

    .asset-thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .asset-fallback,
    .missing-image {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        color: var(--muted-foreground);
    }

    .missing-image {
        flex-direction: column;
        gap: 0.45rem;
        min-height: 180px;
        font-size: 0.84rem;
    }

    .asset-meta {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        min-width: 0;
    }

    .asset-index {
        font-size: 0.8rem;
        font-weight: 800;
        color: var(--primary);
        font-family:
            "JetBrains Mono", "Fira Code", "SFMono-Regular", Consolas,
            "Liberation Mono", monospace;
    }

    .asset-description,
    .image-description {
        font-size: 0.8rem;
        line-height: 1.45;
        color: var(--muted-foreground);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .editor-canvas {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 0.35rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        background:
            radial-gradient(circle at top, rgba(255, 255, 255, 0.03), transparent 34%),
            color-mix(in srgb, var(--background) 90%, black 10%);
        border-radius: 18px;
    }

    .editable-block {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.95rem;
        border-radius: 18px;
        border: 1px solid color-mix(in srgb, var(--border) 84%, transparent);
        background: color-mix(in srgb, var(--card) 84%, transparent);
        transition:
            border-color 0.18s ease,
            background 0.18s ease,
            transform 0.18s ease;
        cursor: pointer;
    }

    .editable-block:hover {
        border-color: color-mix(in srgb, var(--primary) 38%, var(--border));
    }

    .editable-block.selected {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 8%, var(--card));
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 24%, transparent);
    }

    .block-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
    }

    .block-badge {
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        color: var(--primary);
    }

    .block-actions {
        display: flex;
        align-items: center;
        gap: 0.35rem;
    }

    .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
        background: color-mix(in srgb, var(--card) 88%, transparent);
        color: var(--foreground);
        cursor: pointer;
    }

    .icon-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .icon-btn.danger {
        color: #ff7f7f;
    }

    .dialogue-editor,
    .class-block-editor,
    .image-editor {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
    }

    .preview-dialogue-wrap {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        align-items: flex-start;
    }

    .preview-dialogue {
        max-width: min(640px, 100%);
    }

    .speaker-name {
        font-size: 0.82rem;
        font-weight: 800;
        color: var(--muted-foreground);
    }

    .class-block-surface {
        padding: 0.85rem;
        border-radius: 16px;
        border: 1px dashed color-mix(in srgb, var(--primary) 35%, var(--border));
        background: color-mix(in srgb, var(--card) 86%, transparent);
    }

    .preview-image-card {
        overflow: hidden;
        border-radius: 18px;
        border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
        background: color-mix(in srgb, var(--card) 92%, transparent);
    }

    .preview-image-card :global(.asset-preview-media),
    .preview-image-card :global(.video-container),
    .preview-image-card :global(.fallback) {
        width: 100%;
        height: 100%;
        min-height: 220px;
    }

    .preview-image-card :global(.asset-preview-media),
    .preview-image-card img {
        display: block;
        width: 100%;
        max-height: 540px;
        object-fit: contain;
        background: color-mix(in srgb, var(--background) 94%, var(--card));
    }

    .image-meta-editor {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        flex-wrap: wrap;
    }

    .meta-field {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--foreground);
    }

    .inline-number {
        width: 88px;
        padding-top: 0.55rem;
        padding-bottom: 0.55rem;
    }

    .char-counter {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--muted-foreground);
        text-align: right;
        white-space: nowrap;
    }

    .char-counter.warning {
        color: orange;
    }

    .char-counter.error {
        color: var(--destructive);
    }

    .empty-state,
    .empty-canvas {
        padding: 0.95rem 1rem;
        border-radius: 14px;
        background: color-mix(in srgb, var(--muted) 82%, transparent);
        color: var(--muted-foreground);
        font-size: 0.84rem;
        line-height: 1.5;
    }

    .empty-canvas {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.85rem;
    }

    .empty-canvas p {
        margin: 0;
    }

    @media (max-width: 1180px) {
        .composer-layout {
            grid-template-columns: 320px minmax(0, 1fr);
        }
    }

    @media (max-width: 980px) {
        .composer-modal {
            height: 94vh;
        }

        .composer-layout {
            grid-template-columns: 1fr;
            overflow: auto;
        }

        .composer-sidebar {
            overflow: visible;
        }

        .composer-panel--assets {
            max-height: 300px;
        }

        .composer-editor {
            min-height: 560px;
        }
    }

    @media (max-width: 720px) {
        .composer-overlay {
            padding: 0.6rem;
        }

        .composer-modal {
            border-radius: 18px;
        }

        .composer-layout {
            padding: 3rem 0.95rem 0.95rem;
        }

        .tool-grid {
            grid-template-columns: 1fr;
        }

        .custom-speaker-row {
            grid-template-columns: 1fr;
        }

        .asset-card {
            grid-template-columns: 80px minmax(0, 1fr);
        }

        .panel-header--preview {
            flex-direction: column;
            align-items: flex-start;
        }
    }
</style>

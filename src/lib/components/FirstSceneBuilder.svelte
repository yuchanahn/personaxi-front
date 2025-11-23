<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { t } from "svelte-i18n";
    const dispatch = createEventDispatcher();
    export let initialData: string | null = null;
    export let onChange: (jsonStr: string) => void = () => {};

    let body_desc = "";
    let anim_list = "";
    let core_desire = "";
    let contradiction = "";
    let personality = "";
    let values = "";
    let mem_list = "";
    let emotion_triggers = "";
    let short_term_memory = "";
    let last_atmosphere = "";
    let current_emotion = "";

    let initialized = false;

    function generateJson() {
        const obj = {
            body_desc,
            anim_list,
            core_desire,
            contradiction,
            personality,
            values,
            mem_list,
            emotion_triggers,
            short_term_memory,
            last_atmosphere,
            current_emotion,
        };
        const jsonStr = JSON.stringify(obj, null, 2);
        onChange(jsonStr);
        dispatch("change", jsonStr);
    }

    function reset() {
        body_desc = "";
        anim_list = "";
        core_desire = "";
        contradiction = "";
        personality = "";
        values = "";
        mem_list = "";
        emotion_triggers = "";
        short_term_memory = "";
        last_atmosphere = "";
        current_emotion = "";
        generateJson();
    }

    // Only trigger onChange after initialization complete
    $: body_desc,
        anim_list,
        core_desire,
        contradiction,
        personality,
        values,
        mem_list,
        emotion_triggers,
        short_term_memory,
        last_atmosphere,
        current_emotion,
        initialized && generateJson();

    onMount(() => {
        if (initialData) {
            try {
                const data = JSON.parse(initialData);
                body_desc = data.body_desc ?? "";
                anim_list = data.anim_list ?? "";
                core_desire = data.core_desire ?? "";
                contradiction = data.contradiction ?? "";
                personality = data.personality ?? "";
                values = data.values ?? "";
                mem_list = data.mem_list ?? "";
                emotion_triggers = data.emotion_triggers ?? "";
                short_term_memory = data.short_term_memory ?? "";
                last_atmosphere = data.last_atmosphere ?? "";
                current_emotion = data.current_emotion ?? "";

                // Mark initialized and trigger onChange
                initialized = true;
            } catch (e) {
                console.error("FirstSceneBuilder: initialData parse error", e);
                initialized = true;
            }
        } else {
            // No initial data, allow editing from scratch
            initialized = true;
        }
    });
</script>

<div class="first-scene-builder">
    <div class="builder-header">
        <span class="builder-title"
            >📝 {$t("editPage.characterSettings.title")}</span
        >
        <div class="builder-actions">
            <button type="button" class="btn-util" on:click={reset}
                >{$t("editPage.characterSettings.reset")}</button
            >
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text"
                >{$t("editPage.characterSettings.bodyDesc")}</span
            >
            <span class="label-hint"
                >{$t("editPage.characterSettings.bodyDescHint")}</span
            >
        </div>
        <textarea
            bind:value={body_desc}
            rows="3"
            maxlength="1000"
            placeholder={$t("editPage.characterSettings.bodyDescPlaceholder")}
        ></textarea>
        <div
            class="char-counter"
            class:warning={body_desc.length > 800}
            class:error={body_desc.length >= 1000}
        >
            {body_desc.length} / 1000
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text"
                >{$t("editPage.characterSettings.animList")}</span
            >
            <span class="label-hint"
                >{$t("editPage.characterSettings.animListHint")}</span
            >
        </div>
        <textarea
            bind:value={anim_list}
            rows="2"
            maxlength="500"
            placeholder={$t("editPage.characterSettings.animListPlaceholder")}
        ></textarea>
        <div
            class="char-counter"
            class:warning={anim_list.length > 400}
            class:error={anim_list.length >= 500}
        >
            {anim_list.length} / 500
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text"
                >{$t("editPage.characterSettings.coreDesire")}</span
            >
            <span class="label-hint"
                >{$t("editPage.characterSettings.coreDesireHint")}</span
            >
        </div>
        <textarea
            bind:value={core_desire}
            rows="2"
            maxlength="500"
            placeholder={$t("editPage.characterSettings.coreDesirePlaceholder")}
        ></textarea>
        <div
            class="char-counter"
            class:warning={core_desire.length > 400}
            class:error={core_desire.length >= 500}
        >
            {core_desire.length} / 500
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text"
                >{$t("editPage.characterSettings.contradiction")}</span
            >
            <span class="label-hint"
                >{$t("editPage.characterSettings.contradictionHint")}</span
            >
        </div>
        <textarea
            bind:value={contradiction}
            rows="2"
            maxlength="500"
            placeholder={$t(
                "editPage.characterSettings.contradictionPlaceholder",
            )}
        ></textarea>
        <div
            class="char-counter"
            class:warning={contradiction.length > 400}
            class:error={contradiction.length >= 500}
        >
            {contradiction.length} / 500
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text"
                >{$t("editPage.characterSettings.personality")}</span
            >
            <span class="label-hint"
                >{$t("editPage.characterSettings.personalityHint")}</span
            >
        </div>
        <textarea
            bind:value={personality}
            rows="3"
            maxlength="1000"
            placeholder={$t(
                "editPage.characterSettings.personalityPlaceholder",
            )}
        ></textarea>
        <div
            class="char-counter"
            class:warning={personality.length > 800}
            class:error={personality.length >= 1000}
        >
            {personality.length} / 1000
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text"
                >{$t("editPage.characterSettings.values")}</span
            >
            <span class="label-hint"
                >{$t("editPage.characterSettings.valuesHint")}</span
            >
        </div>
        <textarea
            bind:value={values}
            rows="2"
            maxlength="500"
            placeholder={$t("editPage.characterSettings.valuesPlaceholder")}
        ></textarea>
        <div
            class="char-counter"
            class:warning={values.length > 400}
            class:error={values.length >= 500}
        >
            {values.length} / 500
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text"
                >{$t("editPage.characterSettings.memList")}</span
            >
            <span class="label-hint"
                >{$t("editPage.characterSettings.memListHint")}</span
            >
        </div>
        <textarea
            bind:value={mem_list}
            rows="4"
            maxlength="2000"
            placeholder={$t("editPage.characterSettings.memListPlaceholder")}
        ></textarea>
        <div
            class="char-counter"
            class:warning={mem_list.length > 1800}
            class:error={mem_list.length >= 2000}
        >
            {mem_list.length} / 2000
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text"
                >{$t("editPage.characterSettings.emotionTriggers")}</span
            >
            <span class="label-hint"
                >{$t("editPage.characterSettings.emotionTriggersHint")}</span
            >
        </div>
        <textarea
            bind:value={emotion_triggers}
            rows="2"
            maxlength="500"
            placeholder={$t(
                "editPage.characterSettings.emotionTriggersPlaceholder",
            )}
        ></textarea>
        <div
            class="char-counter"
            class:warning={emotion_triggers.length > 400}
            class:error={emotion_triggers.length >= 500}
        >
            {emotion_triggers.length} / 500
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text"
                >{$t("editPage.characterSettings.shortTermMemory")}</span
            >
            <span class="label-hint"
                >{$t("editPage.characterSettings.shortTermMemoryHint")}</span
            >
        </div>
        <textarea
            bind:value={short_term_memory}
            rows="3"
            maxlength="1000"
            placeholder={$t(
                "editPage.characterSettings.shortTermMemoryPlaceholder",
            )}
        ></textarea>
        <div
            class="char-counter"
            class:warning={short_term_memory.length > 800}
            class:error={short_term_memory.length >= 1000}
        >
            {short_term_memory.length} / 1000
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text"
                >{$t("editPage.characterSettings.lastAtmosphere")}</span
            >
            <span class="label-hint"
                >{$t("editPage.characterSettings.lastAtmosphereHint")}</span
            >
        </div>
        <textarea
            bind:value={last_atmosphere}
            rows="2"
            maxlength="300"
            placeholder={$t(
                "editPage.characterSettings.lastAtmospherePlaceholder",
            )}
        ></textarea>
        <div
            class="char-counter"
            class:warning={last_atmosphere.length > 250}
            class:error={last_atmosphere.length >= 300}
        >
            {last_atmosphere.length} / 300
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text"
                >{$t("editPage.characterSettings.currentEmotion")}</span
            >
            <span class="label-hint"
                >{$t("editPage.characterSettings.currentEmotionHint")}</span
            >
        </div>
        <textarea
            bind:value={current_emotion}
            rows="2"
            maxlength="200"
            placeholder={$t(
                "editPage.characterSettings.currentEmotionPlaceholder",
            )}
        ></textarea>
        <div
            class="char-counter"
            class:warning={current_emotion.length > 180}
            class:error={current_emotion.length >= 200}
        >
            {current_emotion.length} / 200
        </div>
    </div>
</div>

<style>
    .first-scene-builder {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        background-color: var(--card);
        border: 1px solid var(--border-card);
        border-radius: var(--radius-card);
        padding: 1.5rem;
        margin-top: 0.5rem;
    }

    .builder-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border);
        margin-bottom: 0.5rem;
    }

    .builder-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--foreground);
    }

    .builder-actions {
        display: flex;
        gap: 0.5rem;
    }

    .form-group {
        margin-bottom: 0;
    }

    .field-label {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .label-text {
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--foreground);
    }

    .label-hint {
        font-size: 0.75rem;
        color: var(--muted-foreground);
        font-style: italic;
    }

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
        font-family: inherit;
        resize: vertical;
    }

    textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 2px var(--ring);
    }

    .char-counter {
        font-size: 0.75rem;
        color: var(--muted-foreground);
        text-align: right;
        margin-top: 0.25rem;
        font-family: monospace;
    }

    .char-counter.warning {
        color: #f59e0b;
        font-weight: 600;
    }

    .char-counter.error {
        color: var(--destructive);
        font-weight: 700;
    }

    .btn-util {
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
        font-weight: 600;
        border: 1px solid var(--border);
        border-radius: var(--radius-button);
        background: var(--secondary);
        color: var(--secondary-foreground);
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-util:hover {
        opacity: 0.85;
        transform: translateY(-1px);
    }
</style>

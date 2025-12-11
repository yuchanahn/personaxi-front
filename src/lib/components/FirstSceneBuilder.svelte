<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { t } from "svelte-i18n";
    const dispatch = createEventDispatcher();
    export let initialData: string | null = null;
    export let onChange: (jsonStr: string) => void = () => {};

    export let availableExpressions: string[] = [];
    export let availableMotions: string[] = [];
    export let mode: "live2d" | "3d" = "live2d";

    let body_desc = "";
    let anim_list = ""; // Legacy string field, kept for compatibility if needed, or we might auto-generate it.
    let core_desire = "";
    let contradiction = "";
    let personality = "";
    let values = "";
    let mem_list = "";
    let emotion_triggers = "";
    let short_term_memory = "";
    let last_atmosphere = "";
    let current_emotion = "";
    let internal_monologue = "";

    // Live2D Mappings
    let expression_map: Record<string, string> = {
        joy: "",
        anger: "",
        sorrow: "",
        fun: "",
        surprise: "",
    };
    let motion_list: { name: string; file: string; desc: string }[] = [];
    let hit_motion_map: Record<string, string> = {
        Body: "",
        Head: "",
    };

    let initialized = false;

    function generateJson() {
        // Auto-generate human-readable anim_list string from struct
        let generatedAnimList = "";
        if (motion_list.length > 0) {
            generatedAnimList = motion_list
                .map((m) => {
                    return `[${m.name}: ${m.desc}]`;
                })
                .join("\n");
        } else {
            generatedAnimList = anim_list; // Fallback to manual input if list is empty
        }

        const obj = {
            body_desc,
            anim_list: generatedAnimList, // Use generated list
            core_desire,
            contradiction,
            personality,
            values,
            mem_list,
            emotion_triggers,
            short_term_memory,
            last_atmosphere,
            current_emotion,
            internal_monologue,
            // New Fields
            live2d_expression_map: expression_map,
            live2d_motion_list: motion_list,
            live2d_hit_motion_map: hit_motion_map,
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
        internal_monologue = "";

        expression_map = {
            joy: "",
            anger: "",
            sorrow: "",
            fun: "",
            surprise: "",
        };
        motion_list = [];
        hit_motion_map = {
            Body: "",
            Head: "",
        };

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
        internal_monologue,
        expression_map,
        motion_list,
        hit_motion_map,
        initialized && generateJson();

    onMount(() => {
        if (initialData) {
            try {
                // Handle both object and string types
                let data: any;
                if (typeof initialData === "object") {
                    data = initialData;
                } else if (typeof initialData === "string") {
                    data = JSON.parse(initialData);
                } else {
                    throw new Error("Invalid initialData type");
                }

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
                internal_monologue = data.internal_monologue ?? "";

                if (data.live2d_expression_map) {
                    expression_map = {
                        ...expression_map,
                        ...data.live2d_expression_map,
                    };
                }
                if (Array.isArray(data.live2d_motion_list)) {
                    motion_list = data.live2d_motion_list;
                }
                if (data.live2d_hit_motion_map) {
                    hit_motion_map = {
                        ...hit_motion_map,
                        ...data.live2d_hit_motion_map,
                    };
                }

                initialized = true;
            } catch (e) {
                console.error("FirstSceneBuilder: initialData parse error", e);
                // Fallback Regex Parsing
                const extract = (key: string) => {
                    const regex = new RegExp(
                        `"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`,
                    );
                    const match = initialData!.match(regex);
                    return match && match[1]
                        ? match[1]
                              .replace(/\\n/g, "\n")
                              .replace(/\\"/g, '"')
                              .replace(/\\\\/g, "\\")
                        : "";
                };
                body_desc = extract("body_desc");
                anim_list = extract("anim_list");
                core_desire = extract("core_desire");
                contradiction = extract("contradiction");
                personality = extract("personality");
                values = extract("values");
                mem_list = extract("mem_list");
                emotion_triggers = extract("emotion_triggers");
                short_term_memory = extract("short_term_memory");
                last_atmosphere = extract("last_atmosphere");
                current_emotion = extract("current_emotion");
                internal_monologue = extract("internal_monologue");
                initialized = true;
            }
        } else {
            initialized = true;
        }
    });

    function addMotion() {
        // Fallback to expression if no motions available
        const defaultFile =
            availableMotions.length > 0
                ? availableMotions[0]
                : availableExpressions.length > 0
                  ? availableExpressions[0]
                  : "";
        motion_list = [
            ...motion_list,
            { name: "", file: defaultFile, desc: "" },
        ];
    }

    function removeMotion(index: number) {
        motion_list = motion_list.filter((_, i) => i !== index);
    }
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

    <!-- Expression Mapping Section -->
    {#if mode === "live2d" && availableExpressions.length > 0}
        <div class="form-section">
            <h3 class="section-title">🎭 Expression Mapping</h3>
            <p class="section-desc">
                Map standard emotions to your model's expression files.
            </p>
            <div class="expression-grid">
                {#each Object.keys(expression_map) as emotion}
                    <div class="expression-item">
                        <label for="expr-{emotion}"
                            >{emotion.charAt(0).toUpperCase() +
                                emotion.slice(1)}</label
                        >
                        <select
                            id="expr-{emotion}"
                            bind:value={expression_map[emotion]}
                        >
                            <option value="">(None)</option>
                            {#each availableExpressions as expr}
                                <option value={expr}>{expr}</option>
                            {/each}
                        </select>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Animation List Builder Section -->
    {#if mode === "live2d" && (availableMotions.length > 0 || availableExpressions.length > 0)}
        <div class="form-section">
            <h3 class="section-title">🎬 Animation List</h3>
            <p class="section-desc">
                Create logical animations for the AI to use.
            </p>

            <div class="motion-list">
                {#each motion_list as motion, i}
                    <div class="motion-item">
                        <div class="motion-inputs">
                            <input
                                class="input-name"
                                placeholder="Name (e.g. Laugh)"
                                bind:value={motion.name}
                            />
                            <select
                                class="input-file"
                                bind:value={motion.file}
                                title="Select Motion or Expression"
                            >
                                <option value="" disabled selected
                                    >Select Action File</option
                                >
                                {#if availableMotions.length > 0}
                                    <optgroup label="Motions">
                                        {#each availableMotions as mFile}
                                            <option value={mFile}
                                                >{mFile
                                                    .split("/")
                                                    .pop()}</option
                                            >
                                        {/each}
                                    </optgroup>
                                {/if}
                                {#if availableExpressions.length > 0}
                                    <optgroup label="Expressions">
                                        {#each availableExpressions as expr}
                                            <option value={expr}
                                                >{expr} (Expression)</option
                                            >
                                        {/each}
                                    </optgroup>
                                {/if}
                            </select>
                        </div>
                        <input
                            class="input-desc"
                            placeholder="Description (e.g. Laughs out loud)"
                            bind:value={motion.desc}
                        />
                        <button
                            class="btn-remove"
                            on:click={() => removeMotion(i)}>&times;</button
                        >
                    </div>
                {/each}
            </div>

            <button class="btn-add" on:click={addMotion}>+ Add Animation</button
            >
        </div>
    {/if}

    <!-- Hit Reaction Mapping Section -->
    {#if availableMotions.length > 0}
        <div class="form-section">
            <h3 class="section-title">👆 Hit Reaction Mapping</h3>
            <p class="section-desc">
                Choose motions to play when the user touches/clicks specific
                areas.
            </p>
            <div class="expression-grid">
                {#each Object.keys(hit_motion_map) as area}
                    <div class="expression-item">
                        <label for="hit-{area}">{area}</label>
                        <select
                            id="hit-{area}"
                            bind:value={hit_motion_map[area]}
                        >
                            <option value="">(Default: Tap{area})</option>
                            {#each availableMotions as mFile}
                                <option value={mFile}
                                    >{mFile.split("/").pop()}</option
                                >
                            {/each}
                        </select>
                    </div>
                {/each}
                <!-- Allow adding custom areas? Maybe later. For now, fixed standard areas -->
            </div>
        </div>
    {/if}

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

    /* New Styles */
    .form-section {
        border-bottom: 1px solid var(--border);
        padding-bottom: 1rem;
        margin-bottom: 1rem;
    }
    .section-title {
        font-size: 0.95rem;
        font-weight: 600;
        margin: 0 0 0.25rem 0;
        color: var(--primary);
    }
    .section-desc {
        font-size: 0.8rem;
        color: var(--muted-foreground);
        margin: 0 0 0.75rem 0;
    }

    .expression-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 0.75rem;
    }
    .expression-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .expression-item label {
        font-size: 0.8rem;
        font-weight: 600;
    }
    .expression-item select {
        padding: 0.4rem;
        font-size: 0.85rem;
        background-color: var(--background);
        color: var(--foreground);
        border: 1px solid var(--border);
        border-radius: 4px;
    }

    .motion-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }
    .motion-item {
        background: var(--muted);
        padding: 0.5rem;
        border-radius: 4px;
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        position: relative;
    }
    .motion-inputs {
        display: flex;
        gap: 0.5rem;
    }
    .input-name {
        flex: 1;
        padding: 0.4rem;
        font-size: 0.85rem;
        background-color: var(--background);
        color: var(--foreground);
        border: 1px solid var(--border);
        border-radius: 4px;
    }
    .input-file {
        flex: 1;
        padding: 0.4rem;
        font-size: 0.85rem;
        max-width: 50%;
        background-color: var(--background);
        color: var(--foreground);
        border: 1px solid var(--border);
        border-radius: 4px;
    }
    .input-desc {
        padding: 0.4rem;
        font-size: 0.85rem;
        width: 100%;
        background-color: var(--background);
        color: var(--foreground);
        border: 1px solid var(--border);
        border-radius: 4px;
    }
    .btn-add {
        width: 100%;
        padding: 0.5rem;
        background: var(--secondary);
        border: 1px dashed var(--border);
        color: var(--secondary-foreground);
        font-size: 0.85rem;
        cursor: pointer;
        transition: background 0.2s;
    }
    .btn-add:hover {
        background: var(--muted);
    }
    .btn-remove {
        position: absolute;
        top: 2px;
        right: 2px;
        background: none;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        font-size: 1.2rem;
        line-height: 1;
    }
    .btn-remove:hover {
        color: var(--destructive);
    }

    textarea.readonly {
        background-color: var(--muted);
        opacity: 0.7;
        pointer-events: none;
    }
</style>

<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { t } from "svelte-i18n";
    const dispatch = createEventDispatcher();
    export let initialData: string | null = null;
    export let onChange: (jsonStr: string) => void = () => {};

    export let availableExpressions: string[] = [];
    export let availableMotions: string[] = [];
    export let mode: "live2d" | "3d" = "live2d";
    export let showLive2DMappingSections = true;
    export let hideRuntimeStateFields = false;
    export let showCoreFieldEditors = true;
    export let showAdvancedFieldEditors = true;

    const DEFAULT_RUNTIME_STATE = {
        shortTermMemory: "대화 시작 전, 특별한 단기 기억은 없음.",
        lastAtmosphere: "차분한 시작 분위기.",
        currentEmotion: "CALM",
    };
    const DEFAULT_GESTURE_ANIM_LIST = `[NOD] : Nodding (Permission, Agreement)
[SHAKE] : Shaking head (Denial, Refusal)
[TILT] : Tilting head (Question, Doubt)
[FIDGET] : Fidgeting (Anxiety, Restlessness)
[SIGH] : Sighing (Relief, Disappointment, Tiredness)
[LOOK_DOWN] : Looking down (Shame, Submission, Sadness)
[CLOSE_EYES] : Closing eyes (Thinking, Refusal, Sleepy)
[WINK] : Winking (Teasing, Secret, Agreement)
[STICK_TONGUE] : Sticking tongue out (Teasing, Disgust)
[SQUINT] : Squinting (Suspicion, Focus, Glare)
[LOOK_UP_THINK] : Looking up (Thinking, Remembering)
[FLINCH] : Flinching (Surprise, Fear, Pain)
[PANT] : Panting (Exhaustion, Excitement, Heat)`;
    const DEFAULT_GESTURE_ANIM_LINES = new Set(
        DEFAULT_GESTURE_ANIM_LIST.split("\n").map((line) => line.trim()),
    );

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
        ELATED: "",
        GENTLE: "",
        STERN: "",
        DEPRESSED: "",
        TENSE: "",
        ASTONISHED: "",
        CALM: "",
    };
    let motion_list: { name: string; file: string; desc: string }[] = [];
    let hit_motion_map: Record<string, string> = {
        Body: "",
        Head: "",
    };
    let permanent_expressions: string[] = []; // NEW: Sticky expressions
    let extra_fields: Record<string, any> = {};
    let live2dExprAliases: Record<string, string> = {};
    let live2dMotionAliasesByFile: Record<string, string> = {};
    let showAdvancedFields = false;
    let expandMemList = false;
    let collapsedFields: Record<string, boolean> = {
        body_desc: true,
        core_desire: true,
        contradiction: true,
        personality: true,
        values: true,
        mem_list: true,
        emotion_triggers: true,
        short_term_memory: true,
        last_atmosphere: true,
        current_emotion: true,
    };

    function basename(path: string): string {
        if (!path) return "";
        return path.split("/").pop() || path;
    }

    function stripExpressionExt(name: string): string {
        return name.replace(/\.exp3\.json$/i, "");
    }

    function normalizeMotionFileKey(file: string): string {
        return basename(file).toLowerCase();
    }

    function stripDefaultGestureAnimList(text: string): string {
        if (!text) return "";
        const lines = text
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => !!line);
        const customOnly = lines.filter(
            (line) => !DEFAULT_GESTURE_ANIM_LINES.has(line),
        );
        return customOnly.join("\n").trim();
    }

    function normalizeExpressionKey(expr: string): string {
        return stripExpressionExt(expr).toLowerCase();
    }

    function isDefaultMotionAlias(alias: string, file: string): boolean {
        const a = (alias || "").trim().toLowerCase();
        const f = (file || "").trim().toLowerCase();
        const b = basename(file).trim().toLowerCase();
        return !a || a === f || a === b;
    }

    function getExpressionDisplayName(expr: string): string {
        const direct = live2dExprAliases[expr];
        if (direct) return direct;

        const norm = normalizeExpressionKey(expr);
        const fromNorm = live2dExprAliases[norm];
        if (fromNorm) return fromNorm;

        return expr;
    }

    function getMotionDisplayName(file: string): string {
        const direct = live2dMotionAliasesByFile[file];
        if (direct) return direct;

        const norm = normalizeMotionFileKey(file);
        const fromNorm = live2dMotionAliasesByFile[norm];
        if (fromNorm) return fromNorm;

        return basename(file) || file;
    }

    let initialized = false;

    function getEffectiveRuntimeState() {
        if (!hideRuntimeStateFields) {
            return {
                short_term_memory: short_term_memory,
                last_atmosphere: last_atmosphere,
                current_emotion: current_emotion,
            };
        }

        return {
            short_term_memory:
                short_term_memory.trim() ||
                DEFAULT_RUNTIME_STATE.shortTermMemory,
            last_atmosphere:
                last_atmosphere.trim() || DEFAULT_RUNTIME_STATE.lastAtmosphere,
            current_emotion:
                current_emotion.trim() || DEFAULT_RUNTIME_STATE.currentEmotion,
        };
    }

    function generateJson() {
        // Persist anim_list for avatar modes.
        // - live2d: append built-in default gesture list
        // - 3d(vrm): keep existing/custom anim_list only
        let generatedAnimList = "";
        if (mode === "3d") {
            const customAnimList =
                motion_list.length > 0
                    ? motion_list
                          .map((m) => `[${m.name}] : ${m.desc}`)
                          .join("\n")
                    : (anim_list || "").trim();

            generatedAnimList = customAnimList;
        } else if (mode === "live2d") {
            const customAnimList = stripDefaultGestureAnimList(
                (anim_list || "").trim(),
            );
            generatedAnimList = [customAnimList, DEFAULT_GESTURE_ANIM_LIST]
                .filter((v) => !!v)
                .join("\n");
        }
        //[PUFF_CHEEKS] : Puffing cheeks (Pouting, Angry, Cute)
        //[ROLL_EYES] : Rolling eyes (Sarcasm, Annoyance)
        const runtimeState = getEffectiveRuntimeState();
        const obj: Record<string, any> = {
            ...extra_fields,
            body_desc,
            core_desire,
            contradiction,
            personality,
            values,
            mem_list,
            emotion_triggers,
            short_term_memory: runtimeState.short_term_memory,
            last_atmosphere: runtimeState.last_atmosphere,
            current_emotion: runtimeState.current_emotion,
            internal_monologue,
        };

        if (mode === "3d") {
            obj.anim_list = generatedAnimList;
            obj.live2d_expression_map = expression_map;
            obj.live2d_motion_list = motion_list;
            obj.live2d_hit_motion_map = hit_motion_map;
            obj.live2d_permanent_expressions = permanent_expressions;
        } else if (mode === "live2d") {
            obj.anim_list = generatedAnimList;
        }

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
        short_term_memory = hideRuntimeStateFields
            ? DEFAULT_RUNTIME_STATE.shortTermMemory
            : "";
        last_atmosphere = hideRuntimeStateFields
            ? DEFAULT_RUNTIME_STATE.lastAtmosphere
            : "";
        current_emotion = hideRuntimeStateFields
            ? DEFAULT_RUNTIME_STATE.currentEmotion
            : "";
        internal_monologue = "";

        expression_map = {
            ELATED: "",
            GENTLE: "",
            STERN: "",
            DEPRESSED: "",
            TENSE: "",
            ASTONISHED: "",
            CALM: "",
        };
        motion_list = [];
        hit_motion_map = {
            Body: "",
            Head: "",
        };
        permanent_expressions = [];
        extra_fields = {};
        live2dExprAliases = {};
        live2dMotionAliasesByFile = {};
        showAdvancedFields = false;
        expandMemList = false;

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
        permanent_expressions,
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
                anim_list = stripDefaultGestureAnimList(data.anim_list ?? "");
                core_desire = data.core_desire ?? "";
                contradiction = data.contradiction ?? "";
                personality = data.personality ?? "";
                values = data.values ?? "";
                mem_list = data.mem_list ?? "";
                emotion_triggers = data.emotion_triggers ?? "";
                short_term_memory = data.short_term_memory ?? "";
                last_atmosphere = data.last_atmosphere ?? "";
                current_emotion = data.current_emotion ?? "";
                if (hideRuntimeStateFields) {
                    short_term_memory =
                        short_term_memory.trim() ||
                        DEFAULT_RUNTIME_STATE.shortTermMemory;
                    last_atmosphere =
                        last_atmosphere.trim() ||
                        DEFAULT_RUNTIME_STATE.lastAtmosphere;
                    current_emotion =
                        current_emotion.trim() ||
                        DEFAULT_RUNTIME_STATE.currentEmotion;
                }
                internal_monologue = data.internal_monologue ?? "";

                const knownKeys = new Set([
                    "body_desc",
                    "anim_list",
                    "core_desire",
                    "contradiction",
                    "personality",
                    "values",
                    "mem_list",
                    "emotion_triggers",
                    "short_term_memory",
                    "last_atmosphere",
                    "current_emotion",
                    "internal_monologue",
                    "live2d_expression_map",
                    "live2d_motion_list",
                    "live2d_hit_motion_map",
                    "live2d_permanent_expressions",
                ]);
                extra_fields = {};
                Object.entries(data).forEach(([key, value]) => {
                    if (!knownKeys.has(key)) {
                        extra_fields[key] = value;
                    }
                });

                const editorConfig = data.live2d_editor_config;
                if (editorConfig && typeof editorConfig === "object") {
                    if (
                        editorConfig.expressionAliases &&
                        typeof editorConfig.expressionAliases === "object"
                    ) {
                        live2dExprAliases = {};
                        Object.entries(editorConfig.expressionAliases).forEach(
                            ([key, alias]) => {
                                if (
                                    typeof key === "string" &&
                                    typeof alias === "string"
                                ) {
                                    live2dExprAliases[key] = alias;
                                    live2dExprAliases[
                                        normalizeExpressionKey(key)
                                    ] = alias;
                                }
                            },
                        );
                    } else {
                        live2dExprAliases = {};
                    }

                    live2dMotionAliasesByFile = {};
                    if (editorConfig.motions && typeof editorConfig.motions === "object") {
                        Object.values(editorConfig.motions).forEach((motion: any) => {
                            const file =
                                typeof motion?.file === "string" ? motion.file : "";
                            const alias =
                                typeof motion?.alias === "string" ? motion.alias : "";
                            if (file) {
                                const normalizedKey = normalizeMotionFileKey(file);
                                const nextAlias = (alias || file).trim();
                                const currentDirect = live2dMotionAliasesByFile[file];
                                const currentNorm =
                                    live2dMotionAliasesByFile[normalizedKey];
                                const current = currentDirect || currentNorm || "";

                                const shouldOverride =
                                    !current ||
                                    (isDefaultMotionAlias(current, file) &&
                                        !isDefaultMotionAlias(nextAlias, file));

                                if (shouldOverride) {
                                    live2dMotionAliasesByFile[file] = nextAlias;
                                    live2dMotionAliasesByFile[normalizedKey] =
                                        nextAlias;
                                }
                            }
                        });
                    }
                } else {
                    live2dExprAliases = {};
                    live2dMotionAliasesByFile = {};
                }

                if (mode === "3d" && data.live2d_expression_map) {
                    // [Migration] If old keys exist, map them to new keys
                    const oldMap = data.live2d_expression_map;
                    const newMap = { ...expression_map };

                    // 1. Direct copy of matching keys (if already updated)
                    Object.keys(newMap).forEach((k) => {
                        if (oldMap[k]) newMap[k] = oldMap[k];
                    });

                    // 2. Migration for legacy keys
                    if (oldMap["joy"]) newMap["GENTLE"] = oldMap["joy"];
                    if (oldMap["happy"]) newMap["GENTLE"] = oldMap["happy"];

                    if (oldMap["fun"]) newMap["ELATED"] = oldMap["fun"];
                    if (oldMap["amuse"]) newMap["ELATED"] = oldMap["amuse"];

                    if (oldMap["anger"]) newMap["STERN"] = oldMap["anger"];
                    if (oldMap["sorrow"])
                        newMap["DEPRESSED"] = oldMap["sorrow"];

                    if (oldMap["surprise"])
                        newMap["ASTONISHED"] = oldMap["surprise"];

                    // (Legacy 'unease' -> TENSE, 'neutral' -> CALM if they existed)
                    if (oldMap["unease"]) newMap["TENSE"] = oldMap["unease"];
                    if (oldMap["neutral"]) newMap["CALM"] = oldMap["neutral"];

                    expression_map = newMap;
                }
                if (mode === "3d" && Array.isArray(data.live2d_motion_list)) {
                    motion_list = data.live2d_motion_list;
                }
                if (mode === "3d" && data.live2d_hit_motion_map) {
                    hit_motion_map = {
                        ...hit_motion_map,
                        ...data.live2d_hit_motion_map,
                    };
                }
                if (
                    mode === "3d" &&
                    Array.isArray(data.live2d_permanent_expressions)
                ) {
                    permanent_expressions = data.live2d_permanent_expressions;
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
                anim_list = stripDefaultGestureAnimList(extract("anim_list"));
                core_desire = extract("core_desire");
                contradiction = extract("contradiction");
                personality = extract("personality");
                values = extract("values");
                mem_list = extract("mem_list");
                emotion_triggers = extract("emotion_triggers");
                short_term_memory = extract("short_term_memory");
                last_atmosphere = extract("last_atmosphere");
                current_emotion = extract("current_emotion");
                if (hideRuntimeStateFields) {
                    short_term_memory =
                        short_term_memory.trim() ||
                        DEFAULT_RUNTIME_STATE.shortTermMemory;
                    last_atmosphere =
                        last_atmosphere.trim() ||
                        DEFAULT_RUNTIME_STATE.lastAtmosphere;
                    current_emotion =
                        current_emotion.trim() ||
                        DEFAULT_RUNTIME_STATE.currentEmotion;
                }
                internal_monologue = extract("internal_monologue");
                live2dExprAliases = {};
                live2dMotionAliasesByFile = {};
                initialized = true;
            }
        } else {
            live2dExprAliases = {};
            live2dMotionAliasesByFile = {};
            if (hideRuntimeStateFields) {
                short_term_memory = DEFAULT_RUNTIME_STATE.shortTermMemory;
                last_atmosphere = DEFAULT_RUNTIME_STATE.lastAtmosphere;
                current_emotion = DEFAULT_RUNTIME_STATE.currentEmotion;
            }
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

    function togglePermanentExpression(expr: string) {
        if (permanent_expressions.includes(expr)) {
            permanent_expressions = permanent_expressions.filter(
                (e) => e !== expr,
            );
        } else {
            permanent_expressions = [...permanent_expressions, expr];
        }
    }

    function toggleAdvancedFields() {
        showAdvancedFields = !showAdvancedFields;
    }

    function toggleMemListExpand() {
        expandMemList = !expandMemList;
    }

    function toggleField(field: string) {
        collapsedFields = {
            ...collapsedFields,
            [field]: !collapsedFields[field],
        };
    }

    function getFieldPreview(value: string): string {
        const singleLine = (value || "").replace(/\s+/g, " ").trim();
        if (!singleLine) return "(비어 있음)";
        return singleLine.length > 42
            ? `${singleLine.slice(0, 42)}...`
            : singleLine;
    }

    // Sum of fixed field max lengths:
    // body_desc(1000) + core_desire(500) + contradiction(500) + personality(1000) + values(500)
    // + mem_list(2000) + emotion_triggers(500) + short_term_memory(1000)
    // + last_atmosphere(300) + current_emotion(200) = 7500
    const TOTAL_FIELD_CHAR_LIMIT = 7500;
    let totalFieldChars = 0;

    function safeLen(v: unknown): number {
        return typeof v === "string" ? v.length : 0;
    }

    function calculateTotalFieldChars(): number {
        let total =
            safeLen(body_desc) +
            safeLen(core_desire) +
            safeLen(contradiction) +
            safeLen(personality) +
            safeLen(values) +
            safeLen(mem_list) +
            safeLen(emotion_triggers) +
            safeLen(short_term_memory) +
            safeLen(last_atmosphere) +
            safeLen(current_emotion) +
            safeLen(internal_monologue);

        if (mode === "3d") {
            total += motion_list.reduce((acc, m) => {
                return (
                    acc +
                    safeLen(m?.name) +
                    safeLen(m?.file) +
                    safeLen(m?.desc)
                );
            }, 0);

            total += Object.values(expression_map).reduce(
                (acc, v) => acc + safeLen(v),
                0,
            );
            total += Object.values(hit_motion_map).reduce(
                (acc, v) => acc + safeLen(v),
                0,
            );
            total += permanent_expressions.reduce(
                (acc, v) => acc + safeLen(v),
                0,
            );
        }

        return total;
    }

    $: totalFieldChars = calculateTotalFieldChars();
    function getDynamicMax(currentValue: string, baseMax: number): number {
        const current = safeLen(currentValue);
        const allowance = Math.max(
            0,
            TOTAL_FIELD_CHAR_LIMIT - (totalFieldChars - current),
        );
        return Math.max(current, Math.min(baseMax, allowance));
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
    <div
        class="total-counter"
        class:warning={totalFieldChars > 2300}
        class:error={totalFieldChars >= TOTAL_FIELD_CHAR_LIMIT}
    >
        총합: {totalFieldChars} / {TOTAL_FIELD_CHAR_LIMIT}
        {#if totalFieldChars >= TOTAL_FIELD_CHAR_LIMIT}
            <span class="limit-msg"> (최대치 도달)</span>
        {/if}
    </div>

    {#if showCoreFieldEditors}
        <div class="form-group">
            <button
                type="button"
                class="field-collapsible"
                on:click={() => toggleField("body_desc")}
            >
                <span class="collapsible-left">
                    {$t("editPage.characterSettings.bodyDesc")}
                </span>
                <span class="collapsible-right">
                    {getFieldPreview(body_desc)}
                </span>
            </button>
            {#if !collapsedFields.body_desc}
                <div class="field-label">
                    <span class="label-hint"
                        >{$t("editPage.characterSettings.bodyDescHint")}</span
                    >
                </div>
                <textarea
                    bind:value={body_desc}
                    rows="3"
                    maxlength={getDynamicMax(body_desc, 1000)}
                    placeholder={$t("editPage.characterSettings.bodyDescPlaceholder")}
                ></textarea>
                <div
                    class="char-counter"
                    class:warning={body_desc.length > 800}
                    class:error={body_desc.length >= 1000}
                >
                    {body_desc.length} / 1000
                </div>
            {/if}
        </div>
    {/if}

    <!-- Expression Mapping Section -->
    {#if mode === "live2d" && showLive2DMappingSections && availableExpressions.length > 0}
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
                                <option value={expr}
                                    >{getExpressionDisplayName(expr)}</option
                                >
                            {/each}
                        </select>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Permanent Expression (Toggle) Section -->
    {#if mode === "live2d" && showLive2DMappingSections && availableExpressions.length > 0}
        <div class="form-section">
            <h3 class="section-title">🔒 Permanent Expressions</h3>
            <p class="section-desc">
                Select expressions to be always active (e.g. clothing toggles).
            </p>
            <div
                class="expression-grid"
                style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));"
            >
                {#each availableExpressions as expr}
                    <div
                        class="expression-item"
                        style="flex-direction: row; align-items: center; gap: 0.5rem; background: var(--muted); padding: 0.5rem; border-radius: 4px;"
                    >
                        <input
                            type="checkbox"
                            id="perm-{expr}"
                            checked={permanent_expressions.includes(expr)}
                            on:change={() => togglePermanentExpression(expr)}
                            style="width: auto; margin: 0;"
                        />
                        <label
                            for="perm-{expr}"
                            style="margin: 0; cursor: pointer; font-size: 0.85rem; word-break: break-all;"
                        >
                            {getExpressionDisplayName(expr)}
                        </label>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Animation List Builder Section -->
    {#if mode === "live2d" && showLive2DMappingSections && (availableMotions.length > 0 || availableExpressions.length > 0)}
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
                                maxlength={getDynamicMax(motion.name, 120)}
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
                                                >{getMotionDisplayName(
                                                    mFile,
                                                )}</option
                                            >
                                        {/each}
                                    </optgroup>
                                {/if}
                                {#if availableExpressions.length > 0}
                                    <optgroup label="Expressions">
                                        {#each availableExpressions as expr}
                                            <option value={expr}
                                                >{getExpressionDisplayName(
                                                    expr,
                                                )} (Expression)</option
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
                            maxlength={getDynamicMax(motion.desc, 300)}
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
    <!-- {#if availableMotions.length > 0}
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
            </div>
        </div>
    {/if} -->

    {#if showCoreFieldEditors}
        <div class="form-group">
            <button
                type="button"
                class="field-collapsible"
                on:click={() => toggleField("core_desire")}
            >
                <span class="collapsible-left">
                    {$t("editPage.characterSettings.coreDesire")}
                </span>
                <span class="collapsible-right">
                    {getFieldPreview(core_desire)}
                </span>
            </button>
            {#if !collapsedFields.core_desire}
                <div class="field-label">
                    <span class="label-hint"
                        >{$t("editPage.characterSettings.coreDesireHint")}</span
                    >
                </div>
                <textarea
                    bind:value={core_desire}
                    rows="2"
                    maxlength={getDynamicMax(core_desire, 500)}
                    placeholder={$t("editPage.characterSettings.coreDesirePlaceholder")}
                ></textarea>
                <div
                    class="char-counter"
                    class:warning={core_desire.length > 400}
                    class:error={core_desire.length >= 500}
                >
                    {core_desire.length} / 500
                </div>
            {/if}
        </div>

        <div class="form-group">
            <button
                type="button"
                class="field-collapsible"
                on:click={() => toggleField("contradiction")}
            >
                <span class="collapsible-left">
                    {$t("editPage.characterSettings.contradiction")}
                </span>
                <span class="collapsible-right">
                    {getFieldPreview(contradiction)}
                </span>
            </button>
            {#if !collapsedFields.contradiction}
                <div class="field-label">
                    <span class="label-hint"
                        >{$t("editPage.characterSettings.contradictionHint")}</span
                    >
                </div>
                <textarea
                    bind:value={contradiction}
                    rows="2"
                    maxlength={getDynamicMax(contradiction, 500)}
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
            {/if}
        </div>

        <div class="form-group">
            <button
                type="button"
                class="field-collapsible"
                on:click={() => toggleField("personality")}
            >
                <span class="collapsible-left">
                    {$t("editPage.characterSettings.personality")}
                </span>
                <span class="collapsible-right">
                    {getFieldPreview(personality)}
                </span>
            </button>
            {#if !collapsedFields.personality}
                <div class="field-label">
                    <span class="label-hint"
                        >{$t("editPage.characterSettings.personalityHint")}</span
                    >
                </div>
                <textarea
                    bind:value={personality}
                    rows="3"
                    maxlength={getDynamicMax(personality, 1000)}
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
            {/if}
        </div>

        <div class="form-group">
            <button
                type="button"
                class="field-collapsible"
                on:click={() => toggleField("values")}
            >
                <span class="collapsible-left">
                    {$t("editPage.characterSettings.values")}
                </span>
                <span class="collapsible-right">
                    {getFieldPreview(values)}
                </span>
            </button>
            {#if !collapsedFields.values}
                <div class="field-label">
                    <span class="label-hint"
                        >{$t("editPage.characterSettings.valuesHint")}</span
                    >
                </div>
                <textarea
                    bind:value={values}
                    rows="2"
                    maxlength={getDynamicMax(values, 500)}
                    placeholder={$t("editPage.characterSettings.valuesPlaceholder")}
                ></textarea>
                <div
                    class="char-counter"
                    class:warning={values.length > 400}
                    class:error={values.length >= 500}
                >
                    {values.length} / 500
                </div>
            {/if}
        </div>
    {/if}

    {#if showAdvancedFieldEditors}
        <div class="advanced-toggle-row">
            <button
                type="button"
                class="btn-util"
                on:click={toggleAdvancedFields}
                >{showAdvancedFields
                    ? "고급 항목 접기"
                    : "고급 항목 펼치기"}</button
            >
        </div>
    {/if}

    {#if showAdvancedFieldEditors && showAdvancedFields}
        <div class="form-group">
            <button
                type="button"
                class="field-collapsible"
                on:click={() => toggleField("mem_list")}
            >
                <span class="collapsible-left">
                    {$t("editPage.characterSettings.memList")}
                </span>
                <span class="collapsible-right">
                    {getFieldPreview(mem_list)}
                </span>
            </button>
            {#if !collapsedFields.mem_list}
                <div class="field-label">
                    <span class="label-hint"
                        >{$t("editPage.characterSettings.memListHint")}</span
                    >
                </div>
                <textarea
                    bind:value={mem_list}
                    rows={expandMemList ? 8 : 3}
                    maxlength={getDynamicMax(mem_list, 2000)}
                    placeholder={$t("editPage.characterSettings.memListPlaceholder")}
                ></textarea>
                <div class="advanced-toggle-row compact">
                    <button
                        type="button"
                        class="btn-util"
                        on:click={toggleMemListExpand}
                        >{expandMemList
                            ? "기억 목록 접기"
                            : "기억 목록 더보기"}</button
                    >
                </div>
                <div
                    class="char-counter"
                    class:warning={mem_list.length > 1800}
                    class:error={mem_list.length >= 2000}
                >
                    {mem_list.length} / 2000
                </div>
            {/if}
        </div>

        <div class="form-group">
            <button
                type="button"
                class="field-collapsible"
                on:click={() => toggleField("emotion_triggers")}
            >
                <span class="collapsible-left">
                    {$t("editPage.characterSettings.emotionTriggers")}
                </span>
                <span class="collapsible-right">
                    {getFieldPreview(emotion_triggers)}
                </span>
            </button>
            {#if !collapsedFields.emotion_triggers}
                <div class="field-label">
                    <span class="label-hint"
                        >{$t("editPage.characterSettings.emotionTriggersHint")}</span
                    >
                </div>
                <textarea
                    bind:value={emotion_triggers}
                    rows="2"
                    maxlength={getDynamicMax(emotion_triggers, 500)}
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
            {/if}
        </div>

        {#if !hideRuntimeStateFields}
            <div class="form-group">
                <button
                    type="button"
                    class="field-collapsible"
                    on:click={() => toggleField("short_term_memory")}
                >
                    <span class="collapsible-left">
                        {$t("editPage.characterSettings.shortTermMemory")}
                    </span>
                    <span class="collapsible-right">
                        {getFieldPreview(short_term_memory)}
                    </span>
                </button>
                {#if !collapsedFields.short_term_memory}
                    <div class="field-label">
                        <span class="label-hint"
                            >{$t("editPage.characterSettings.shortTermMemoryHint")}</span
                        >
                    </div>
                    <textarea
                        bind:value={short_term_memory}
                        rows="3"
                        maxlength={getDynamicMax(short_term_memory, 1000)}
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
                {/if}
            </div>

            <div class="form-group">
                <button
                    type="button"
                    class="field-collapsible"
                    on:click={() => toggleField("last_atmosphere")}
                >
                    <span class="collapsible-left">
                        {$t("editPage.characterSettings.lastAtmosphere")}
                    </span>
                    <span class="collapsible-right">
                        {getFieldPreview(last_atmosphere)}
                    </span>
                </button>
                {#if !collapsedFields.last_atmosphere}
                    <div class="field-label">
                        <span class="label-hint"
                            >{$t("editPage.characterSettings.lastAtmosphereHint")}</span
                        >
                    </div>
                    <textarea
                        bind:value={last_atmosphere}
                        rows="2"
                        maxlength={getDynamicMax(last_atmosphere, 300)}
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
                {/if}
            </div>

            <div class="form-group">
                <button
                    type="button"
                    class="field-collapsible"
                    on:click={() => toggleField("current_emotion")}
                >
                    <span class="collapsible-left">
                        {$t("editPage.characterSettings.currentEmotion")}
                    </span>
                    <span class="collapsible-right">
                        {getFieldPreview(current_emotion)}
                    </span>
                </button>
                {#if !collapsedFields.current_emotion}
                    <div class="field-label">
                        <span class="label-hint"
                            >{$t("editPage.characterSettings.currentEmotionHint")}</span
                        >
                    </div>
                    <textarea
                        bind:value={current_emotion}
                        rows="2"
                        maxlength={getDynamicMax(current_emotion, 200)}
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
                {/if}
            </div>
        {/if}
    {/if}
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

    .total-counter {
        text-align: right;
        font-size: 0.8rem;
        color: var(--muted-foreground);
        margin-top: -0.25rem;
    }
    .total-counter.warning {
        color: orange;
    }
    .total-counter.error {
        color: var(--destructive);
        font-weight: 600;
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

    .field-collapsible {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        text-align: left;
        padding: 0.7rem 0.8rem;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-input);
        background: var(--input);
        color: var(--foreground);
        cursor: pointer;
    }

    .field-collapsible:hover {
        border-color: var(--primary);
    }

    .collapsible-left {
        font-size: 0.88rem;
        font-weight: 700;
    }

    .collapsible-right {
        font-size: 0.78rem;
        color: var(--muted-foreground);
        max-width: 65%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .advanced-toggle-row {
        display: flex;
        justify-content: flex-end;
        margin-top: -0.25rem;
    }

    .advanced-toggle-row.compact {
        margin-top: 0.5rem;
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

</style>

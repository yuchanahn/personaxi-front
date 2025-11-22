<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { t } from "svelte-i18n";
    const dispatch = createEventDispatcher();
    export let initialData: string | null = null;
    export let onChange: (jsonStr: string) => void = () => {};

    let description = "";
    let personality = "";
    let userPersona = "";
    let scenario = "";

    function generateJson() {
        const obj = { description, personality, userPersona, scenario };
        const jsonStr = JSON.stringify(obj, null, 2);
        onChange(jsonStr);
        dispatch("change", jsonStr);
    }

    function reset() {
        description = "";
        personality = "";
        userPersona = "";
        scenario = "";
        generateJson();
    }

    onMount(() => {
        if (initialData) {
            try {
                const data = JSON.parse(initialData);
                description = data.description ?? "";
                personality = data.personality ?? "";
                userPersona = data.userPersona ?? "";
                scenario = data.scenario ?? "";
                generateJson();
            } catch (e) {
                console.error("InstructionBuilder: initialData parse error", e);
            }
        }
    });
</script>

<div class="instruction-builder">
    <div class="builder-header">
        <span class="builder-title">📚 Instruction Configuration</span>
        <div class="builder-actions">
            <button
                type="button"
                class="btn-util primary"
                on:click={generateJson}>Generate JSON</button
            >
            <button type="button" class="btn-util" on:click={reset}
                >Reset</button
            >
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text">Description</span>
            <span class="label-hint">Character overview</span>
        </div>
        <textarea
            bind:value={description}
            rows="5"
            maxlength="1000"
            placeholder="Describe the character's background, role, and purpose..."
        ></textarea>
        <div
            class="char-counter"
            class:warning={description.length > 800}
            class:error={description.length >= 1000}
        >
            {description.length} / 1000
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text">Personality</span>
            <span class="label-hint">Behavioral traits</span>
        </div>
        <textarea
            bind:value={personality}
            rows="5"
            maxlength="1000"
            placeholder="Define how the character thinks, speaks, and acts..."
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
            <span class="label-text">User Persona</span>
            <span class="label-hint">How character sees the user</span>
        </div>
        <textarea
            bind:value={userPersona}
            rows="5"
            maxlength="800"
            placeholder="Define the character's relationship and attitude toward the user..."
        ></textarea>
        <div
            class="char-counter"
            class:warning={userPersona.length > 700}
            class:error={userPersona.length >= 800}
        >
            {userPersona.length} / 800
        </div>
    </div>

    <div class="form-group">
        <div class="field-label">
            <span class="label-text">Scenario</span>
            <span class="label-hint">Current context</span>
        </div>
        <textarea
            bind:value={scenario}
            rows="5"
            maxlength="800"
            placeholder="Set the scene and initial context for interactions..."
        ></textarea>
        <div
            class="char-counter"
            class:warning={scenario.length > 700}
            class:error={scenario.length >= 800}
        >
            {scenario.length} / 800
        </div>
    </div>
</div>

<style>
    .instruction-builder {
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

    .btn-util.primary {
        background: var(--primary-gradient);
        border: 1px solid transparent;
        color: var(--primary-foreground);
    }
</style>

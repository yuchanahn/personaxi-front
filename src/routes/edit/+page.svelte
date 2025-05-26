<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import type { Persona } from "$lib/types";
    import { page } from "$app/stores";
    import { loadPersona, savePersona } from "$lib/api/edit_persona";

    let vrmFile: File | null = null;

    let persona: Persona = {
        id: "",
        owner_id: "",
        name: "",
        personaType: "",
        style: "",
        intro: "",
        tone: "",
        instructions: [],
        promptExamples: [],

        personalitySummary: "", // {{성격_요약}} 캐릭터 성격 요약
        emotionExpressionRules: "", // {{감정_표현_블록}} 감정 표현 규칙
        memoryPolicy: "", // {{기억_정책}} 기억 및 감정 시스템 정책
        outputConstraints: "", // {{출력_제한}} 출력 제한 규칙 (형식, 길이 등)
        additionalRules: "", // {{추가_규칙}} 기타 시스템적 지시 사항
    };
    let instruction = "";
    let promptExample = "";
    let error = "";
    let last_id: string | null = null;

    $: {
        const id = $page.url.searchParams.get("c");
        if (id !== last_id) {
            last_id = id;
            if (id)
                loadPersona(id).then((p) => {
                    persona = p;
                });
        }
    }

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            vrmFile = input.files[0];
        }
    }

    let portraitFile: File | null = null;
    let portraitPreview: string | null = null;

    function handleProfileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            portraitFile = input.files[0];
            portraitPreview = URL.createObjectURL(portraitFile);
        }
    }

    onMount(async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get("c");
        if (id) persona = await loadPersona(id);
    });

    function addInstruction() {
        if (instruction.trim()) {
            persona.instructions = [
                ...persona.instructions,
                instruction.trim(),
            ];
            instruction = "";
        }
    }

    function addPromptExample() {
        if (promptExample.trim()) {
            persona.promptExamples = [
                ...persona.promptExamples,
                promptExample.trim(),
            ];
            promptExample = "";
        }
    }

    function removeInstruction(index: number) {
        persona.instructions = persona.instructions.filter(
            (_, i) => i !== index,
        );
    }

    function removePromptExample(index: number) {
        persona.promptExamples = persona.promptExamples.filter(
            (_, i) => i !== index,
        );
    }
</script>

<div class="container">
    <div class="header">
        <h1>Create Persona</h1>
        <button
            class="save-button"
            type="submit"
            on:click={async () => {
                let id: string | null = await savePersona(
                    persona,
                    vrmFile,
                    portraitFile,
                );
                if (id) {
                    goto(`/personaxi-front/edit?c=${id}`);
                }

                console.log(id);
            }}>Save Persona</button
        >
    </div>
    {#if error}
        <p class="error">{error}</p>
    {/if}
    <div class="scrollable">
        {#if error}
            <p class="error">{error}</p>
        {/if}
        <form>
            <div class="form-group">
                <label for="name">Name</label>
                <input id="name" bind:value={persona.name} required />
            </div>
            <div class="form-group">
                <label for="portrait">Portrait Image</label>
                <input
                    id="portrait"
                    type="file"
                    accept="image/*"
                    on:change={handleProfileChange}
                />
                {#if portraitPreview}
                    <img
                        src={portraitPreview}
                        alt="Profile preview"
                        class="preview-image"
                    />
                {/if}
            </div>
            <div class="form-group">
                <label for="personaType">Persona Type</label>
                <select
                    id="personaType"
                    bind:value={persona.personaType}
                    required
                >
                    <option value="" disabled selected>Select type</option>
                    <option value="3D">3D</option>
                    <option value="2D">2D</option>
                </select>
            </div>
            {#if persona.personaType == "3D"}
                <div class="form-group">
                    <label for="vrm">VRM File</label>
                    <input
                        id="vrm"
                        type="file"
                        accept=".vrm"
                        on:change={handleFileChange}
                    />
                </div>
            {/if}
            <div class="form-group">
                <label for="Personality">Personality</label>
                <input
                    id="Personality"
                    bind:value={persona.personalitySummary}
                />
            </div>
            <div class="form-group">
                <label for="EmotionExpressionRules"
                    >EmotionExpressionRules</label
                >
                <textarea
                    id="EmotionExpressionRules"
                    bind:value={persona.emotionExpressionRules}
                ></textarea>
            </div>
            <div class="form-group">
                <label for="MemoryPolicy">MemoryPolicy</label>
                <input id="MemoryPolicy" bind:value={persona.memoryPolicy} />
            </div>
            <div class="form-group">
                <label for="OutputConstraints">OutputConstraints</label>
                <input
                    id="OutputConstraints"
                    bind:value={persona.outputConstraints}
                />
            </div>
            <div class="form-group">
                <label for="AdditionalRules">AdditionalRules</label>
                <textarea
                    id="AdditionalRules"
                    bind:value={persona.additionalRules}
                ></textarea>
            </div>
            <div class="form-group">
                <label>Instructions</label>
                <div class="input-group">
                    <input
                        bind:value={instruction}
                        placeholder="Add instruction"
                    />
                    <button type="button" on:click={addInstruction}>Add</button>
                </div>
                <ul>
                    {#each persona.instructions as inst, i}
                        <li>
                            {inst}
                            <button
                                type="button"
                                on:click={() => removeInstruction(i)}
                                >Remove</button
                            >
                        </li>
                    {/each}
                </ul>
            </div>
            <div class="form-group">
                <label>Prompt Examples</label>
                <div class="input-group">
                    <input
                        bind:value={promptExample}
                        placeholder="Add prompt example"
                    />
                    <button type="button" on:click={addPromptExample}
                        >Add</button
                    >
                </div>
                <ul>
                    {#each persona.promptExamples as prompt, i}
                        <li>
                            {prompt}
                            <button
                                type="button"
                                on:click={() => removePromptExample(i)}
                                >Remove</button
                            >
                        </li>
                    {/each}
                </ul>
            </div>
        </form>
    </div>
</div>

<style>
    .container {
        max-width: 600px;
        margin: 0 auto;
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
    }
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 10;
        padding: 0.5rem 0;
        flex-shrink: 0;
    }
    .scrollable {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding-top: 1rem;
    }
    .form-group {
        margin-bottom: 1rem;
    }
    select {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #2a2a2a;
        color: white;
    }
    label {
        display: block;
        margin-bottom: 0.5rem;
    }
    input,
    textarea {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #2a2a2a;
        color: white;
        box-sizing: border-box;
        outline: none;
    }
    textarea {
        height: 100px;
    }
    .input-group {
        display: flex;
        gap: 0.5rem;
    }
    button {
        padding: 0.5rem 1rem;
        background: #181818;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    button:hover {
        background: #333;
    }
    .save-button {
        padding: 0.5rem 1rem;
        background: #181818;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    .save-button:hover {
        background: #333;
    }
    .error {
        color: red;
    }
    ul {
        list-style: none;
        padding: 0;
    }
    li {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
    }
</style>

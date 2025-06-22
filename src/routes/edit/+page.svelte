<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import type { Persona } from "$lib/types";
    import { page } from "$app/stores";
    import { loadPersona, savePersona } from "$lib/api/edit_persona";

    let vrmFile: File | null = null;

    let persona: Persona = {
        id: "",
        owner_id: [],
        name: "",
        personaType: "",
        instructions: [],
        promptExamples: [],
        tags: [],
    };
    let instruction = "";
    let promptExample = "";
    let tags = "";
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
        if (instruction.trim() !== "") {
            persona.instructions = [
                ...persona.instructions,
                "\n" + instruction,
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

    function addTag() {
        const newTags = tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag !== "");

        if (newTags.length > 0) {
            persona.tags = [...persona.tags, ...newTags];
            tags = "";
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

    function removeTag(index: number) {
        persona.tags = persona.tags.filter((_, i) => i !== index);
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
                    goto(`/edit?c=${id}`);
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
                <label>Instructions</label>
                <div class="input-group">
                    <!-- svelte-ignore element_invalid_self_closing_tag -->
                    <textarea
                        bind:value={instruction}
                        placeholder="Add instruction"
                    />
                    <button type="button" on:click={addInstruction}>Add</button>
                </div>
                <ul>
                    {#each persona.instructions as inst, i}
                        <li class="instruction-item">
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

            <div class="form-group">
                <label>Tags</label>
                <div class="input-group">
                    <input
                        type="text"
                        bind:value={tags}
                        placeholder="태그를 쉼표(,)로 구분해서 입력 (예: 인간,감정,AI)"
                        on:keydown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                addTag();
                            }
                        }}
                    />
                    <button type="button" on:click={addTag}>Add</button>
                </div>
                <ul class="tag-list">
                    {#each persona.tags as tag, i}
                        <li class="tag-item">
                            <span>{tag}</span>
                            <button
                                type="button"
                                on:click={() => removeTag(i)}
                                class="remove-tag-button"
                            >
                                &times;
                            </button>
                        </li>
                    {/each}
                </ul>
            </div>
        </form>
    </div>
</div>

<style>
    /* style 태그 안에 추가 */
    .instruction-item {
        /* 중요한 속성! */
        white-space: pre-wrap;

        /* 다른 스타일 (선택 사항) */
        border: 1px solid #eee;
        padding: 10px;
        margin-bottom: 8px;
        border-radius: 4px;
        display: flex; /* 버튼 정렬을 위해 flexbox 사용 */
        justify-content: space-between; /* 텍스트와 버튼을 양 끝으로 정렬 */
        align-items: flex-start; /* 여러 줄일 때 위로 정렬 */
        font-size: 0.95em;
        line-height: 1.5;
        text-align: left; /* 텍스트 정렬 */
        word-break: break-word; /* 긴 단어가 줄바꿈되도록 */
    }

    .instruction-item button {
        margin-left: 15px; /* 텍스트와 버튼 사이 간격 */
        flex-shrink: 0; /* 버튼이 줄어들지 않도록 */
        padding: 5px 10px;
        background-color: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .instruction-item button:hover {
        background-color: #c82333;
    }
    /* 기존 스타일 외에 추가 */
    .tag-list {
        list-style: none; /* 기본 리스트 스타일 제거 */
        padding: 0;
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap; /* 태그가 많으면 줄바꿈되도록 */
        gap: 8px; /* 태그 아이템 사이 간격 */
    }

    .tag-item {
        background-color: #e0e0e0; /* 태그 배경색 */
        color: #333;
        padding: 6px 12px;
        border-radius: 20px; /* 둥근 모서리 */
        display: flex;
        align-items: center;
        gap: 8px; /* 태그 텍스트와 버튼 사이 간격 */
        font-size: 0.9em;
    }

    .tag-item span {
        /* 태그 텍스트에 대한 추가 스타일 (선택 사항) */
        white-space: nowrap; /* 태그 텍스트는 줄바꿈되지 않도록 */
    }

    .remove-tag-button {
        background: none; /* 버튼 배경 제거 */
        border: none;
        color: #666; /* X 버튼 색상 */
        font-weight: bold;
        font-size: 1.2em;
        cursor: pointer;
        padding: 0 5px; /* 패딩 조절 */
        line-height: 1; /* 높이 조절 */
        transition: color 0.2s ease;
    }

    .remove-tag-button:hover {
        color: #dc3545; /* 호버 시 빨간색 */
    }

    /* 다른 스타일 (input-group, button 등)은 기존 코드에서 유지 */

    input[type="text"] {
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        width: 300px;
    }

    button {
        padding: 8px 12px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
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

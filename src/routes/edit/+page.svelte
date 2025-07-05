<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import type { Persona } from "$lib/types";
    import { page } from "$app/stores";
    import { loadPersona, savePersona } from "$lib/api/edit_persona";
    // import 영역에 추가
    import LoadingAnimation from "$lib/components/utils/LoadingAnimation.svelte"; // 파일 경로에 맞게 수정
    import { fade } from "svelte/transition"; // LoadingAnimation 컴포넌트의 transition을 위해 추가

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

    // let loading = false; 를 아래와 같이 수정
    let loading = false;
    let showSuccess = false; // 저장 성공 상태를 표시하기 위한 변수
</script>

<div class="container">
    <div class="header">
        <!-- svelte-ignore a11y_missing_content -->
        <h1></h1>
        <button
            class="save-button"
            type="submit"
            on:click={async () => {
                if (loading || showSuccess) return;

                error = ""; // 에러 초기화

                if (!persona.name.trim() || !persona.personaType) {
                    error = "이름과 페르소나 타입은 필수 항목입니다.";
                    return; // 저장 로직 중단
                }

                loading = true;

                try {
                    const id: string | null = await savePersona(
                        persona,
                        vrmFile,
                        portraitFile,
                    );

                    if (id) {
                        showSuccess = true;
                        setTimeout(() => {
                            showSuccess = false;
                        }, 2000); // 2초 후 원래대로 복귀

                        if (!persona.id) {
                            goto(`/edit?c=${id}`, { replaceState: true });
                        }
                    }
                } catch (e: any) {
                    error = "저장에 실패했습니다: " + e.message;
                } finally {
                    loading = false;
                }
            }}
        >
            {#if loading}
                <span>저장 중...</span>
            {:else if showSuccess}
                <span>✓ 저장 완료</span>
            {:else}
                <span>페르소나 저장</span>
            {/if}
        </button>
    </div>
    {#if error}
        <p class="error">{error}</p>
    {/if}
    <div class="scrollable-content">
        <div class="form-grid">
            <div class="form-column">
                <div class="form-section-card">
                    <h2>기본 정보</h2>
                    <div class="form-group">
                        <label for="name">이름</label>
                        <input
                            id="name"
                            bind:value={persona.name}
                            required
                            placeholder="페르소나의 이름"
                        />
                    </div>
                    <div class="form-group">
                        <label for="personaType">페르소나 타입</label>
                        <select
                            id="personaType"
                            bind:value={persona.personaType}
                            required
                        >
                            <option value="" disabled>타입을 선택하세요</option>
                            <option value="3D">3D</option>
                            <option value="2D">2D</option>
                        </select>
                    </div>
                </div>

                <div class="form-section-card">
                    <h2>미디어 파일</h2>
                    <div class="form-group">
                        <label for="portrait">프로필 이미지</label>
                        <div class="file-input-container">
                            <label for="portrait-file" class="file-input-label">
                                <span>파일 선택</span>
                            </label>
                            <input
                                id="portrait-file"
                                type="file"
                                accept="image/*"
                                on:change={handleProfileChange}
                                class="file-input-hidden"
                            />
                            {#if portraitFile}
                                <span class="file-name"
                                    >{portraitFile.name}</span
                                >
                            {/if}
                        </div>
                        {#if portraitPreview}
                            <img
                                src={portraitPreview}
                                alt="Profile preview"
                                class="preview-image"
                            />
                        {/if}
                    </div>

                    {#if persona.personaType == "3D"}
                        <div class="form-group">
                            <label for="vrm">VRM 파일</label>
                            <div class="file-input-container">
                                <label for="vrm-file" class="file-input-label">
                                    <span>파일 선택</span>
                                </label>
                                <input
                                    id="vrm-file"
                                    type="file"
                                    accept=".vrm"
                                    on:change={handleFileChange}
                                    class="file-input-hidden"
                                />
                                {#if vrmFile}
                                    <span class="file-name">{vrmFile.name}</span
                                    >
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>

            <div class="form-column">
                <div class="form-section-card">
                    <h2>AI 상세 설정</h2>
                    <div class="form-group">
                        <label for="instruction-input"
                            >지시사항 (Instructions)</label
                        >
                        <p class="description">
                            AI의 역할, 성격, 말투 등 핵심적인 정체성을
                            정의합니다.
                        </p>
                        <div class="input-group">
                            <textarea
                                id="instruction-input"
                                bind:value={instruction}
                                placeholder="예: 당신은 친절한 인공지능 비서입니다."
                                rows="3"
                            />
                            <button
                                type="button"
                                class="btn btn-secondary"
                                on:click={addInstruction}>추가</button
                            >
                        </div>
                        <ul class="item-list">
                            {#each persona.instructions as inst, i}
                                <li class="item">
                                    <span class="item-text">{inst}</span>
                                    <button
                                        type="button"
                                        class="btn-remove"
                                        on:click={() => removeInstruction(i)}
                                        >&times;</button
                                    >
                                </li>
                            {/each}
                        </ul>
                    </div>
                    <div class="form-group">
                        <label for="prompt-example-input"
                            >예시 대화 (Prompt Examples)</label
                        >
                        <p class="description">
                            AI가 따라해야 할 구체적인 대화 예시를 제공합니다.
                        </p>
                        <div class="input-group">
                            <input
                                id="prompt-example-input"
                                bind:value={promptExample}
                                placeholder="예: User: 오늘 날씨 어때? / Assistant: 오늘은 맑고 화창한 날씨예요!"
                            />
                            <button
                                type="button"
                                class="btn btn-secondary"
                                on:click={addPromptExample}>추가</button
                            >
                        </div>
                        <ul class="item-list">
                            {#each persona.promptExamples as prompt, i}
                                <li class="item">
                                    <span class="item-text">{prompt}</span>
                                    <button
                                        type="button"
                                        class="btn-remove"
                                        on:click={() => removePromptExample(i)}
                                        >&times;</button
                                    >
                                </li>
                            {/each}
                        </ul>
                    </div>
                    <div class="form-group">
                        <label for="tags-input">태그</label>
                        <p class="description">
                            쉼표(,)로 구분하여 여러 태그를 한 번에 추가할 수
                            있습니다.
                        </p>
                        <div class="input-group">
                            <input
                                id="tags-input"
                                type="text"
                                bind:value={tags}
                                placeholder="예: AI, 친구, 대화"
                                on:keydown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addTag();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                class="btn btn-secondary"
                                on:click={addTag}>추가</button
                            >
                        </div>
                        <ul class="tag-list">
                            {#each persona.tags as tag, i}
                                <li class="tag-item">
                                    {tag}
                                    <button
                                        type="button"
                                        class="btn-remove"
                                        on:click={() => removeTag(i)}
                                        >&times;</button
                                    >
                                </li>
                            {/each}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
<LoadingAnimation isOpen={loading} />

<style>
    :root {
        --bg-primary: #121212;
        --bg-secondary: #1e1e1e;
        --bg-tertiary: #2a2a2a;
        --text-primary: #e0e0e0;
        --text-secondary: #a0a0a0;
        --border-color: #333;
        --accent-primary: #4a90e2;
        --accent-danger: #e24a4a;
    }

    /* === 기본 레이아웃 === */
    .container {
        height: 100vh;
        display: flex;
        flex-direction: column;
        background-color: var(--bg-primary);
        color: var(--text-primary);
        max-width: 1200px; /* 최대 너비 조정 */
        margin: 0 auto;
        padding: 0 1.5rem;
        box-sizing: border-box;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem 0;
        flex-shrink: 0;
        border-bottom: 1px solid var(--border-color);
    }

    .scrollable-content {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
        padding-top: 1.5rem;
    }
    /* 스크롤바 디자인 */
    .scrollable-content::-webkit-scrollbar {
        width: 8px;
    }
    .scrollable-content::-webkit-scrollbar-track {
        background: transparent;
    }
    .scrollable-content::-webkit-scrollbar-thumb {
        background: #555;
        border-radius: 4px;
    }
    .scrollable-content::-webkit-scrollbar-thumb:hover {
        background: #777;
    }

    /* === 2단 폼 레이아웃 === */
    .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 1.5rem;
        align-items: start;
    }

    .form-column {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .form-section-card {
        background-color: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 1.5rem;
    }
    .form-section-card h2 {
        margin-top: 0;
        margin-bottom: 1.5rem;
        font-size: 1.25rem;
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 0.75rem;
    }

    /* === 폼 요소 공통 스타일 === */
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
        color: var(--text-secondary);
        margin-top: -0.25rem;
        margin-bottom: 0.75rem;
    }
    input,
    select,
    textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--bg-tertiary);
        color: var(--text-primary);
        box-sizing: border-box;
        transition:
            border-color 0.2s,
            box-shadow 0.2s;
    }
    input:focus,
    select:focus,
    textarea:focus {
        outline: none;
        border-color: var(--accent-primary);
        box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.3);
    }

    .input-group {
        display: flex;
        gap: 0.5rem;
    }
    .input-group > :first-child {
        flex: 1;
    }

    /* === 커스텀 파일 업로드 === */
    .file-input-hidden {
        display: none;
    }
    .file-input-container {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    .file-input-label {
        display: inline-block;
        padding: 0.6rem 1.2rem;
        background-color: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .file-input-label:hover {
        background-color: #3c3c3c;
    }
    .file-name {
        font-size: 0.9rem;
        color: var(--text-secondary);
    }
    .preview-image {
        margin-top: 1rem;
        max-width: 150px;
        max-height: 150px;
        border-radius: 8px;
        object-fit: cover;
        border: 1px solid var(--border-color);
    }

    /* === 동적 아이템 리스트 === */
    .item-list {
        list-style: none;
        padding: 0;
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        background: var(--bg-tertiary);
        padding: 0.75rem;
        border-radius: 6px;
        font-size: 0.9rem;
        line-height: 1.5;
        word-break: break-word;
    }
    .item-text {
        white-space: pre-wrap; /* 줄바꿈 문자 표시 */
    }

    .tag-list {
        list-style: none;
        padding: 0;
        margin-top: 1rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .tag-item {
        background-color: var(--bg-tertiary);
        color: var(--text-primary);
        padding: 0.3rem 0.8rem;
        border-radius: 16px;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
    }

    /* === 버튼 === */
    .btn {
        padding: 0.6rem 1.2rem;
        font-size: 0.9rem;
        font-weight: 600;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
    }
    .btn-primary {
        background: var(--accent-primary);
        border-color: var(--accent-primary);
        color: white;
    }
    .btn-primary:hover:not(:disabled) {
        background: #62a2e9;
    }

    .btn-secondary {
        background: var(--bg-tertiary);
        color: var(--text-primary);
    }
    .btn-secondary:hover:not(:disabled) {
        background: #3c3c3c;
    }

    .btn-remove {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
        padding: 0 0.25rem;
    }
    .btn-remove:hover {
        color: var(--accent-danger);
    }

    .save-button {
        /* .btn, .btn-primary 스타일 상속 */
        padding: 0.6rem 1.2rem;
        font-size: 0.9rem;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        background: var(--accent-primary);
        border: 1px solid var(--accent-primary);
        color: white;
    }
    .save-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .save-button:hover:not(:disabled) {
        background: #62a2e9;
        border-color: #62a2e9;
    }

    .error {
        color: var(--accent-danger);
        background-color: rgba(226, 74, 74, 0.1);
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
    }

    /* 기존 .save-button 관련 스타일 아래에 추가 */
    .save-button.success {
        background: #28a745; /* 성공 시 초록색 배경 */
        border-color: #28a745;
    }

    .save-button:disabled {
        opacity: 0.8; /* 로딩 중일 때 버튼 약간 투명하게 */
        cursor: wait; /* 커서 모양 변경 */
    }
</style>

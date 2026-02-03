<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { marked } from "marked";
    import { locale, t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { get } from "svelte/store";
    import { toast } from "$lib/stores/toast";

    export let isOpen: boolean = false;
    const dispatch = createEventDispatcher();

    let expandedSection: "privacy" | "terms" | null = null;
    let agreePrivacy = false;
    let agreeTerms = false;

    $: allAgreed = agreePrivacy && agreeTerms;
    $: someAgreed = agreePrivacy || agreeTerms;
    $: isIndeterminate = !allAgreed && someAgreed;

    function handleToggleAll() {
        const newState = !allAgreed;
        agreePrivacy = newState;
        agreeTerms = newState;
    }

    function handleConfirm() {
        if (allAgreed) {
            dispatch("confirm");
        } else {
            toast.warning(get(t)("consentModal.alertAllAgreed"));
        }
    }

    function toggleSection(section: "privacy" | "terms") {
        expandedSection = expandedSection === section ? null : section;
    }

    // --- 동적 컨텐츠 로드 ---
    let privacyPolicyContent = "";
    let termsOfServiceContent = "";

    onMount(() => {
        async function loadContent(loc: string | null | undefined) {
            if (!loc) return;
            try {
                const [termsModule, policyModule] = await Promise.all([
                    import(`$lib/i18n/locales/${loc}/terms.md?raw`),
                    import(`$lib/i18n/locales/${loc}/policy.md?raw`),
                ]);
                termsOfServiceContent = marked(termsModule.default) as string;
                privacyPolicyContent = marked(policyModule.default) as string;
            } catch (e) {
                console.error("Failed to load consent documents:", e);
            }
        }
        const unsubscribe = locale.subscribe(loadContent);
        return unsubscribe;
    });
</script>

{#if isOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="modal-content" on:click|stopPropagation>
            <div class="modal-header">
                <h2>{$t("consentModal.title")}</h2>
            </div>

            <div class="modal-body">
                <label class="all-agree-container">
                    <input
                        type="checkbox"
                        on:change={handleToggleAll}
                        checked={allAgreed}
                        indeterminate={isIndeterminate}
                    />
                    <span class="checkmark"></span>
                    <span class="all-agree-text"
                        >{$t("consentModal.agreeToAll")}</span
                    >
                </label>

                <div class="separator"></div>

                <div class="agreements-list">
                    <div class="agreement-item">
                        <div class="agreement-header">
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    bind:checked={agreePrivacy}
                                />
                                <span class="checkmark"></span>
                                {$t("consentModal.agreePrivacy")}
                            </label>
                            <button
                                class="toggle-button"
                                on:click={() => toggleSection("privacy")}
                            >
                                <span
                                    class="toggle-icon-wrapper"
                                    class:rotated={expandedSection ===
                                        "privacy"}
                                >
                                    <Icon icon="mdi:chevron-down" />
                                </span>
                            </button>
                        </div>
                        {#if expandedSection === "privacy"}
                            <div class="agreement-content">
                                {@html privacyPolicyContent}
                            </div>
                        {/if}
                    </div>

                    <div class="agreement-item">
                        <div class="agreement-header">
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    bind:checked={agreeTerms}
                                />
                                <span class="checkmark"></span>
                                {$t("consentModal.agreeTerms")}
                            </label>
                            <button
                                class="toggle-button"
                                on:click={() => toggleSection("terms")}
                            >
                                <span
                                    class="toggle-icon-wrapper"
                                    class:rotated={expandedSection === "terms"}
                                >
                                    <Icon icon="mdi:chevron-down" />
                                </span>
                            </button>
                        </div>
                        {#if expandedSection === "terms"}
                            <div class="agreement-content">
                                {@html termsOfServiceContent}
                            </div>
                        {/if}
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button
                    class="confirm-button"
                    disabled={!allAgreed}
                    on:click={handleConfirm}
                >
                    {$t("consentModal.confirmButton")}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    /* 최상위 오버레이 */
    .modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: hsl(
            from var(--dark) h s l / 0.7
        ); /* ❗ 수정: 테마의 --dark 변수를 사용해 반투명 배경 생성 */
        backdrop-filter: blur(5px);
    }

    /* 모달 컨텐츠 박스 */
    .modal-content {
        position: relative;
        display: flex;
        flex-direction: column;
        width: 90%;
        max-width: 700px;
        max-height: 90vh;
        margin: 1rem;
        border-radius: 16px; /* ❗ 수정: 테마에 맞는 적절한 값으로 변경 */
        background-color: var(
            --popover
        ); /* ❗ 수정: --background-alt 대신 --popover 사용 */
        color: var(--foreground);
        border: 1px solid var(--border);
        box-shadow: var(--shadow-popover);
    }

    /* 헤더 */
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem;
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
    }
    .modal-header h2 {
        margin: 0;
        font-size: 1.8rem;
        font-weight: bold;
    }

    /* 본문 (스크롤 영역) */
    .modal-body {
        flex: 1;
        padding: 1.5rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    /* 전체 동의 */
    .all-agree-container {
        display: flex;
        align-items: center;
        padding: 1rem;
        background-color: var(
            --secondary
        ); /* ❗ 수정: 구분감을 위해 --secondary 사용 */
        border: 1px solid var(--border-input);
        border-radius: var(--radius-card); /* ❗ 수정: 테마 변수 사용 */
        cursor: pointer;
    }
    .all-agree-text {
        font-size: 1.2rem;
        font-weight: bold;
        margin-left: 0.75rem;
    }

    .separator {
        border-top: 1px solid var(--border);
        margin: 0.5rem 0;
    }

    /* 개별 동의 항목 리스트 */
    .agreements-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .agreement-item {
        padding: 0.5rem 0.25rem;
    }
    .agreement-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .checkbox-label {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
        font-size: 1rem;
    }
    .toggle-button {
        background: none;
        border: none;
        padding: 0.25rem;
        cursor: pointer;
        color: var(--muted-foreground);
    }

    .toggle-icon-wrapper {
        display: flex;
        align-items: center;
        transition: transform 0.3s ease;
    }

    .toggle-icon-wrapper.rotated {
        transform: rotate(180deg);
    }

    /* 약관 내용 박스 */
    .agreement-content {
        margin-top: 0.75rem;
        padding: 1rem;
        max-height: 200px;
        overflow-y: auto;
        background-color: var(
            --secondary
        ); /* ❗ 수정: 구분감을 위해 --secondary 사용 */
        border: 1px solid var(--border-input);
        border-radius: var(--radius-card); /* ❗ 수정: 테마 변수 사용 */
        line-height: 1.6;
        color: var(--foreground-alt);
    }
    /* 약관 내용 안의 제목, 리스트 등 스타일 */
    .agreement-content :global(h1),
    .agreement-content :global(h2) {
        color: var(--foreground);
        font-size: 1.25em;
        font-weight: bold;
        margin-bottom: 0.5em;
    }
    .agreement-content :global(ul) {
        padding-left: 1.25rem;
    }
    .agreement-content :global(a) {
        color: var(--primary); /* ❗ 수정: 강조 링크는 --primary 색상 사용 */
    }

    /* 푸터 */
    .modal-footer {
        padding: 1.5rem;
        border-top: 1px solid var(--border);
        flex-shrink: 0;
    }
    .confirm-button {
        width: 100%;
        padding: 0.75rem;
        font-size: 1.1rem;
        font-weight: bold;
        border: none;
        border-radius: var(--radius-button);
        color: var(
            --primary-foreground
        ); /* ❗ 수정: --primary에 어울리는 전경색 */
        background-color: var(
            --primary
        ); /* ❗ 수정: 주요 버튼은 --primary 색상 사용 */
        cursor: pointer;
        transition: opacity 0.2s;
    }
    .confirm-button:disabled {
        background-color: var(--muted);
        color: var(--muted-foreground);
        cursor: not-allowed;
    }
    .confirm-button:not(:disabled):hover {
        opacity: 0.85;
    }

    /* --- 커스텀 체크박스 스타일 --- */
    input[type="checkbox"] {
        position: absolute;
        opacity: 0;
        cursor: pointer;
        height: 0;
        width: 0;
    }
    .checkmark {
        height: 20px;
        width: 20px;
        background-color: var(--card); /* ❗ 수정: 테마에 맞는 배경색 */
        border: 1px solid var(--border-input);
        border-radius: 4px;
        display: inline-block;
        position: relative;
    }
    .checkbox-label:hover input ~ .checkmark,
    .all-agree-container:hover input ~ .checkmark {
        border-color: var(
            --ring
        ); /* ❗ 수정: hover 시 포커스 색상(ring) 사용 */
    }
    input:checked ~ .checkmark {
        background-color: var(
            --primary
        ); /* ❗ 수정: 체크 시 --primary 색상 사용 */
        border-color: var(--primary);
    }
    .checkmark:after {
        content: "";
        position: absolute;
        display: none;
    }
    input:checked ~ .checkmark:after {
        display: block;
    }
    .checkmark:after {
        left: 6px;
        top: 2px;
        width: 5px;
        height: 10px;
        border: solid var(--primary-foreground); /* ❗ 수정: --primary에 어울리는 전경색 */
        border-width: 0 3px 3px 0;
        transform: rotate(45deg);
    }
    /* 불확정 상태 스타일 */
    input:indeterminate ~ .checkmark {
        background-color: var(--primary); /* ❗ 수정: --primary 색상 사용 */
        border-color: var(--primary);
    }
    input:indeterminate ~ .checkmark:after {
        content: "";
        position: absolute;
        display: block;
        left: 4px;
        top: 8px;
        width: 10px;
        height: 2px;
        background: var(
            --primary-foreground
        ); /* ❗ 수정: --primary에 어울리는 전경색 */
        transform: none;
        border: none;
    }
</style>

<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { marked } from "marked";
    import { locale, t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { get } from "svelte/store";

    export let isOpen: boolean = false;
    const dispatch = createEventDispatcher();

    let expandedSection: "privacy" | "terms" | "chatLogs" | null = null;
    let agreePrivacy = false;
    let agreeTerms = false;
    let agreeChatLogs = false;

    $: allAgreed = agreePrivacy && agreeTerms && agreeChatLogs;
    $: someAgreed = agreePrivacy || agreeTerms || agreeChatLogs;
    $: isIndeterminate = !allAgreed && someAgreed;

    function handleToggleAll() {
        const newState = !allAgreed;
        agreePrivacy = newState;
        agreeTerms = newState;
        agreeChatLogs = newState;
    }

    function handleConfirm() {
        if (allAgreed) {
            dispatch("confirm");
        } else {
            alert(get(t)("consentModal.alertAllAgreed"));
        }
    }

    function toggleSection(section: "privacy" | "terms" | "chatLogs") {
        expandedSection = expandedSection === section ? null : section;
    }

    // --- 동적 컨텐츠 로드 ---
    let privacyPolicyContent = "";
    let termsOfServiceContent = "";
    let chatLogsConsentContent = "";
    onMount(() => {
        async function loadContent(loc: string | null) {
            if (!loc) return;
            try {
                const [termsModule, policyModule, logsModule] =
                    await Promise.all([
                        import(`$lib/i18n/locales/${loc}/terms.md?raw`),
                        import(`$lib/i18n/locales/${loc}/policy.md?raw`),
                        import(
                            `$lib/i18n/locales/${loc}/privacy-chat-logs.md?raw`
                        ),
                    ]);
                termsOfServiceContent = marked(termsModule.default) as string;
                privacyPolicyContent = marked(policyModule.default) as string;
                chatLogsConsentContent = marked(logsModule.default) as string;
            } catch (e) {
                console.error("Failed to load consent documents:", e);
            }
        }
        const unsubscribe = locale.subscribe(loadContent);
        return unsubscribe;
    });
</script>

{#if isOpen}
    <div class="modal-overlay">
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

                    <div class="agreement-item">
                        <div class="agreement-header">
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    bind:checked={agreeChatLogs}
                                />
                                <span class="checkmark"></span>
                                {$t("consentModal.agreeChatLogs")}
                            </label>
                            <button
                                class="toggle-button"
                                on:click={() => toggleSection("chatLogs")}
                            >
                                <span
                                    class="toggle-icon-wrapper"
                                    class:rotated={expandedSection ===
                                        "chatLogs"}
                                >
                                    <Icon icon="mdi:chevron-down" />
                                </span>
                            </button>
                        </div>
                        {#if expandedSection === "chatLogs"}
                            <div class="agreement-content">
                                {@html chatLogsConsentContent}
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
        background-color: rgba(0, 0, 0, 0.7);
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
        border-radius: var(--radius-card-lg, 20px);
        background-color: var(--background-alt);
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
    .close-button {
        background: none;
        border: none;
        font-size: 2rem;
        color: var(--muted-foreground);
        cursor: pointer;
        transition: color 0.2s;
    }
    .close-button:hover {
        color: var(--foreground);
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
        background-color: var(--background);
        border: 1px solid var(--border-input);
        border-radius: var(--radius-card, 16px);
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
    .toggle-icon {
        transition: transform 0.3s ease;
    }
    .toggle-icon.rotated {
        transform: rotate(180deg);
    }

    .toggle-icon-wrapper {
        display: flex; /* 아이콘을 가운데 정렬하기 위해 추가 */
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
        background-color: var(--background);
        border: 1px solid var(--border-input);
        border-radius: var(--radius-card-sm, 10px);
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
        color: var(--accent);
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
        border-radius: var(--radius-button, 5px);
        color: var(--accent-foreground);
        background-color: var(--accent);
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
        background-color: var(--background);
        border: 1px solid var(--border-input);
        border-radius: 4px;
        display: inline-block;
        position: relative;
    }
    .checkbox-label:hover input ~ .checkmark,
    .all-agree-container:hover input ~ .checkmark {
        border-color: var(--border-input-hover);
    }
    input:checked ~ .checkmark {
        background-color: var(--accent);
        border-color: var(--accent);
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
        border: solid var(--accent-foreground, white);
        border-width: 0 3px 3px 0;
        transform: rotate(45deg);
    }
    /* 불확정 상태 스타일 */
    input:indeterminate ~ .checkmark {
        background-color: var(--accent);
        border-color: var(--accent);
    }
    input:indeterminate ~ .checkmark:after {
        content: "";
        position: absolute;
        display: block;
        left: 4px;
        top: 8px;
        width: 10px;
        height: 2px;
        background: var(--accent-foreground, white);
        transform: none;
        border: none;
    }
</style>

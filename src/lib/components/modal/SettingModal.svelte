<script lang="ts">
    import { fade, fly } from "svelte/transition"; // 👈 이 줄을 추가하세요
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";

    import { api } from "$lib/api";
    import type { Persona } from "$lib/types";
    import { deleteChatHistory, resetChatHistory } from "$lib/api/chat";
    import { loadlikesdata } from "$lib/api/content";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { get } from "svelte/store";
    import { chatSessions } from "$lib/stores/chatSessions";
    import type { User } from "$lib/types";
    import { getCurrentUser } from "$lib/api/auth";

    export let isOpen: boolean = false;
    export let persona: Persona;
    export let llmType: string = "Error";
    export let mode: "2d" | "3d" = "3d";
    export let showImage: boolean = true;

    let change_llm_type = "";

    const dispatch = createEventDispatcher();

    let isLoading = false;
    let isConfirmingDelete = false;
    let statusMessage = "";

    $: isLiked = persona.is_liked || false;

    const availableLLMs = [
        { id: "gemini-flash", name: "Gemini Flash", cost: 3 },
        { id: "gemini-flash-lite", name: "Gemini Flash Lite", cost: 1 },
        { id: "gemini-pro", name: "Gemini Pro", cost: 5 },
    ];
    let selectedLLM =
        availableLLMs.find((llm) => llm.id === llmType) || availableLLMs[1]; // Default to Flash-Lite

    function changeLLMType(newType: string) {
        selectedLLM =
            availableLLMs.find((llm) => llm.id === newType) || availableLLMs[1]; // Default to Flash-Lite

        chatSessions.update((sessions) => {
            return sessions.map((session) => {
                if (session.id === persona.id) {
                    return { ...session, llmType: newType };
                }
                return session;
            });
        });

        const currentPage = get(page);
        const params = new URLSearchParams(currentPage.url.searchParams);
        params.set("llmType", newType);
        goto(`?${params.toString()}`, {
            replaceState: true,
            noScroll: true,
            keepFocus: true,
        });
    }

    let user: User | null = null;

    onMount(async () => {
        try {
            const likes: string[] = await loadlikesdata();
            if (persona) {
                persona.is_liked = likes.includes(persona.id);
            }
        } catch (e) {
            console.error("Failed to load likes:", e);
        }
    });

    /* -------------------- Event Handlers -------------------- */
    async function showStatus(message: string, duration: number = 2000) {
        statusMessage = message;
        if (duration > 0) {
            setTimeout(() => (statusMessage = ""), duration);
        }
    }

    // [REFACTOR] 비동기 처리, 피드백 추가, 이벤트 방식 변경
    async function handleLikeToggle() {
        isLoading = true;
        const newLikeStatus = !isLiked;
        const endpoint = newLikeStatus ? "like" : "dislike"; // 'unlike' API가 있다고 가정
        const url = `/api/persona/${endpoint}?id=${persona.id}`;

        try {
            const res = await api.get(url);
            if (!res.ok) throw new Error(await res.text());

            isLiked = newLikeStatus;
            persona.is_liked = newLikeStatus; // 부모에게 전달될 persona 객체도 업데이트
            dispatch("like-updated", {
                personaId: persona.id,
                isLiked: newLikeStatus,
            });
            showStatus(newLikeStatus ? "👍 Liked!" : "Like removed.");
        } catch (error) {
            console.error("Like toggle failed:", error);
            showStatus("❌ Error!", 2000);
        } finally {
            isLoading = false;
        }
    }

    async function handleLLMChange() {
        isLoading = true;
        showStatus("Saving...", 0);
        try {
            api.post(`/api/chat/char/sessions/edit`, {
                cssid: persona.id,
                llmType: selectedLLM.id,
            })
                .then((res) => {
                    if (!res.ok) {
                        throw new Error("Failed to update LLM type");
                    }
                    return res.json();
                })
                .then(() => {
                    changeLLMType(selectedLLM.id); // URL 업데이트
                });

            //settings.set({
            //    ...get(settings),
            //    llmType: selectedLLM.id,
            //});

            showStatus("✅ Saved!");
        } catch (error) {
            console.error("Failed to save LLM preference:", error);
            showStatus("❌ Error!", 2000);
        } finally {
            isLoading = false;
        }
    }

    async function handleResetChat() {
        if (!confirm($t("settingModal.confirmReset"))) return;
        isLoading = true;
        showStatus("Resetting chat...", 0);
        try {
            await resetChatHistory(persona.id);
            showStatus("✅ Chat Reset!");
            setTimeout(() => dispatch("close"), 1000);
        } catch (error) {
            console.error("Failed to reset chat:", error);
            showStatus("❌ Error!");
        } finally {
            isLoading = false;
        }
    }

    async function handleDeleteChat() {
        isLoading = true;
        showStatus("Deleting chat...", 0);
        try {
            await deleteChatHistory(persona.id);
            showStatus("✅ Chat Deleted!");
            setTimeout(() => dispatch("close"), 1000);
        } catch (error) {
            console.error("Failed to delete chat:", error);
            showStatus("❌ Error!");
        } finally {
            isLoading = false;
            isConfirmingDelete = false;
        }
    }

    /* -------------------- Modal Closing Logic -------------------- */
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            dispatch("close");
        }
    }

    function handleBackdropClick(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            dispatch("close");
        }
    }

    // 모달이 닫힐 때 상태 초기화
    $: if (!isOpen) {
        isConfirmingDelete = false;
        statusMessage = "";
        user = null;
    } else {
        // 모달이 열릴 때 사용자 정보 로드
        (async () => {
            user = await getCurrentUser();
        })();
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="modal-backdrop"
        on:click={handleBackdropClick}
        transition:fade={{ duration: 200 }}
    >
        <div class="modal-content" transition:fly={{ y: -20, duration: 300 }}>
            <div class="modal-header">
                <h2>{$t("settingModal.title")}</h2>
                <button
                    class="close-button"
                    on:click={() => dispatch("close")}
                    aria-label="Close modal"
                >
                    <Icon icon="ph:x-bold" />
                </button>
            </div>

            <div class="settings-section">
                <span class="neuron-balance">
                    {$t("settingModal.neuronBalance")}
                    {user?.credits} ⚡️
                </span>

                <h3 class="section-title">
                    <Icon icon="ph:robot-duotone" />
                    <span>{$t("settingModal.llmTitle")}</span>
                </h3>

                <div class="select-wrapper">
                    <select
                        bind:value={selectedLLM}
                        on:change={handleLLMChange}
                        disabled={isLoading || mode === "3d"}
                    >
                        {#each availableLLMs as llm}
                            <option value={llm}
                                >{llm.name} - ⚡️{llm.cost}</option
                            >
                        {/each}
                    </select>
                    <div class="select-arrow">
                        <Icon icon="ph:caret-down-bold" />
                    </div>
                </div>
                {#if mode === "3d"}
                    <p class="model-locked-notice">
                        ⚠️ 3D/Live2D 모드는 Flash-Lite 모델만 사용 가능합니다.
                    </p>
                {:else}
                    <p class="section-description">
                        {$t("settingModal.llmDescription")}
                        <span class="cost-display">
                            {$t("settingModal.costDisplay")} ⚡️{selectedLLM.cost}
                            {$t("settingModal.neuronsConsumed")}
                        </span>
                    </p>
                {/if}
            </div>

            <div class="settings-section">
                <h3 class="section-title">
                    <Icon icon="ph:heart-duotone" />
                    <span>{$t("settingModal.feedbackTitle")}</span>
                </h3>
                <div class="button-grid">
                    <button
                        class="action-button"
                        class:liked={isLiked}
                        on:click={handleLikeToggle}
                        disabled={isLoading}
                    >
                        <Icon
                            icon={isLiked ? "ph:heart-fill" : "ph:heart-bold"}
                        />
                        <span
                            >{isLiked
                                ? $t("settingModal.liked")
                                : $t("settingModal.like")}</span
                        >
                    </button>
                    <button
                        class="action-button"
                        on:click={() => alert("Share feature coming soon!")}
                        disabled={isLoading}
                    >
                        <Icon icon="ph:share-network-bold" />
                        <span>{$t("settingModal.share")}</span>
                    </button>
                </div>
            </div>

            <div class="settings-section">
                <h3 class="section-title">
                    <Icon icon="ph:chats-duotone" />
                    <span>{$t("settingModal.chatManagement")}</span>
                </h3>
                <div class="button-grid">
                    {#if mode === "2d"}
                        <button
                            class="action-button"
                            on:click={() => (showImage = !showImage)}
                        >
                            <Icon
                                icon={showImage
                                    ? "ph:image-bold"
                                    : "ph:image-square-bold"}
                            />
                            <span
                                >{showImage
                                    ? $t("settingModal.hideImage") ||
                                      "Hide Image"
                                    : $t("settingModal.showImage") ||
                                      "Show Image"}</span
                            >
                            <div class="toggle-switch" class:on={showImage}>
                                <div class="toggle-knob"></div>
                            </div>
                        </button>
                    {/if}
                    <button
                        class="action-button"
                        on:click={handleResetChat}
                        disabled={isLoading}
                    >
                        <Icon icon="ph:arrow-counter-clockwise-bold" />
                        <span>{$t("settingModal.resetChat")}</span>
                    </button>
                    {#if !isConfirmingDelete}
                        <button
                            class="action-button destructive"
                            on:click={() => (isConfirmingDelete = true)}
                            disabled={isLoading}
                        >
                            <Icon icon="ph:trash-bold" />
                            <span>{$t("settingModal.deleteChat")}</span>
                        </button>
                    {:else}
                        <button
                            class="action-button confirm-delete"
                            on:click={handleDeleteChat}
                            disabled={isLoading}
                        >
                            <Icon icon="ph:warning-bold" />
                            <span>{$t("settingModal.confirmDelete")}</span>
                        </button>
                    {/if}
                </div>
            </div>

            <div class="modal-footer">
                <span class="status-text">{statusMessage}</span>
            </div>
        </div>
    </div>
{/if}

<style>
    .neuron-balance {
        display: block;
        margin: 4px auto 0;
        color: var(--primary-light);
        padding: 2px 6px;
        background-color: #333;
        border-radius: 4px;
    }

    :root {
        --modal-bg: #2a2a2a;
        --modal-border: #444;
        --text-primary: #e0e0e0;
        --text-secondary: #999;
        --primary-color: #3f51b5;
        --primary-hover: #303f9f;
        --destructive-color: #d32f2f;
        --destructive-hover: #b71c1c;
        --button-bg: #4a4a4a;
        --button-hover: #5e5e5e;
    }

    .modal-backdrop {
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    }

    .modal-content {
        background: var(--modal-bg);
        border-radius: 16px;
        padding: 24px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        position: relative;
        color: var(--text-primary);
        display: flex;
        flex-direction: column;
        gap: 16px;
        border: 1px solid var(--modal-border);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--modal-border);
    }

    .modal-header h2 {
        font-size: 1.5em;
        font-weight: 600;
        margin: 0;
    }

    .close-button {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 1.5rem;
        cursor: pointer;
        padding: 4px;
        border-radius: 50%;
        display: flex;
        transition: all 0.2s ease;
    }
    .close-button:hover {
        color: var(--text-primary);
        background-color: var(--button-bg);
        transform: rotate(90deg);
    }

    .settings-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.1em;
        font-weight: 500;
        color: var(--text-primary);
    }

    .section-description {
        font-size: 0.8em;
        color: var(--text-secondary);
        line-height: 1.5;
    }

    .model-locked-notice {
        font-size: 0.85em;
        color: #ffa726;
        background-color: rgba(255, 167, 38, 0.1);
        padding: 8px 12px;
        border-radius: 6px;
        border-left: 3px solid #ffa726;
        line-height: 1.5;
    }

    .select-wrapper {
        position: relative;
    }

    select {
        width: 100%;
        padding: 12px;
        background-color: #333;
        color: var(--text-primary);
        border: 1px solid var(--modal-border);
        border-radius: 8px;
        font-size: 1em;
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        cursor: pointer;
    }
    .select-arrow {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-secondary);
        pointer-events: none;
    }

    .button-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    .action-button {
        background-color: var(--button-bg);
        color: var(--text-primary);
        border: none;
        padding: 12px;
        border-radius: 8px;
        font-size: 0.95em;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
    }

    .action-button:hover:not(:disabled) {
        background-color: var(--button-hover);
        transform: translateY(-2px);
    }

    .action-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .action-button.liked {
        background-color: var(--primary-color);
        color: white;
    }
    .action-button.liked:hover:not(:disabled) {
        background-color: var(--primary-hover);
    }

    .action-button.destructive {
        color: var(--destructive-color);
        background-color: transparent;
        border: 1px solid var(--destructive-color);
    }
    .action-button.destructive:hover:not(:disabled) {
        background-color: var(--destructive-color);
        color: white;
    }

    .action-button.confirm-delete {
        grid-column: 1 / -1; /* 두 칸을 모두 차지 */
        background-color: var(--destructive-color);
        color: white;
    }
    .action-button.confirm-delete:hover:not(:disabled) {
        background-color: var(--destructive-hover);
    }

    .modal-footer {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--modal-border);
        text-align: center;
        min-height: 20px;
    }
    .toggle-switch {
        width: 36px;
        height: 20px;
        background-color: #555;
        border-radius: 10px;
        position: relative;
        transition: background-color 0.2s;
        margin-left: auto; /* Push to right */
    }
    .toggle-switch.on {
        background-color: var(--primary-light, #fff);
    }
    .toggle-knob {
        width: 16px;
        height: 16px;
        background-color: white;
        border-radius: 50%;
        position: absolute;
        top: 2px;
        left: 2px;
        transition: transform 0.2s;
    }
    .toggle-switch.on .toggle-knob {
        transform: translateX(16px);
        background-color: var(--primary-color);
    }

    .status-text {
        font-size: 0.9em;
        color: var(--text-secondary);
        transition: opacity 0.3s ease;
    }
</style>

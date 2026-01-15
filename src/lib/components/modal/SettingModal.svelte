<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import ReportModal from "$lib/components/modal/ReportModal.svelte";

    import { api } from "$lib/api";
    import type { Persona, User } from "$lib/types";
    import { deleteChatHistory, resetChatHistory } from "$lib/api/chat";
    import { loadlikesdata } from "$lib/api/content";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { get } from "svelte/store";
    import { chatSessions } from "$lib/stores/chatSessions";
    import { getCurrentUser } from "$lib/api/auth";
    import { toast } from "$lib/stores/toast";
    import { confirmStore } from "$lib/stores/confirm";
    import { pricingStore } from "$lib/stores/pricing";

    export let isOpen: boolean = false;
    export let persona: Persona;
    export let llmType: string = "Error";
    export let mode: "2d" | "3d" = "3d";
    export let showImage: boolean = true;

    const dispatch = createEventDispatcher();

    let isLoading = false;
    let isConfirmingDelete = false;
    let statusMessage = "";
    let showReportModal = false;

    let user: User | null = null;

    // ✅ declare explicitly (reactive assignment만으로는 타입/컴파일 이슈 나기 쉬움)
    let isLiked = false;

    // status timer cleanup
    let statusTimer: ReturnType<typeof setTimeout> | null = null;

    $: isLiked = persona?.is_liked || false;

    $: baseCost =
        mode === "3d"
            ? $pricingStore.costs.chat_3d
            : $pricingStore.costs.chat_2d;

    $: availableLLMs = [
        {
            id: "gemini-flash",
            name: $t("models.standard"),
            multiplier: $pricingStore.model_multipliers["gemini-flash"] || 1.5,
        },
        {
            id: "gemini-flash-lite",
            name: $t("models.light"),
            multiplier:
                $pricingStore.model_multipliers["gemini-flash-lite"] || 1.0,
        },
        {
            id: "gemini-pro",
            name: $t("models.premium"),
            multiplier: $pricingStore.model_multipliers["gemini-pro"] || 2.0,
        },
    ].map((llm) => ({
        ...llm,
        cost: Math.round((baseCost || 10) * llm.multiplier),
    }));

    let selectedLLM_id = llmType;

    // llmType prop이 바뀌면 select도 따라가게
    $: if (llmType && llmType !== selectedLLM_id) {
        selectedLLM_id = llmType;
    }

    $: selectedLLM =
        availableLLMs.find((llm) => llm.id === selectedLLM_id) ||
        availableLLMs[1];

    function changeLLMType(newType: string) {
        selectedLLM_id = newType;

        chatSessions.update((sessions) =>
            sessions.map((session) => {
                if (session.id === persona.id)
                    return { ...session, llmType: newType };
                return session;
            }),
        );

        const currentPage = get(page);
        const params = new URLSearchParams(currentPage.url.searchParams);
        params.set("llmType", newType);
        goto(`?${params.toString()}`, {
            replaceState: true,
            noScroll: true,
            keepFocus: true,
        });
    }

    onMount(async () => {
        try {
            const likes: string[] = await loadlikesdata();
            if (persona) persona.is_liked = likes.includes(persona.id);
        } catch (e) {
            console.error("Failed to load likes:", e);
        }
    });

    onDestroy(() => {
        if (statusTimer) clearTimeout(statusTimer);
    });

    async function showStatus(message: string, duration: number = 2000) {
        statusMessage = message;
        if (statusTimer) clearTimeout(statusTimer);
        if (duration > 0) {
            statusTimer = setTimeout(() => (statusMessage = ""), duration);
        }
    }

    async function handleLikeToggle() {
        if (!persona?.id) return;

        isLoading = true;
        const newLikeStatus = !isLiked;
        const endpoint = newLikeStatus ? "like" : "dislike";
        const url = `/api/persona/${endpoint}?id=${persona.id}`;

        try {
            const res = await api.get(url);
            if (!res.ok) throw new Error(await res.text());

            persona.is_liked = newLikeStatus;
            dispatch("like-updated", {
                personaId: persona.id,
                isLiked: newLikeStatus,
            });

            await showStatus(newLikeStatus ? "👍 Liked!" : "Like removed.");
        } catch (error) {
            console.error("Like toggle failed:", error);
            await showStatus("❌ Error!", 2000);
        } finally {
            isLoading = false;
        }
    }

    // ✅ await로 제대로 처리 (안 그러면 Saved가 먼저 뜨거나, 에러가 catch로 안 들어옴)
    async function handleLLMChange() {
        if (!persona?.id) return;

        isLoading = true;
        await showStatus("Saving...", 0);

        try {
            const res = await api.post(`/api/chat/char/sessions/edit`, {
                cssid: persona.id,
                llmType: selectedLLM_id,
            });

            if (!res.ok) throw new Error(await res.text());
            await res.json();

            changeLLMType(selectedLLM_id);
            await showStatus("✅ Saved!");
        } catch (error) {
            console.error("Failed to save LLM preference:", error);
            await showStatus("❌ Error!", 2000);
        } finally {
            isLoading = false;
        }
    }

    async function handleResetChat() {
        if (
            !(await confirmStore.ask($t("settingModal.confirmReset"), {
                type: "warning",
            }))
        )
            return;

        isLoading = true;
        await showStatus("Resetting chat...", 0);

        try {
            await resetChatHistory(persona.id);
            await showStatus("✅ Chat Reset!");
            setTimeout(() => dispatch("close"), 1000);
        } catch (error) {
            console.error("Failed to reset chat:", error);
            await showStatus("❌ Error!");
        } finally {
            isLoading = false;
        }
    }

    async function handleDeleteChat() {
        isLoading = true;
        await showStatus("Deleting chat...", 0);

        try {
            await deleteChatHistory(persona.id);
            await showStatus("✅ Chat Deleted!");
            setTimeout(() => dispatch("close"), 1000);
        } catch (error) {
            console.error("Failed to delete chat:", error);
            await showStatus("❌ Error!");
        } finally {
            isLoading = false;
            isConfirmingDelete = false;
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") dispatch("close");
    }

    function handleBackdropClick(event: MouseEvent) {
        if (event.target === event.currentTarget) dispatch("close");
    }

    // 모달이 닫힐 때 상태 초기화 + 열릴 때 사용자 로드
    $: if (!isOpen) {
        isConfirmingDelete = false;
        statusMessage = "";
        user = null;
    } else {
        (async () => {
            try {
                user = await getCurrentUser();
            } catch (e) {
                console.error("Failed to load user:", e);
            }
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
        transition:fade={{ duration: 160 }}
    >
        <div class="modal-content" transition:fly={{ y: -14, duration: 220 }}>
            <div class="modal-header">
                <div class="header-left">
                    <h2>{$t("settingModal.title")}</h2>
                    <span class="neuron-balance">
                        {$t("settingModal.neuronBalance")}
                        {user?.credits ?? 0} ⚡️
                    </span>
                </div>

                <button
                    class="icon-button"
                    on:click={() => dispatch("close")}
                    aria-label="Close modal"
                >
                    <Icon icon="ph:x-bold" />
                </button>
            </div>

            <!-- ✅ 2D일 때만 모델 선택 UI 렌더링 -->
            {#if mode === "2d"}
                <div class="settings-card">
                    <h3 class="section-title">
                        <Icon icon="ph:robot-duotone" />
                        <span>{$t("settingModal.llmTitle")}</span>
                    </h3>

                    <div class="select-wrapper">
                        <select
                            bind:value={selectedLLM_id}
                            on:change={handleLLMChange}
                            disabled={isLoading}
                            aria-label="Select model"
                        >
                            {#each availableLLMs as llm}
                                <option value={llm.id}>
                                    {llm.name} - ⚡️{llm.cost}
                                </option>
                            {/each}
                        </select>

                        <div class="select-arrow" aria-hidden="true">
                            <Icon icon="ph:caret-down-bold" />
                        </div>
                    </div>

                    <p class="section-description">
                        {$t("settingModal.llmDescription")}
                        <span class="chip">
                            {$t("settingModal.costDisplay")} ⚡️{selectedLLM.cost}
                            {$t("settingModal.neuronsConsumed")}
                        </span>
                    </p>
                </div>
            {/if}

            <!-- Feedback Section Removed -->

            <div class="settings-card">
                <h3 class="section-title">
                    <Icon icon="ph:chats-duotone" />
                    <span>{$t("settingModal.chatManagement")}</span>
                </h3>

                <div class="button-grid">
                    {#if mode === "2d"}
                        <button
                            class="btn"
                            on:click={() => (showImage = !showImage)}
                            disabled={isLoading}
                        >
                            <Icon
                                icon={showImage
                                    ? "ph:image-bold"
                                    : "ph:image-square-bold"}
                            />
                            <span>
                                {showImage
                                    ? $t("settingModal.hideImage") ||
                                      "Hide Image"
                                    : $t("settingModal.showImage") ||
                                      "Show Image"}
                            </span>

                            <span
                                class="toggle"
                                class:on={showImage}
                                aria-hidden="true"
                            >
                                <span class="knob"></span>
                            </span>
                        </button>
                    {/if}

                    <button
                        class="btn"
                        on:click={handleResetChat}
                        disabled={isLoading}
                    >
                        <Icon icon="ph:arrow-counter-clockwise-bold" />
                        <span>{$t("settingModal.resetChat")}</span>
                    </button>

                    {#if !isConfirmingDelete}
                        <button
                            class="btn btnDangerOutline"
                            on:click={() => (isConfirmingDelete = true)}
                            disabled={isLoading}
                        >
                            <Icon icon="ph:trash-bold" />
                            <span>{$t("settingModal.deleteChat")}</span>
                        </button>
                    {:else}
                        <button
                            class="btn btnDanger"
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
                {#if statusMessage}
                    <span class="status-chip">{statusMessage}</span>
                {:else}
                    <span class="footer-spacer"></span>
                {/if}
            </div>
        </div>
    </div>
{/if}

{#if showReportModal}
    <ReportModal
        personaId={persona.id}
        personaName={persona.name}
        on:close={() => (showReportModal = false)}
    />
{/if}

<style>
    /* ✅ 메인 테마 변수를 그대로 사용: var(--background), var(--card), var(--popover), var(--border) ... */
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: grid;
        place-items: center;
        z-index: 1000;
        backdrop-filter: blur(10px);
    }

    .modal-content {
        width: min(92vw, 420px);
        background: var(--popover);
        color: var(--foreground);
        border: 1px solid var(--border);
        border-radius: var(--radius-card, 16px);
        box-shadow: var(--shadow-popover);
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--border);
    }

    .header-left {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }

    .modal-header h2 {
        font-family: var(--font-display, "Cal Sans", sans-serif);
        font-size: 18px;
        font-weight: 600;
        margin: 0;
        line-height: 1.15;
        letter-spacing: 0.2px;
    }

    .neuron-balance {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        width: fit-content;
        padding: 5px 10px;
        border-radius: 999px;
        background: var(--card);
        border: 1px solid var(--border);
        box-shadow: var(--shadow-mini);
        color: var(--muted-foreground);
        font-size: 12px;
    }

    .icon-button {
        width: 36px;
        height: 36px;
        border-radius: var(--radius-button, 8px);
        border: 1px solid transparent;
        background: transparent;
        color: var(--muted-foreground);
        display: grid;
        place-items: center;
        cursor: pointer;
        transition:
            transform 150ms ease,
            background 150ms ease,
            border-color 150ms ease;
    }

    .icon-button:hover {
        background: var(--muted);
        border-color: var(--border);
        transform: rotate(6deg);
        color: var(--foreground);
    }

    .settings-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card, 16px);
        box-shadow: var(--shadow-card);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        margin: 0;
        color: var(--foreground);
    }

    .section-description {
        font-size: 12px;
        line-height: 1.55;
        color: var(--muted-foreground);
        margin: 0;
    }

    .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: 6px;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--muted);
        border: 1px solid var(--border);
        color: var(--foreground);
        white-space: nowrap;
    }

    .select-wrapper {
        position: relative;
    }

    select {
        width: 100%;
        padding: 10px 36px 10px 10px;
        border-radius: var(--radius-input, 10px);
        border: 1px solid var(--border);
        background: var(--background);
        color: var(--foreground);
        box-shadow: var(--shadow-mini);
        appearance: none;
        cursor: pointer;
    }

    .select-arrow {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--muted-foreground);
        pointer-events: none;
    }

    .button-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
    }

    @media (max-width: 360px) {
        .button-grid {
            grid-template-columns: 1fr;
        }
    }

    .btn {
        width: 100%;
        padding: 10px 10px;
        border-radius: var(--radius-button, 10px);
        border: 1px solid var(--border);
        background: var(--secondary);
        color: var(--secondary-foreground);
        box-shadow: var(--shadow-mini);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-weight: 600;
        transition:
            transform 150ms ease,
            filter 150ms ease,
            background 150ms ease;
    }

    .btn:hover:not(:disabled) {
        transform: translateY(-1px);
        filter: brightness(1.03);
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    /* liked state */
    /* .btnPrimary removed */

    /* .btnWarn removed */

    .btnDangerOutline {
        background: transparent;
        border-color: var(--destructive);
        color: var(--destructive);
    }

    .btnDanger {
        grid-column: 1 / -1;
        background: var(--destructive);
        color: var(--destructive-foreground);
        border-color: transparent;
    }

    .toggle {
        margin-left: auto;
        width: 36px;
        height: 20px;
        border-radius: 999px;
        background: var(--muted);
        border: 1px solid var(--border);
        position: relative;
        flex: none;
    }

    .toggle .knob {
        width: 16px;
        height: 16px;
        border-radius: 999px;
        background: var(--foreground);
        position: absolute;
        top: 50%;
        left: 2px;
        transform: translateY(-50%);
        transition:
            transform 150ms ease,
            background 150ms ease;
    }

    .toggle.on {
        background: color-mix(in oklab, var(--primary) 25%, var(--muted));
        border-color: color-mix(in oklab, var(--primary) 40%, var(--border));
    }

    .toggle.on .knob {
        transform: translate(16px, -50%);
        background: var(--primary-foreground);
    }

    .modal-footer {
        padding-top: 10px;
        border-top: 1px solid var(--border);
        display: flex;
        justify-content: center;
        min-height: 24px;
    }

    .status-chip {
        padding: 4px 10px;
        border-radius: 999px;
        background: var(--muted);
        border: 1px solid var(--border);
        color: var(--muted-foreground);
        font-size: 12px;
    }

    .footer-spacer {
        display: block;
        height: 1px;
        width: 1px;
        opacity: 0;
    }
</style>

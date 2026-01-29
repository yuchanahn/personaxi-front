<script lang="ts">
    import { fade, fly, slide } from "svelte/transition";
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import ReportModal from "$lib/components/modal/ReportModal.svelte";
    import { settings } from "$lib/stores/settings";

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
    import { messages } from "$lib/stores/messages";
    import { ttsState } from "$lib/stores/ttsStore";

    export let isOpen: boolean = false;
    export let persona: Persona;
    export let llmType: string = "Error";
    export let mode: "2d" | "3d" | "live2d" = "3d";
    export let showImage: boolean = true;
    export let autoScroll: boolean = true;
    export let showBackground: boolean = false;
    export let showChat: boolean = true;
    export let closeupScale: number = 1.0;
    export let closeupOffset: number = 0.0;
    export let isCloseup: boolean = false;
    export let impl_connectTTS: () => void | Promise<void> = () => {};
    export let impl_disconnectTTS: () => void | Promise<void> = () => {};
    export let impl_changeCamera: () => void | Promise<void> = () => {};

    const dispatch = createEventDispatcher();

    let isLoading = false;
    let isConfirmingDelete = false;
    let statusMessage = "";
    let showReportModal = false;

    let user: User | null = null;
    let isLiked = false;
    let statusTimer: ReturnType<typeof setTimeout> | null = null;

    // --- New Features State ---
    let userNote = "";
    let outputLength = 100; // Default UI value
    let showSessionImages = false;
    let sessionImages: string[] = [];
    let selectedImage: string | null = null; // Full Screen Viewer State

    $: isLiked = persona?.is_liked || false;

    // --- Session Images Logic ---
    $: {
        if (isOpen && $messages) {
            // Extract markdown images ![](url)
            const regex = /!\[.*?\]\((.*?)\)/g;
            const imgs: string[] = [];
            $messages.forEach((msg) => {
                let match;
                while ((match = regex.exec(msg.content)) !== null) {
                    imgs.push(match[1]);
                }
            });
            sessionImages = imgs;
        }
    }

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
    let prevLLMType = llmType;

    $: if (llmType && llmType !== prevLLMType) {
        selectedLLM_id = llmType;
        prevLLMType = llmType;
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

        console.log("LLM type changed to:", newType);
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
        //statusMessage = message;
        //if (statusTimer) clearTimeout(statusTimer);
        //if (duration > 0) {
        //    statusTimer = setTimeout(() => (statusMessage = ""), duration);
        //}
    }

    async function handleLLMChange() {
        if (!persona?.id) return;
        isLoading = true;
        await showStatus("Saving...", 0);
        try {
            const res = await api.post(`/api/chat/char/sessions/edit`, {
                cssid: persona.id,
                llmType: selectedLLM.id,
            });
            if (!res.ok) throw new Error(await res.text());
            await res.json();
            changeLLMType(selectedLLM.id);
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
        if (event.key === "Escape") {
            if (selectedImage) {
                selectedImage = null;
            } else {
                dispatch("close");
            }
        }
    }
    function handleBackdropClick(event: MouseEvent) {
        if (event.target === event.currentTarget) dispatch("close");
    }

    $: if (!isOpen) {
        isConfirmingDelete = false;
        statusMessage = "";
        user = null;
        showSessionImages = false;
        selectedImage = null;
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

            <div class="scroll-container">
                <!-- 1. LLM Model Selection -->
                {#if mode === "2d"}
                    <div class="settings-card">
                        <div class="card-header">
                            <Icon icon="ph:robot-duotone" />
                            <span>{$t("settingModal.llmTitle")}</span>
                        </div>
                        <div class="select-wrapper">
                            <select
                                bind:value={selectedLLM_id}
                                on:change={handleLLMChange}
                                disabled={isLoading}
                                aria-label="Select model"
                            >
                                {#each availableLLMs as llm (llm.id)}
                                    <option value={llm.id}
                                        >{llm.name}⚡️{llm.cost}</option
                                    >
                                {/each}
                            </select>
                            <div class="select-arrow" aria-hidden="true">
                                <Icon icon="ph:caret-down-bold" />
                            </div>
                        </div>
                        <p class="section-description">
                            {$t("settingModal.costDisplay")} ⚡️{selectedLLM.cost}
                        </p>
                    </div>
                {/if}

                <!-- 4. Session Images -->
                {#if mode === "2d"}
                    <div class="settings-card">
                        <div class="card-header">
                            <Icon icon="ph:image-duotone" />
                            <span>{$t("settingModal.sessionImages")}</span>
                            <span class="count-badge"
                                >{sessionImages.length}</span
                            >
                        </div>

                        {#if sessionImages.length > 0}
                            <button
                                class="view-images-btn"
                                on:click={() =>
                                    (showSessionImages = !showSessionImages)}
                            >
                                <span
                                    >{showSessionImages
                                        ? $t("settingModal.hideImages")
                                        : $t(
                                              "settingModal.viewAllImages",
                                          )}</span
                                >
                                <Icon
                                    icon={showSessionImages
                                        ? "ph:caret-up-bold"
                                        : "ph:caret-down-bold"}
                                />
                            </button>

                            {#if showSessionImages}
                                <div
                                    class="image-grid"
                                    transition:slide={{ duration: 200 }}
                                >
                                    {#each sessionImages as img}
                                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                                        <div
                                            class="grid-item"
                                            on:click={() =>
                                                (selectedImage = img)}
                                        >
                                            <img
                                                src={img}
                                                alt="Session Image"
                                                loading="lazy"
                                            />
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        {:else}
                            <div class="no-data">
                                {$t("settingModal.noImages")}
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- Autonomy Settings -->
                {#if mode === "3d" || mode === "live2d"}
                    <div class="settings-card">
                        <div class="card-header">
                            <Icon icon="ph:sparkle-duotone" />
                            <span>{$t("settingModal.autoInteraction")}</span>
                        </div>
                        <div class="actions-list">
                            <!-- Idle Toggle -->
                            <button
                                class="action-item"
                                on:click={() =>
                                    ($settings.enableIdleTrigger =
                                        !$settings.enableIdleTrigger)}
                            >
                                <div class="action-left">
                                    <Icon icon="ph:timer-bold" />
                                    <span>{$t("settingModal.autoIdle")}</span>
                                </div>
                                <span
                                    class="toggle"
                                    class:on={$settings.enableIdleTrigger}
                                    ><span class="knob"></span></span
                                >
                            </button>

                            <!-- Interaction Toggle -->
                            <button
                                class="action-item"
                                on:click={() =>
                                    ($settings.enableInteractionTrigger =
                                        !$settings.enableInteractionTrigger)}
                            >
                                <div class="action-left">
                                    <Icon icon="ph:hand-pointing-bold" />
                                    <span>{$t("settingModal.autoTouch")}</span>
                                </div>
                                <span
                                    class="toggle"
                                    class:on={$settings.enableInteractionTrigger}
                                    ><span class="knob"></span></span
                                >
                            </button>
                        </div>
                    </div>
                {/if}

                <!-- 5. Chat Settings -->

                <div class="settings-card">
                    <div class="card-header">
                        <Icon icon="ph:gear-duotone" />
                        <span>{$t("settingModal.chatManagement")}</span>
                    </div>

                    <div class="actions-list">
                        <!-- Show/Hide Chat (3D/Live2D Only) -->
                        {#if mode === "3d" || mode === "live2d"}
                            <button
                                class="action-item"
                                on:click={() => (showChat = !showChat)}
                            >
                                <div class="action-left">
                                    <Icon
                                        icon={showChat
                                            ? "ph:chat-circle-dots-bold"
                                            : "ph:chat-circle-slash-bold"}
                                    />
                                    <span
                                        >{$t(
                                            "settingModal.showChatWindow",
                                        )}</span
                                    >
                                </div>
                                <span class="toggle" class:on={showChat}
                                    ><span class="knob"></span></span
                                >
                            </button>
                        {/if}

                        <!-- TTS Control (3D/Live2D Only) -->
                        {#if mode === "3d" || mode === "live2d"}
                            <button
                                class="action-item"
                                on:click={() => {
                                    if ($ttsState === "connected") {
                                        impl_disconnectTTS();
                                    } else {
                                        impl_connectTTS();
                                    }
                                }}
                                disabled={isLoading ||
                                    $ttsState === "connecting"}
                            >
                                <div class="action-left">
                                    <span
                                        class:spinning={$ttsState ===
                                            "connecting"}
                                    >
                                        <Icon
                                            icon={$ttsState === "connected"
                                                ? "ph:speaker-high-bold"
                                                : $ttsState === "connecting"
                                                  ? "ph:spinner-gap-bold"
                                                  : "ph:speaker-slash-bold"}
                                        />
                                    </span>
                                    <span>
                                        {$ttsState === "connected"
                                            ? $t("settingModal.ttsConnected")
                                            : $ttsState === "connecting"
                                              ? $t("settingModal.ttsConnecting")
                                              : $t("settingModal.enableTTS")}
                                    </span>
                                </div>
                                <span
                                    class="toggle"
                                    class:on={$ttsState === "connected"}
                                    ><span class="knob"></span></span
                                >
                            </button>
                        {/if}

                        <!-- Camera Toggle (3D/Live2D Only) -->
                        <!-- Camera Toggle (3D/Live2D Only) -->
                        {#if mode === "3d" || mode === "live2d"}
                            <button
                                class="action-item"
                                on:click={() => {
                                    isCloseup = !isCloseup;
                                }}
                            >
                                <div class="action-left">
                                    <Icon icon="ph:camera-bold" />
                                    <span>{$t("settingModal.closeupMode")}</span
                                    >
                                </div>
                                <span class="toggle" class:on={isCloseup}
                                    ><span class="knob"></span></span
                                >
                            </button>

                            <!-- Closeup Settings Sliders -->
                            {#if isCloseup}
                                <div class="slider-group" transition:slide>
                                    <div class="slider-item">
                                        <label class="slider-label"
                                            >{$t(
                                                "settingModal.closeupZoom",
                                            )}</label
                                        >
                                        <div class="range-wrapper">
                                            <input
                                                type="range"
                                                class="range-input"
                                                min="0.5"
                                                max="3.0"
                                                step="0.1"
                                                bind:value={closeupScale}
                                            />
                                            <span class="value-badge"
                                                >{closeupScale.toFixed(
                                                    1,
                                                )}x</span
                                            >
                                        </div>
                                    </div>
                                    <div class="slider-item">
                                        <label class="slider-label"
                                            >{$t(
                                                "settingModal.closeupPosition",
                                            )}</label
                                        >
                                        <div class="range-wrapper">
                                            <input
                                                type="range"
                                                class="range-input"
                                                min="-0.5"
                                                max="0.5"
                                                step="0.05"
                                                bind:value={closeupOffset}
                                            />
                                            <span class="value-badge"
                                                >{closeupOffset.toFixed(
                                                    2,
                                                )}</span
                                            >
                                        </div>
                                    </div>
                                </div>
                            {/if}
                        {/if}

                        <!-- 자동스크롤 -->
                        <button
                            class="action-item"
                            on:click={() => (
                                (autoScroll = !autoScroll),
                                console.log(autoScroll)
                            )}
                        >
                            <div class="action-left">
                                <Icon
                                    icon={autoScroll
                                        ? "ph:check-bold"
                                        : "ph:check-bold"}
                                />
                                <span>{$t("settingModal.autoScroll")}</span>
                            </div>
                            <span class="toggle" class:on={autoScroll}
                                ><span class="knob"></span></span
                            >
                        </button>
                    </div>

                    <div class="actions-list">
                        {#if mode === "2d"}
                            <button
                                class="action-item"
                                on:click={() => {
                                    showBackground = !showBackground;
                                    console.log(
                                        "Modal toggled bg:",
                                        showBackground,
                                    );
                                }}
                                disabled={isLoading}
                            >
                                <div class="action-left">
                                    <Icon
                                        icon={showBackground
                                            ? "ph:monitor-play-bold"
                                            : "ph:monitor-bold"}
                                    />
                                    <span
                                        >{$t(
                                            "settingModal.showBackground",
                                        )}</span
                                    >
                                </div>
                                <span class="toggle" class:on={showBackground}
                                    ><span class="knob"></span></span
                                >
                            </button>

                            <button
                                class="action-item"
                                on:click={() => (showImage = !showImage)}
                                disabled={isLoading || showBackground}
                            >
                                <div class="action-left">
                                    <Icon
                                        icon={showImage
                                            ? "ph:image-square-bold"
                                            : "ph:image-bold"}
                                    />
                                    <span
                                        >{showImage
                                            ? $t(
                                                  "settingModal.hideGeneratedImages",
                                              )
                                            : $t(
                                                  "settingModal.showGeneratedImages",
                                              )}</span
                                    >
                                </div>
                                <span class="toggle" class:on={showImage}
                                    ><span class="knob"></span></span
                                >
                            </button>
                        {/if}
                        <button
                            class="action-item"
                            on:click={handleResetChat}
                            disabled={isLoading}
                        >
                            <div class="action-left">
                                <Icon icon="ph:arrow-counter-clockwise-bold" />
                                <span>{$t("settingModal.resetChat")}</span>
                            </div>
                            <Icon
                                icon="ph:caret-right-bold"
                                class="action-arrow"
                            />
                        </button>

                        {#if !isConfirmingDelete}
                            <button
                                class="action-item destructive"
                                on:click={() => (isConfirmingDelete = true)}
                                disabled={isLoading}
                            >
                                <div class="action-left">
                                    <Icon icon="ph:trash-bold" />
                                    <span>{$t("settingModal.deleteChat")}</span>
                                </div>
                                <Icon
                                    icon="ph:caret-right-bold"
                                    class="action-arrow"
                                />
                            </button>
                        {:else}
                            <button
                                class="action-item destructive confirm"
                                on:click={handleDeleteChat}
                                disabled={isLoading}
                            >
                                <div class="action-left">
                                    <Icon icon="ph:warning-bold" />
                                    <span
                                        >{$t(
                                            "settingModal.confirmDelete",
                                        )}</span
                                    >
                                </div>
                            </button>
                        {/if}
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                {#if statusMessage}
                    <span class="status-chip">{statusMessage}</span>
                {/if}
            </div>
        </div>
    </div>
{/if}

<!-- Full Screen Image Viewer -->
{#if selectedImage}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fullscreen-overlay"
        on:click={() => (selectedImage = null)}
        transition:fade={{ duration: 200 }}
    >
        <button
            class="close-fullscreen-btn"
            aria-label="Close full screen"
            on:click|stopPropagation={() => (selectedImage = null)}
        >
            <Icon icon="ph:x-bold" />
        </button>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <img src={selectedImage} alt="Full Screen" on:click|stopPropagation />
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
        width: min(92vw, 400px);
        max-height: 85vh;
        background: var(--popover);
        color: var(--foreground);
        border: 1px solid var(--border);
        border-radius: var(--radius-card, 16px);
        box-shadow: var(--shadow-popover);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid var(--border);
        background: var(--card);
    }
    .header-left h2 {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 4px 0;
    }
    .neuron-balance {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--muted-foreground);
    }
    .icon-button {
        width: 32px;
        height: 32px;
        background: transparent;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        display: grid;
        place-items: center;
        border-radius: 50%;
    }
    .icon-button:hover {
        background: var(--muted);
        color: var(--foreground);
    }

    .scroll-container {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .settings-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        color: var(--foreground);
    }
    .section-description {
        font-size: 12px;
        color: var(--muted-foreground);
        margin: 0;
    }

    /* Inputs */
    .select-wrapper {
        position: relative;
    }
    select {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--background);
        color: var(--foreground);
        appearance: none;
    }
    .select-arrow {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        color: var(--muted-foreground);
    }

    .memo-area {
        width: 100%;
        padding: 8px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--background);
        color: var(--foreground);
        resize: vertical;
        font-size: 13px;
        min-height: 60px;
    }

    .range-wrapper {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 12px;
        color: var(--muted-foreground);
    }
    .range-input {
        flex: 1;
        accent-color: var(--primary);
    }
    .value-badge {
        margin-left: auto;
        font-size: 11px;
        background: var(--muted);
        padding: 2px 6px;
        border-radius: 4px;
        color: var(--foreground);
    }

    /* Image Grid & Full Screen */
    .count-badge {
        margin-left: auto;
        font-size: 11px;
        background: var(--primary);
        color: var(--primary-foreground);
        padding: 2px 8px;
        border-radius: 999px;
    }
    .view-images-btn {
        width: 100%;
        padding: 8px;
        background: var(--muted);
        border: none;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        color: var(--foreground);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }
    .image-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 4px;
    }
    .grid-item {
        aspect-ratio: 1;
        border-radius: 8px;
        overflow: hidden;
        background: var(--background);
        cursor: pointer;
        position: relative;
    }
    .grid-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.2s;
    }
    .grid-item:hover img {
        transform: scale(1.05); /* Zoom effect on hover */
    }
    .no-data {
        font-size: 12px;
        color: var(--muted-foreground);
        text-align: center;
        padding: 8px;
    }

    .fullscreen-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.9);
        z-index: 2000; /* Higher than modal */
        display: grid;
        place-items: center;
        padding: 20px;
        cursor: zoom-out;
    }
    .fullscreen-overlay img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        cursor: default;
    }
    .close-fullscreen-btn {
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        font-size: 24px;
        display: grid;
        place-items: center;
        cursor: pointer;
        transition: background 0.2s;
        z-index: 2001;
    }
    .close-fullscreen-btn:hover {
        background: rgba(255, 255, 255, 0.4);
    }

    /* Action List */
    .actions-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .action-item {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        color: var(--foreground);
        font-size: 13px;
        transition: background 0.2s;
    }
    .action-item:hover:not(:disabled) {
        background: var(--muted);
    }
    .action-left {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .action-arrow {
        color: var(--muted-foreground);
        font-size: 12px;
    }
    .action-item.destructive {
        color: var(--destructive);
    }
    .action-item.destructive:hover {
        background: rgba(239, 68, 68, 0.1); /* example red tint */
    }
    .action-item.confirm {
        background: var(--destructive);
        color: var(--destructive-foreground);
        justify-content: center;
    }

    /* Toggle */
    .toggle {
        width: 32px;
        height: 18px;
        border-radius: 999px;
        background: var(--border);
        position: relative;
        transition: background 0.2s;
    }
    .toggle .knob {
        position: absolute;
        width: 14px;
        height: 14px;
        background: white;
        border-radius: 50%;
        top: 2px;
        left: 2px;
        transition: transform 0.2s;
    }
    .toggle.on {
        background: var(--primary);
    }
    .toggle.on .knob {
        transform: translateX(14px);
    }

    .modal-footer {
        padding: 12px;
        border-top: 1px solid var(--border);
        text-align: center;
        background: var(--card);
    }
    .status-chip {
        font-size: 11px;
        color: var(--muted-foreground);
    }
    .spinning {
        animation: spin 1s linear infinite;
        display: inline-flex;
    }
    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    /* Sliders */
    .slider-group {
        width: 100%;
        padding: 0 4px;
        margin-top: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
    }

    .slider-item {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .slider-label {
        font-size: 0.8rem;
        color: var(--muted-foreground);
        font-weight: 500;
        margin-left: 2px;
    }

    .range-wrapper {
        display: flex;
        align-items: center;
        gap: 0.8rem;
    }

    .range-input {
        flex: 1;
        height: 4px;
        appearance: none;
        background: var(--border);
        border-radius: 2px;
        outline: none;
    }

    .range-input::-webkit-slider-thumb {
        appearance: none;
        width: 14px;
        height: 14px;
        background: var(--primary);
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.2s;
    }

    .range-input::-webkit-slider-thumb:hover {
        transform: scale(1.2);
    }

    .value-badge {
        font-size: 11px;
        background: var(--muted);
        padding: 2px 6px;
        border-radius: 4px;
        color: var(--foreground);
        min-width: 3rem;
        text-align: center;
    }
</style>

<script lang="ts">
    import { fade, fly, slide } from "svelte/transition";
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import NeuronIcon from "$lib/components/icons/NeuronIcon.svelte";
    import ReportModal from "$lib/components/modal/ReportModal.svelte";
    import { settings } from "$lib/stores/settings";

    import { api } from "$lib/api";
    import type { Persona, User, UserPersona } from "$lib/types";
    import { deleteChatHistory, resetChatHistory } from "$lib/api/chat";
    import { loadlikesdata } from "$lib/api/content";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { get } from "svelte/store";
    import {
        chatSessions,
        getDefaultDialogueRenderStyle,
        setSessionDialogueRenderStyle,
        type DialogueRenderStyle,
    } from "$lib/stores/chatSessions";
    import { getCurrentUser } from "$lib/api/auth";
    import { st_user } from "$lib/stores/user";
    import { toast } from "$lib/stores/toast";
    import { confirmStore } from "$lib/stores/confirm";
    import { pricingStore } from "$lib/stores/pricing";
    import { messages } from "$lib/stores/messages";
    import { ttsState } from "$lib/stores/ttsStore";
    import { hideBackButton } from "$lib/utils/LayoutUtils";

    export let isOpen: boolean = false;
    export let persona: Persona;
    export let llmType: string = "Error";
    export let outputTokenMultiplier: number = 1;
    export let mode: "2d" | "3d" | "live2d" = "3d";
    export let showImage: boolean = true;
    export let autoScroll: boolean = true;
    export let showBackground: boolean = false;
    export let showVariableStatus: boolean = false;
    export let showChat: boolean = true;
    export let closeupScale: number = 1.0;
    export let closeupOffset: number = 0.0;
    export let isCloseup: boolean = false;
    export let impl_connectTTS: () => void | Promise<void> = () => {};
    export let impl_disconnectTTS: () => void | Promise<void> = () => {};
    export let impl_changeCamera: () => void | Promise<void> = () => {};

    const dispatch = createEventDispatcher();
    const normalizeVisibleLLMType = (value: string) => {
        switch (value) {
            case "antigravity":
                return "gemini-pro";
            case "gemini-flash-lite":
            case "gemini-flash":
            case "gemini-pro":
                return value;
            default:
                return "gemini-flash-lite";
        }
    };
    const currentSessionId = () =>
        get(page).url.searchParams.get("c") || persona?.id || "";

    let isLoading = false;
    let isSavingNote = false;
    let isConfirmingDelete = false;
    let statusMessage = "";
    let showReportModal = false;

    let user: User | null = null;
    let userPersonas: UserPersona[] = [];
    let selectedUserPersonaId = "";
    let isLoadingUserPersonas = false;
    let isLiked = false;
    let statusTimer: ReturnType<typeof setTimeout> | null = null;

    // --- New Features State ---
    let userNote = "";
    let showUserNote = false;
    let outputLength = 100; // Default UI value
    let selectedOutputTokenMultiplier = outputTokenMultiplier;
    let selectedDialogueRenderStyle: DialogueRenderStyle =
        getDefaultDialogueRenderStyle();
    let showSessionImages = false;
    let sessionImages: string[] = [];
    let selectedImage: string | null = null; // Full Screen Viewer State
    let openQuickSettings = false;
    let openDisplaySettings = false;
    let openSessionReference = false;
    let openSessionManagement = false;
    let modalLoadKey = "";

    $: isLiked = persona?.is_liked || false;
    $: selectedUserPersonaLabel =
        userPersonas.find((p) => p.id === selectedUserPersonaId)?.name ||
        $t("settingModal.userPersonaNoItems");
    $: quickSettingsSummary =
        mode === "2d"
            ? `${selectedLLM?.name || "-"} · ${selectedOutputTokenMultiplier}x · ${selectedUserPersonaLabel || "-"}`
            : "";
    $: selectedDialogueRenderStyleLabel =
        selectedDialogueRenderStyle === "inline-yellow"
            ? $t("settingModal.dialogueRenderStyleInlineYellow")
            : $t("settingModal.dialogueRenderStyleBubble");
    $: displaySettingsSummary =
        mode === "2d"
            ? [
                  selectedDialogueRenderStyleLabel,
                  autoScroll ? $t("settingModal.autoScroll") : null,
                  showBackground ? $t("settingModal.showBackground") : null,
                  showImage
                      ? $t("settingModal.showGeneratedImages")
                      : $t("settingModal.hideGeneratedImages"),
                  showVariableStatus
                      ? $t("settingModal.showVariableStatus")
                      : $t("settingModal.hideVariableStatus"),
              ]
                  .filter(Boolean)
                  .join(" · ")
            : "";
    $: sessionReferenceSummary =
        mode === "2d"
            ? $t("settingModal.sessionReferenceSummary", {
                  values: {
                      note: $t(
                          userNote?.trim()
                              ? "settingModal.noteExists"
                              : "settingModal.noteEmpty",
                      ),
                      count: sessionImages.length,
                  },
              })
            : "";

    function toggleSection(section: "quick" | "display" | "reference" | "management") {
        if (section === "quick") openQuickSettings = !openQuickSettings;
        if (section === "display") openDisplaySettings = !openDisplaySettings;
        if (section === "reference") openSessionReference = !openSessionReference;
        if (section === "management") openSessionManagement = !openSessionManagement;
    }

    // --- Session Images Logic ---
    $: {
        if (isOpen && $messages) {
            hideBackButton.hide();
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

    let selectedLLM_id: string = normalizeVisibleLLMType(llmType);
    let prevLLMType = llmType;

    $: if (llmType && llmType !== prevLLMType) {
        selectedLLM_id = normalizeVisibleLLMType(llmType);
        prevLLMType = llmType;
    }

    $: selectedLLM =
        availableLLMs.find((llm) => llm.id === selectedLLM_id) ||
        availableLLMs[1];
    $: selectedOutputTokenMultiplier = Math.min(
        3,
        Math.max(1, Number(selectedOutputTokenMultiplier) || 1),
    );
    $: maxCostWithOutputMultiplier =
        selectedLLM.cost * selectedOutputTokenMultiplier;

    function changeLLMType(newType: string) {
        const cssid = currentSessionId();
        selectedLLM_id = newType;
        chatSessions.update((sessions) =>
            sessions.map((session) => {
                if (session.id === cssid)
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
        console.log("mode:", mode);
    });

    onDestroy(() => {
        if (statusTimer) clearTimeout(statusTimer);
        hideBackButton.show();
    });

    async function showStatus(message: string, duration: number = 2000) {
        //statusMessage = message;
        //if (statusTimer) clearTimeout(statusTimer);
        //if (duration > 0) {
        //    statusTimer = setTimeout(() => (statusMessage = ""), duration);
        //}
    }

    async function loadUserPersonas() {
        if (mode !== "2d") return;
        isLoadingUserPersonas = true;
        try {
            const res = await api.get(`/api/user/personas`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            userPersonas = Array.isArray(data?.personas) ? data.personas : [];

            st_user.update((current) =>
                current
                    ? {
                          ...current,
                          data: {
                              ...current.data,
                              userPersonas,
                          },
                      }
                    : current,
            );

            if (!selectedUserPersonaId && userPersonas.length > 0) {
                selectedUserPersonaId =
                    userPersonas.find((p) => p.isDefault)?.id ||
                    userPersonas[0].id;
            }
        } catch (error) {
            console.error("Failed to load user personas:", error);
            userPersonas = [];
        } finally {
            isLoadingUserPersonas = false;
        }
    }

    async function initializeModalData() {
        user = get(st_user);

        if (!user) {
            try {
                user = await getCurrentUser();
            } catch (e) {
                console.error("Failed to load user:", e);
            }
        }

        const storedUserPersonas = user?.data?.userPersonas;
        userPersonas = Array.isArray(storedUserPersonas) ? storedUserPersonas : [];

        if (mode === "2d" && userPersonas.length === 0) {
            await loadUserPersonas();
        }

        if (persona && persona.is_liked === undefined && user) {
            try {
                const likes: string[] = await loadlikesdata();
                persona.is_liked = likes.includes(persona.id);
            } catch (e) {
                console.error("Failed to load likes:", e);
            }
        }
    }

    async function handleLLMChange() {
        const cssid = currentSessionId();
        if (!cssid) return;
        isLoading = true;
        await showStatus("Saving...", 0);
        try {
            const res = await api.post(`/api/chat/char/sessions/edit`, {
                cssid,
                llmType: selectedLLM.id,
                outputTokenMultiplier: selectedOutputTokenMultiplier,
                userPersonaId: selectedUserPersonaId || "",
            });
            if (!res.ok) throw new Error(await res.text());
            await res.json();
            chatSessions.update((sessions) => {
                const existingIndex = sessions.findIndex(
                    (s) => s.id === cssid,
                );
                if (existingIndex !== -1) {
                    sessions[existingIndex].llmType = selectedLLM.id;
                    sessions[existingIndex].outputTokenMultiplier =
                        selectedOutputTokenMultiplier;
                    sessions[existingIndex].userPersonaId =
                        selectedUserPersonaId || "";
                    return [...sessions];
                } else {
                    return [
                        ...sessions,
                        {
                            id: cssid,
                            name: persona.name,
                            createdAt: new Date().toISOString(),
                            type: persona.personaType || "2D",
                            avatar: persona.portrait_url,
                            llmType: selectedLLM.id,
                            outputTokenMultiplier:
                                selectedOutputTokenMultiplier,
                            userPersonaId: selectedUserPersonaId || "",
                            userNote: userNote,
                        } as any,
                    ];
                }
            });
            changeLLMType(selectedLLM.id);
            await showStatus("✅ Saved!");
        } catch (error) {
            console.error("Failed to save LLM preference:", error);
            await showStatus("❌ Error!", 2000);
        } finally {
            isLoading = false;
        }
    }

    function applyDialogueRenderStyle(style: DialogueRenderStyle) {
        selectedDialogueRenderStyle = style;
        const cssid = currentSessionId();
        if (!cssid) return;
        setSessionDialogueRenderStyle(cssid, style);
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
            dispatch("close");
            await deleteChatHistory(persona.id);
        } catch (error) {
            console.error("Failed to delete chat:", error);
            await showStatus("❌ Error!");
        } finally {
            isLoading = false;
            isConfirmingDelete = false;
        }
    }

    async function handleSaveNote() {
        if (!persona?.id) return;
        isSavingNote = true;
        await showStatus("Saving...", 0);
        try {
            const res = await api.post(`/api/chat/char/sessions/note`, {
                cssid: persona.id,
                userNote: userNote,
            });
            if (!res.ok) throw new Error(await res.text());

            chatSessions.update((sessions) => {
                const existingIndex = sessions.findIndex(
                    (s) => s.id === persona.id,
                );
                if (existingIndex !== -1) {
                    sessions[existingIndex].userNote = userNote;
                    return [...sessions];
                } else {
                    return [
                        ...sessions,
                        {
                            id: persona.id,
                            name: persona.name,
                            createdAt: new Date().toISOString(),
                            type: persona.personaType || "2D",
                            avatar: persona.portrait_url,
                            llmType: selectedLLM.id,
                            outputTokenMultiplier:
                                selectedOutputTokenMultiplier,
                            userPersonaId: selectedUserPersonaId || "",
                            userNote: userNote,
                        } as any,
                    ];
                }
            });

            await showStatus("✅ Saved!");
        } catch (error) {
            console.error("Failed to save user note:", error);
            await showStatus("❌ Error!", 2000);
        } finally {
            isSavingNote = false;
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
        userPersonas = [];
        showSessionImages = false;
        selectedImage = null;
        modalLoadKey = "";
    } else {
        const session = $chatSessions.find((s) => s.id === persona.id);
        userNote = session?.userNote || "";
        selectedUserPersonaId = session?.userPersonaId || "";
        selectedOutputTokenMultiplier = Math.min(
            3,
            Math.max(
                1,
                session?.outputTokenMultiplier || outputTokenMultiplier || 1,
            ),
        );
        selectedDialogueRenderStyle =
            session?.dialogueRenderStyle || getDefaultDialogueRenderStyle();
    }

    $: {
        const nextModalLoadKey = isOpen ? `${mode}:${persona?.id || ""}` : "";
        if (nextModalLoadKey && nextModalLoadKey !== modalLoadKey) {
            modalLoadKey = nextModalLoadKey;
            void initializeModalData();
        }
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
                        {user?.credits ?? 0}
                        <NeuronIcon size={14} />
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
                {#if mode === "2d"}
                    <div class="settings-section">
                        <button
                            class="section-toggle"
                            class:open={openQuickSettings}
                            on:click={() => toggleSection("quick")}
                        >
                            <div class="section-toggle-copy">
                                <span class="section-toggle-title"
                                    >{$t(
                                        "settingModal.quickSettingsSectionTitle",
                                    )}</span
                                >
                                <span class="section-toggle-summary">{quickSettingsSummary}</span>
                            </div>
                            <Icon
                                icon={openQuickSettings
                                    ? "ph:caret-up-bold"
                                    : "ph:caret-down-bold"}
                            />
                        </button>
                        {#if openQuickSettings}
                            <div class="section-panel" transition:slide={{ duration: 180 }}>
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
                                        >{llm.name} ({llm.cost}N)</option
                                    >
                                {/each}
                            </select>
                            <div class="select-arrow" aria-hidden="true">
                                <Icon icon="ph:caret-down-bold" />
                            </div>
                        </div>
                        <p class="section-description">
                            {$t("settingModal.costDisplay")}
                            <NeuronIcon size={14} />{selectedLLM.cost}
                        </p>
                        <div class="select-wrapper">
                            <select
                                bind:value={selectedOutputTokenMultiplier}
                                on:change={handleLLMChange}
                                disabled={isLoading}
                                aria-label="Select output token multiplier"
                            >
                                <option value={1}>
                                    {$t(
                                        "settingModal.outputTokenMultiplier1x",
                                    )}
                                </option>
                                <option value={2}>
                                    {$t(
                                        "settingModal.outputTokenMultiplier2x",
                                    )}
                                </option>
                                <option value={3}>
                                    {$t(
                                        "settingModal.outputTokenMultiplier3x",
                                    )}
                                </option>
                            </select>
                            <div class="select-arrow" aria-hidden="true">
                                <Icon icon="ph:caret-down-bold" />
                            </div>
                        </div>
                        <p class="section-description">
                            {$t("settingModal.maxCostDisplay")}
                            <NeuronIcon size={14} />{maxCostWithOutputMultiplier}
                        </p>
                        <p class="section-description">
                            {$t("settingModal.outputTokenMultiplierRule")}
                        </p>
                    </div>
                {/if}

                {#if mode === "2d"}
                    <div class="settings-card">
                        <div class="card-header">
                            <Icon icon="ph:user-circle-duotone" />
                            <span>{$t("settingModal.userPersonaTitle")}</span>
                        </div>
                        <div class="select-wrapper">
                            <select
                                bind:value={selectedUserPersonaId}
                                on:change={handleLLMChange}
                                disabled={isLoading || isLoadingUserPersonas}
                                aria-label={$t("settingModal.userPersonaTitle")}
                            >
                                {#if userPersonas.length === 0}
                                    <option value="">
                                        {isLoadingUserPersonas
                                            ? $t("common.loading")
                                            : $t(
                                                  "settingModal.userPersonaNoItems",
                                              )}
                                    </option>
                                {:else}
                                    {#each userPersonas as p (p.id)}
                                        <option value={p.id}>
                                            {p.name}
                                            {p.isDefault
                                                ? ` (${$t("common.default")})`
                                                : ""}
                                        </option>
                                    {/each}
                                {/if}
                            </select>
                            <div class="select-arrow" aria-hidden="true">
                                <Icon icon="ph:caret-down-bold" />
                            </div>
                        </div>
                        <p class="section-description">
                            {$t("settingModal.userPersonaDescription")}
                        </p>
                    </div>
                {/if}
                            </div>
                        {/if}
                    </div>

                    <div class="settings-section">
                        <button
                            class="section-toggle"
                            class:open={openSessionReference}
                            on:click={() => toggleSection("reference")}
                        >
                            <div class="section-toggle-copy">
                                <span class="section-toggle-title"
                                    >{$t(
                                        "settingModal.sessionReferenceSectionTitle",
                                    )}</span
                                >
                                <span class="section-toggle-summary">{sessionReferenceSummary}</span>
                            </div>
                            <Icon
                                icon={openSessionReference
                                    ? "ph:caret-up-bold"
                                    : "ph:caret-down-bold"}
                            />
                        </button>
                        {#if openSessionReference}
                            <div class="section-panel" transition:slide={{ duration: 180 }}>

                <!-- 2. User Note -->
                {#if mode === "2d"}
                    <div class="settings-card">
                        <div class="card-header">
                            <Icon icon="ph:notepad-bold" />
                            <span>{$t("settingModal.userNote")}</span>
                        </div>
                        <button
                            class="view-images-btn"
                            on:click={() => (showUserNote = !showUserNote)}
                        >
                            <span
                                >{showUserNote
                                    ? $t("common.hide")
                                    : $t("common.show")}</span
                            >
                            <Icon
                                icon={showUserNote
                                    ? "ph:caret-up-bold"
                                    : "ph:caret-down-bold"}
                            />
                        </button>
                        {#if showUserNote}
                            <div
                                class="note-wrapper"
                                transition:slide={{ duration: 200 }}
                            >
                                <textarea
                                    bind:value={userNote}
                                    placeholder={$t(
                                        "settingModal.userNotePlaceholder",
                                    )}
                                    disabled={isLoading || isSavingNote}
                                    rows="3"
                                    class="user-note-textarea"
                                ></textarea>
                                <button
                                    class="action-item"
                                    on:click={handleSaveNote}
                                    disabled={isLoading || isSavingNote}
                                >
                                    <div class="action-left">
                                        <Icon icon="ph:floppy-disk-bold" />
                                        <span
                                            >{$t("settingModal.saveNote")}</span
                                        >
                                    </div>
                                </button>
                            </div>
                        {/if}
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
                            </div>
                        {/if}
                    </div>

                    <div class="settings-section">
                        <button
                            class="section-toggle"
                            class:open={openDisplaySettings}
                            on:click={() => toggleSection("display")}
                        >
                            <div class="section-toggle-copy">
                                <span class="section-toggle-title"
                                    >{$t(
                                        "settingModal.displaySettingsSectionTitle",
                                    )}</span
                                >
                                <span class="section-toggle-summary">{displaySettingsSummary}</span>
                            </div>
                            <Icon
                                icon={openDisplaySettings
                                    ? "ph:caret-up-bold"
                                    : "ph:caret-down-bold"}
                            />
                        </button>
                        {#if openDisplaySettings}
                            <div class="section-panel" transition:slide={{ duration: 180 }}>
                                <div class="settings-card">
                                    <div class="card-header">
                                        <Icon icon="ph:paint-brush-household-duotone" />
                                        <span>{$t("settingModal.chatViewTitle")}</span>
                                    </div>
                                    <div class="actions-list">
                                        <button
                                            class="action-item"
                                            on:click={() => (
                                                (autoScroll = !autoScroll),
                                                console.log(autoScroll)
                                            )}
                                        >
                                            <div class="action-left">
                                                <Icon icon="ph:check-bold" />
                                                <span>{$t("settingModal.autoScroll")}</span>
                                            </div>
                                            <span class="toggle" class:on={autoScroll}
                                                ><span class="knob"></span></span
                                            >
                                        </button>

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
                                                <span>{$t("settingModal.showBackground")}</span>
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

                                        <button
                                            class="action-item"
                                            on:click={() =>
                                                (showVariableStatus = !showVariableStatus)}
                                            disabled={isLoading}
                                        >
                                            <div class="action-left">
                                                <Icon
                                                    icon={showVariableStatus
                                                        ? "ph:code-bold"
                                                        : "ph:code-slash-bold"}
                                                />
                                                <span
                                                    >{showVariableStatus
                                                        ? $t(
                                                              "settingModal.hideVariableStatus",
                                                          )
                                                        : $t(
                                                              "settingModal.showVariableStatus",
                                                          )}
                                                </span>
                                            </div>
                                            <span class="toggle" class:on={showVariableStatus}
                                                ><span class="knob"></span></span
                                            >
                                        </button>
                                    </div>
                                </div>

                                {#if mode === "2d"}
                                    <div class="settings-card">
                                        <div class="card-header">
                                            <Icon icon="ph:chat-text-duotone" />
                                            <span
                                                >{$t(
                                                    "settingModal.dialogueRenderStyleTitle",
                                                )}</span
                                            >
                                        </div>
                                        <p class="section-description">
                                            {$t(
                                                "settingModal.dialogueRenderStyleDescription",
                                            )}
                                        </p>
                                        <div class="dialogue-style-grid">
                                            <button
                                                type="button"
                                                class="dialogue-style-card"
                                                class:active={selectedDialogueRenderStyle ===
                                                    "bubble"}
                                                on:click={() =>
                                                    applyDialogueRenderStyle(
                                                        "bubble",
                                                    )}
                                            >
                                                <div class="dialogue-style-card-label">
                                                    {$t(
                                                        "settingModal.dialogueRenderStyleBubble",
                                                    )}
                                                </div>
                                                <div class="dialogue-style-preview dialogue-style-preview--bubble">
                                                    <div class="preview-speaker">
                                                        {persona?.name ||
                                                            "Character"}
                                                    </div>
                                                    <div class="preview-bubble">
                                                        {$t(
                                                            "settingModal.dialogueRenderStylePreviewLine",
                                                        )}
                                                    </div>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                class="dialogue-style-card"
                                                class:active={selectedDialogueRenderStyle ===
                                                    "inline-yellow"}
                                                on:click={() =>
                                                    applyDialogueRenderStyle(
                                                        "inline-yellow",
                                                    )}
                                            >
                                                <div class="dialogue-style-card-label">
                                                    {$t(
                                                        "settingModal.dialogueRenderStyleInlineYellow",
                                                    )}
                                                </div>
                                                <div class="dialogue-style-preview dialogue-style-preview--inline-yellow">
                                                    <span class="preview-inline-name"
                                                        >{persona?.name ||
                                                            "Character"}</span
                                                    >
                                                    <span class="preview-inline-sep">
                                                        |
                                                    </span>
                                                    <span class="preview-inline-text">
                                                        {$t(
                                                            "settingModal.dialogueRenderStylePreviewLine",
                                                        )}
                                                    </span>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>

                    <div class="settings-section">
                        <button
                            class="section-toggle"
                            class:open={openSessionManagement}
                            on:click={() => toggleSection("management")}
                        >
                            <div class="section-toggle-copy">
                                <span class="section-toggle-title"
                                    >{$t(
                                        "settingModal.sessionManagementSectionTitle",
                                    )}</span
                                >
                                <span class="section-toggle-summary"
                                    >{$t(
                                        "settingModal.sessionManagementSectionSummary",
                                    )}</span
                                >
                            </div>
                            <Icon
                                icon={openSessionManagement
                                    ? "ph:caret-up-bold"
                                    : "ph:caret-down-bold"}
                            />
                        </button>
                        {#if openSessionManagement}
                            <div class="section-panel" transition:slide={{ duration: 180 }}>
                                <div class="settings-card">
                                    <div class="card-header">
                                        <Icon icon="ph:warning-circle-duotone" />
                                        <span>{$t("settingModal.chatManagement")}</span>
                                    </div>
                                    <div class="actions-list">
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
                                                    <span>{$t("settingModal.confirmDelete")}</span>
                                                </div>
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- Autonomy Settings -->
                {#if mode === "live2d"}
                    <div class="settings-card">
                        <div class="card-header">
                            <Icon icon="ph:sparkle-duotone" />
                            <span>{$t("settingModal.autoInteraction")}</span>
                        </div>
                        <div class="actions-list">
                            <!-- Idle Toggle -->
                            <!-- <button
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
                            </button> -->

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

                {#if mode !== "2d"}
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
                {/if}
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

    .settings-section {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .section-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--card);
        color: var(--foreground);
        cursor: pointer;
        transition:
            border-color 0.2s ease,
            background 0.2s ease;
    }

    .section-toggle:hover {
        border-color: var(--primary);
    }

    .section-toggle.open {
        border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
        background: color-mix(in srgb, var(--card) 92%, var(--primary) 8%);
    }

    .section-toggle-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
    }

    .section-toggle-title {
        font-size: 14px;
        font-weight: 700;
        color: var(--foreground);
    }

    .section-toggle-summary {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        color: var(--muted-foreground);
    }

    .section-panel {
        display: flex;
        flex-direction: column;
        gap: 10px;
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

    .dialogue-style-grid {
        display: grid;
        gap: 10px;
    }

    .dialogue-style-card {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--background);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        text-align: left;
        color: var(--foreground);
        cursor: pointer;
        transition:
            border-color 0.18s ease,
            background 0.18s ease,
            transform 0.18s ease;
    }

    .dialogue-style-card:hover {
        border-color: color-mix(in srgb, var(--primary) 48%, var(--border));
        transform: translateY(-1px);
    }

    .dialogue-style-card.active {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--background) 92%, var(--primary) 8%);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 35%, transparent);
    }

    .dialogue-style-card-label {
        font-size: 13px;
        font-weight: 700;
    }

    .dialogue-style-preview {
        min-width: 0;
    }

    .dialogue-style-preview--bubble {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
    }

    .preview-speaker {
        font-size: 12px;
        font-weight: 700;
        color: var(--muted-foreground);
    }

    .preview-bubble {
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--secondary);
        color: var(--secondary-foreground);
        border: 1px solid var(--border);
        line-height: 1.55;
    }

    .dialogue-style-preview--inline-yellow {
        color: #facc15;
        font-size: 14px;
        line-height: 1.6;
        word-break: break-word;
    }

    .preview-inline-name {
        font-weight: 800;
        color: #fde68a;
    }

    .preview-inline-sep {
        margin: 0 0.2rem;
        color: #facc15;
    }

    .preview-inline-text {
        color: #facc15;
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
        display: flex;
        align-items: center;
        gap: 4px;
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

    @media (max-width: 640px) {
        .section-toggle {
            padding: 11px 12px;
        }

        .section-toggle-summary {
            white-space: normal;
            line-height: 1.45;
        }
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

    /* User Note */
    .user-note-textarea {
        width: 100%;
        background: var(--background);
        color: var(--foreground);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px;
        font-family: inherit;
        font-size: 14px;
        resize: vertical;
        min-height: 80px;
        margin-bottom: 8px;
    }
    .user-note-textarea:focus {
        outline: 1px solid var(--primary);
        border-color: var(--primary);
    }
    .note-wrapper {
        padding: 0 16px 16px 16px;
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

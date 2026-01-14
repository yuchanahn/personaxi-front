<script lang="ts">
    import { t } from "svelte-i18n";
    import { createEventDispatcher, onMount } from "svelte";
    import Icon from "@iconify/svelte";
    import { fade, fly } from "svelte/transition";
    import { pricingStore } from "$lib/stores/pricing";

    export let isOpen = false;
    export let selectedModel = "gemini-flash-lite";

    const dispatch = createEventDispatcher();

    // Available models (matching SettingModal.svelte) with renamed "Modes"
    $: models = [
        {
            id: "gemini-flash-lite",
            name: $t("models.light"),
            description: "Fast, efficient, and cost-effective.",
            icon: "ph:lightning-fill",
            color: "#fbbf24",
        },
        {
            id: "gemini-flash",
            name: $t("models.standard"),
            description: "Balanced performance.",
            icon: "ph:lightning-bold",
            color: "#a855f7",
        },
        {
            id: "gemini-pro",
            name: $t("models.premium"),
            description: "High reasoning capability.",
            icon: "ph:brain-fill",
            color: "#60a5fa",
        },
    ];

    function selectModel(id: string) {
        selectedModel = id;
        dispatch("select", id);
        // We don't close immediately here, user clicks "Start Chat" or we can Auto-close?
        // User said: "Default is flash lite selected, user chooses to change or close".
        // Let's assume clicking a model just updates selection, "Start" confirms.
    }

    function confirm() {
        dispatch("confirm", selectedModel);
        isOpen = false;
    }

    function close() {
        dispatch("close");
        isOpen = false;
    }

    // Get cost display
    $: getCost = (id: string) => {
        const base = $pricingStore.costs.chat_2d || 5;
        const mult = $pricingStore.model_multipliers[id] || 1.0;
        return Math.round(base * mult);
    };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="backdrop"
        transition:fade={{ duration: 200 }}
        on:click|self={close}
    >
        <div class="drawer" transition:fly={{ y: 300, duration: 300 }}>
            <div class="drawer-header">
                <h3>{$t("models.title")}</h3>
                <button class="close-btn" on:click={close}>
                    <Icon icon="ph:x" width="20" />
                </button>
            </div>

            <div class="models-list">
                {#each models as model}
                    <button
                        class="model-item"
                        class:selected={selectedModel === model.id}
                        on:click={() => selectModel(model.id)}
                    >
                        <div
                            class="icon-wrapper"
                            style="background: {model.color}20; color: {model.color};"
                        >
                            <Icon icon={model.icon} width="24" />
                        </div>
                        <div class="info">
                            <div class="top-row">
                                <span class="name">{model.name}</span>
                                {#if selectedModel === model.id}
                                    <Icon
                                        icon="ph:check-circle-fill"
                                        class="check-icon"
                                    />
                                {/if}
                            </div>
                            <span class="desc">{model.description}</span>
                        </div>
                        <div class="cost">
                            <span class="neurons">{getCost(model.id)}</span>
                            <span class="unit">neurons</span>
                        </div>
                    </button>
                {/each}
            </div>

            <div class="footer">
                <button class="confirm-btn" on:click={confirm}>
                    Start Chat with {models.find((m) => m.id === selectedModel)
                        ?.name}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .backdrop {
        position: fixed;
        inset: 0;
        z-index: 2000;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
    }

    .drawer {
        background: #1e1e24; /* Dark theme bg */
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px 20px 0 0;
        padding: 1.5rem;
        padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
        width: 100%;
        max-width: 600px;
        margin: 0 auto; /* Center on desktop if needed */
        box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
    }

    .drawer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .drawer-header h3 {
        font-size: 1.25rem;
        font-weight: 700;
        color: #fff;
        margin: 0;
    }

    .close-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: #fff;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        cursor: pointer;
    }

    .models-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
    }

    .model-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 1rem;
        border-radius: 12px;
        text-align: left;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .model-item:hover {
        background: rgba(255, 255, 255, 0.06);
    }

    .model-item.selected {
        background: rgba(255, 255, 255, 0.08);
        border-color: var(--primary, #fbbf24); /* Fallback or variable */
        box-shadow: 0 0 0 1px var(--primary, #fbbf24);
    }

    .icon-wrapper {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: grid;
        place-items: center;
    }

    .info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .top-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .name {
        font-weight: 600;
        color: #fff;
    }

    .check-icon {
        color: var(--primary, #fbbf24);
    }

    .desc {
        font-size: 0.8rem;
        color: #9ca3af;
    }

    .cost {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }

    .neurons {
        font-weight: 700;
        color: #fff;
    }

    .unit {
        font-size: 0.7rem;
        color: #6b7280;
    }

    .footer {
        display: flex;
    }

    .confirm-btn {
        flex: 1;
        background: var(--primary, #fbbf24);
        color: #000;
        border: none;
        padding: 1rem;
        border-radius: 12px;
        font-weight: 700;
        font-size: 1rem;
        cursor: pointer;
        transition: transform 0.1s;
    }

    .confirm-btn:active {
        transform: scale(0.98);
    }
</style>

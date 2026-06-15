<script lang="ts">
    import { t } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import Icon from "@iconify/svelte";
    import { fade, fly } from "svelte/transition";
    import { pricingStore } from "$lib/stores/pricing";
    import NeuronIcon from "$lib/components/icons/NeuronIcon.svelte";
    import { st_user } from "$lib/stores/user";
    import {
        DEFAULT_2D_LLM_TYPE,
        normalizeVisibleLLMType,
    } from "$lib/utils/llmType";

    import { onMount } from "svelte";
    import { api } from "$lib/api";

    export let isOpen = false;
    export let selectedModel: string = DEFAULT_2D_LLM_TYPE;

    const dispatch = createEventDispatcher();

    const legacyModels = [
        {
            id: "gemini-flash-lite",
            name: $t("models.fast"),
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

    $: dynamicModels = $pricingStore.available_models || [];
    $: models = $pricingStore.billing_mode === "token" ? dynamicModels : legacyModels;

    $: selectedModel = $pricingStore.billing_mode === "token" 
        ? selectedModel 
        : normalizeVisibleLLMType(selectedModel, DEFAULT_2D_LLM_TYPE);

    function selectModel(id: string) {
        if ($pricingStore.billing_mode === "token") {
            selectedModel = id;
            dispatch("select", id);
        } else {
            const normalized = normalizeVisibleLLMType(id, DEFAULT_2D_LLM_TYPE);
            selectedModel = normalized;
            dispatch("select", normalized);
        }
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
        const base = $pricingStore.costs.chat_2d || 5000000;
        const fallbackMultiplier = id.includes("flash") ? 1.5 : id.includes("pro") ? 2.0 : 1.0;
        const mult = $pricingStore.model_multipliers[id] || fallbackMultiplier;
        return Math.round(base * mult);
    };

    $: getTokenCostInfo = (id: string) => {
        const model = dynamicModels.find(m => m.id === id);
        if (model) {
            return {
                input_cost_per_1k: model.input_cost_per_1k,
                output_cost_per_1k: model.output_cost_per_1k
            };
        }
        return $pricingStore.token_pricing?.[id] || {
            input_cost_per_1k: 2000000,
            output_cost_per_1k: 6000000,
        };
    };

    let isLocalhost = false;
    onMount(() => {
        isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    });

    let isToggling = false;
    async function toggleBillingMode() {
        if (isToggling) return;
        isToggling = true;
        try {
            const res = await api.post("/api/policy/dev-toggle-billing-mode", {});
            if (res.ok) {
                await pricingStore.fetchPricingPolicy();
            }
        } catch (err) {
            console.error("Failed to toggle billing mode:", err);
        } finally {
            isToggling = false;
        }
    }

    $: currentBalance = Math.max(0, Number($st_user?.credits || 0)) / 1000000;
    $: selectedCost = $pricingStore.billing_mode === "token" ? 10 : (getCost(selectedModel) / 1000000);
    $: hasEnoughBalance = Math.max(0, Number($st_user?.credits || 0)) >= ($pricingStore.billing_mode === "token" ? 10000000 : getCost(selectedModel));
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

            <div class="balance-inline">
                <span class="balance-inline-item">
                    {$t("models.balance")}
                    <strong>{currentBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}</strong>
                </span>
                <span class="balance-divider">·</span>
                <span class="balance-inline-item">
                    {#if $pricingStore.billing_mode === 'token'}
                        {$t("models.preDeductCost", { default: "Pre-deduct" })}
                        <strong class:cost-danger={!hasEnoughBalance}>- 10</strong>
                    {:else}
                        {$t("models.estimatedCost")}
                        <strong class:cost-danger={!hasEnoughBalance}>- {selectedCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}</strong>
                    {/if}
                </span>
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
                        <div class="cost" style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.15rem;">
                            {#if $pricingStore.billing_mode === 'token'}
                                {@const tok = getTokenCostInfo(model.id)}
                                <span class="neurons" style="font-size: 0.82rem; white-space: nowrap;">
                                    In: {(tok.input_cost_per_1k / 1000000).toLocaleString(undefined, { maximumFractionDigits: 4 })}🔋 / Out: {(tok.output_cost_per_1k / 1000000).toLocaleString(undefined, { maximumFractionDigits: 4 })}🔋
                                </span>
                                <span style="font-size: 0.65rem; color: #9ca3af; white-space: nowrap;">(per 1K tokens)</span>
                            {:else}
                                <span class="neurons">
                                    {(getCost(model.id) / 1000000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                    <NeuronIcon size={12} color="currentColor" />
                                </span>
                            {/if}
                        </div>
                    </button>
                {/each}
            </div>

            {#if isLocalhost}
                <div class="dev-panel" style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(239, 68, 68, 0.1); border: 1px dashed rgba(239, 68, 68, 0.3); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.8rem; color: #fca5a5;">DEV ONLY Billing Mode: <strong>{$pricingStore.billing_mode}</strong></span>
                    <button 
                        style="background: #ef4444; color: white; border: none; padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer;"
                        on:click={toggleBillingMode}
                        disabled={isToggling}
                    >
                        {isToggling ? "Toggling..." : "Toggle Mode"}
                    </button>
                </div>
            {/if}

            <div class="footer">
                <button class="confirm-btn" on:click={confirm}>
                    Start Chat with {models.find((m) => m.id === selectedModel)?.name || "Selected Model"}
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

    .balance-inline {
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: rgba(255, 255, 255, 0.72);
        font-size: 0.9rem;
        line-height: 1.4;
    }

    .balance-inline-item {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        min-width: 0;
    }

    .balance-inline-item strong {
        color: #fff;
        font-size: 0.96rem;
        font-weight: 700;
    }

    .balance-divider {
        color: rgba(255, 255, 255, 0.28);
    }

    .cost-danger {
        color: #fca5a5;
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
        display: flex;
        align-items: center;
        gap: 0.25rem;
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

    @media (max-width: 520px) {
        .balance-inline {
            flex-wrap: wrap;
        }
    }
</style>

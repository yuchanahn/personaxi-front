<script lang="ts">
    import { goto } from "$app/navigation";
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import NeuronIcon from "../icons/NeuronIcon.svelte";
    import { get } from "svelte/store";
    import { st_user } from "$lib/stores/user";
    // import { toast } from "$lib/stores/toast";
    import { pricingStore } from "$lib/stores/pricing";
    import { fly, fade } from "svelte/transition";

    // 부모 컴포넌트로부터 모달 가시성 상태를 양방향으로 바인딩합니다.
    export let isOpen: boolean = false;
    export let isNeedNeurons: boolean = false;

    const dispatch = createEventDispatcher();

    // Escape 키 누르면 모달 닫기
    function handleKeydown(event: KeyboardEvent) {
        if (isOpen && event.key === "Escape") {
            closeModal();
        }
    }

    function closeModal() {
        isOpen = false;
        dispatch("close");
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);
    });
    onDestroy(() => {
        window.removeEventListener("keydown", handleKeydown);
    });

    import { api } from "$lib/api"; // Assuming api client exists
    // import { notificationStore } from "$lib/stores/notification";

    let isPurchasing = false;
    let purchaseSuccess = false;
    let purchasedAmount = 0;

    // Selection State
    let selectedOptionId: string | null = null;
    let selectedOption: any = null;
    let agreedToPolicies = false;

    // Auto-select best value or default
    // $: if ($pricingStore.purchase_options.length > 0 && !selectedOptionId) {
    //     // Default to the middle option
    //     const defaultIndex = $pricingStore.purchase_options.length > 1 ? 1 : 0;
    //     const opt = $pricingStore.purchase_options[defaultIndex];
    //     selectOption(opt);
    // }

    function selectOption(option: any) {
        selectedOptionId = option.id;
        selectedOption = option;
    }

    function handleRecharge() {
        if (!selectedOption) return;

        isPurchasing = true;

        // TEMPORARY: Use the provided Test URL for all options for now
        let checkoutUrl =
            "https://personaxi.lemonsqueezy.com/checkout/buy/37030093-8078-4bd9-bc76-9711cbac1f3e?embed=1";

        // Append user ID
        const userValue = get(st_user);
        if (userValue) {
            checkoutUrl += `&checkout[custom][user_id]=${userValue.id}`;
        }

        // Try to initialize if missing
        // @ts-ignore
        if (!window.LemonSqueezy && window.createLemonSqueezy) {
            // @ts-ignore
            window.createLemonSqueezy();
        }

        // Open via Lemon.js (if loaded) or fallback to new window
        // @ts-ignore
        if (window.LemonSqueezy) {
            // @ts-ignore
            window.LemonSqueezy.Url.Open(checkoutUrl);
        } else {
            console.warn("Lemon.js not ready, opening in new tab");
            // Fallback if script didn't load for some reason
            window.open(checkoutUrl, "_blank");
        }

        closeModal();
        isPurchasing = false;
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);

        pricingStore.fetchPricingPolicy();

        // Ensure Lemon.js is loaded
        if (!document.getElementById("lemon-js")) {
            const script = document.createElement("script");
            script.id = "lemon-js";
            script.src = "https://assets.lemonsqueezy.com/lemon.js";
            script.defer = true;
            script.onload = () => {
                // @ts-ignore
                if (window.createLemonSqueezy) {
                    // @ts-ignore
                    window.createLemonSqueezy();
                }
            };
            document.body.appendChild(script);
        } else {
            // If already loaded, ensure it's initialized
            // @ts-ignore
            if (window.createLemonSqueezy && !window.LemonSqueezy) {
                // @ts-ignore
                window.createLemonSqueezy();
            }
        }
    });

    let current_neurons_count: number = 0;
    $: current_neurons_count = $st_user?.credits || 0;

    let isFrist = get(st_user)?.data.hasReceivedFirstCreationReward;

    // --- Helper Functions from Shop Page ---
    function getProductIconProps(index: number) {
        const variants: ("simple" | "standard" | "double")[] = [
            "simple",
            "standard",
            "double",
        ];
        const sizes = [28, 32, 36, 40];
        const i = Math.min(index, variants.length - 1);

        return {
            variant: variants[i],
            size: sizes[i],
            color: "#525252", // Default color
        };
    }

    function getBonusPercentage(option: any) {
        if (option.bonus_amount && option.bonus_amount > 0) {
            return Math.round((option.bonus_amount / option.neurons) * 100);
        }
        return 0;
    }

    function getStandardPrice(totalNeurons: number) {
        // baseline: 1 neuron = 10 KRW
        return totalNeurons * 10;
    }
</script>

{#if isOpen}
    <!-- Backdrop with Fade -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="modal-backdrop"
        on:click|self={closeModal}
        transition:fade={{ duration: 200 }}
    >
        <!-- Modal Content with Slide Up (Fly) -->
        <div class="modal-content" transition:fly={{ y: 300, duration: 300 }}>
            <!-- Header -->
            <div class="modal-header">
                <h2>
                    {#if isNeedNeurons}
                        {$t("needNeuronsModal.title")}
                    {:else}
                        {$t("needNeuronsModal.rechargeTitle")}
                    {/if}
                </h2>
                <button class="close-button" on:click={closeModal}>
                    <Icon icon="ph:x-bold" width="20" height="20" />
                </button>
            </div>

            <!-- Description -->
            <p class="description">
                {#if isNeedNeurons}
                    {$t("needNeuronsModal.description")}
                {:else}
                    {$t("needNeuronsModal.rechargeDescription")}
                {/if}
            </p>

            <!-- Scrollable Content -->
            <div class="modal-body">
                <!-- Promo Box -->
                {#if isFrist}
                    <div class="promo-box">
                        <div class="promo-content">
                            <Icon
                                icon="ph:gift-bold"
                                width="24"
                                class="text-gold"
                            />
                            <span
                                >{$t(
                                    "needNeuronsModal.firstCreationReward",
                                )}</span
                            >
                        </div>
                        <button
                            class="promo-action-btn"
                            on:click={() => {
                                closeModal();
                                goto("/edit");
                            }}
                        >
                            {$t("needNeuronsModal.getFreeNeurons")}
                            <Icon icon="ph:arrow-right-bold" />
                        </button>
                    </div>
                {/if}

                <!-- Pricing Options List -->
                <div class="pricing-list">
                    {#each $pricingStore.purchase_options as option, i}
                        {@const isSelected = selectedOption === option}
                        {@const iconProps = getProductIconProps(i)}
                        {@const bonusPercent = getBonusPercentage(option)}
                        <!-- Calculate Standard Price based on total amount (neurons + bonus) -->
                        {@const totalNeurons =
                            option.neurons + (option.bonus_amount || 0)}
                        {@const standardPrice = getStandardPrice(totalNeurons)}

                        <button
                            class="pricing-row"
                            class:selected={isSelected}
                            on:click={() => selectOption(option)}
                        >
                            <!-- Left: Icon & Info -->
                            <div class="row-left">
                                <div
                                    class="icon-wrapper"
                                    class:active={isSelected}
                                >
                                    <NeuronIcon
                                        size={iconProps.size}
                                        variant={iconProps.variant}
                                        color={isSelected
                                            ? "#fbbf24"
                                            : "#525252"}
                                    />
                                </div>
                                <div class="info-wrapper">
                                    <div class="neurons-count">
                                        {option.neurons.toLocaleString()}
                                        <span class="unit">N</span>
                                    </div>
                                    {#if option.bonus_amount && option.bonus_amount > 0}
                                        <span class="bonus-pill">
                                            +{Math.floor(
                                                option.bonus_amount,
                                            ).toLocaleString()}
                                            {$t("shop.bonus_label")}
                                        </span>
                                    {/if}
                                </div>
                            </div>

                            <!-- Right: Price & Badge -->
                            <div class="row-right">
                                <!-- Best Value Badge (Example Logic: highest bonus or index > 1) -->
                                {#if bonusPercent >= 20}
                                    <span class="best-badge"
                                        >{$t("shop.best_value")}</span
                                    >
                                {/if}

                                <div class="price-container">
                                    <!-- Discount Logic matching shop page -->
                                    {#if option.price_krw < standardPrice}
                                        <span class="old-price">
                                            {standardPrice.toLocaleString()}₩
                                        </span>
                                    {/if}
                                    <span
                                        class="current-price"
                                        class:highlight={isSelected}
                                    >
                                        {option.price_display}
                                    </span>
                                </div>
                            </div>
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Footer: Purchase Button -->
            <div class="modal-footer">
                <!-- Policy Agreement Checkbox -->
                <div class="policy-agreement">
                    <label class="checkbox-label">
                        <input
                            type="checkbox"
                            bind:checked={agreedToPolicies}
                        />
                        <span class="checkbox-custom">
                            {#if agreedToPolicies}
                                <Icon
                                    icon="material-symbols:check-small-rounded"
                                    width="16"
                                />
                            {/if}
                        </span>
                        <span class="agreement-text">
                            <a href="/terms" target="_blank"
                                >{$t("legal.termsOfService")}</a
                            >
                            ·
                            <a href="/privacy" target="_blank"
                                >{$t("legal.privacyPolicy")}</a
                            >
                            ·
                            <a href="/terms" target="_blank"
                                >{$t("legal.refundPolicy")}</a
                            >
                            {$t("legal.agreedToPolicies")}
                        </span>
                    </label>
                </div>

                <div class="current-balance">
                    <span>{$t("shop.current_neurons")}</span>
                    <strong>{current_neurons_count.toLocaleString()} N</strong>
                </div>
                <button
                    class="purchase-btn"
                    disabled={isPurchasing ||
                        !selectedOption ||
                        !agreedToPolicies}
                    on:click={handleRecharge}
                >
                    {#if isPurchasing}
                        <span class="spinner"></span>
                    {:else if selectedOption}
                        {$t("shop.purchase_button", {
                            values: {
                                price: selectedOption.price_display,
                            },
                        })}
                    {:else}
                        {$t("shop.select_option")}
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    /* Dark Theme Variables */
    :global(body) {
        --modal-bg: #171717;
        --modal-border: #262626;
        --text-main: #ededed;
        --text-muted: #a3a3a3;
        --accent-gold: #fbbf24;
        --accent-blue: #3b82f6;
        --accent-blue-hover: #2563eb;
    }

    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: flex-end; /* Align bottom for mobile sheet */
        padding-bottom: calc(
            70px + env(safe-area-inset-bottom)
        ); /* Lift up for navbar */
        z-index: 2000;
        backdrop-filter: blur(8px);
    }

    .modal-content {
        background-color: #171717;
        border-top-left-radius: 24px;
        border-top-right-radius: 24px;
        width: 100%;
        max-width: 500px;
        max-height: 85vh; /* Allow it to be tall but not full screen */
        box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        border: 1px solid #262626;
        border-bottom: none;
        overflow: hidden;
    }

    /* Desktop: Center Modal */
    @media (min-width: 768px) {
        .modal-backdrop {
            align-items: center;
            padding-bottom: 0; /* Reset padding for desktop */
        }
        .modal-content {
            border-radius: 24px;
            border-bottom: 1px solid #262626;
            max-height: 80vh;
        }
    }

    .modal-header {
        padding: 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #262626;
    }

    .modal-header h2 {
        font-size: 1.25rem;
        font-weight: 700;
        color: #ededed;
        margin: 0;
    }

    .close-button {
        background: #262626;
        border: none;
        color: #a3a3a3;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
    }

    .close-button:hover {
        background: #404040;
        color: #fff;
    }

    .description {
        padding: 0 24px;
        margin: 16px 0 0;
        color: #a3a3a3;
        font-size: 0.9rem;
        line-height: 1.5;
    }

    .modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
    }

    /* Promo Box */
    .promo-box {
        background: rgba(251, 191, 36, 0.1); /* Gold tint */
        border: 1px solid rgba(251, 191, 36, 0.2);
        border-radius: 12px;
        padding: 12px 16px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .promo-content {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #fbbf24;
        font-weight: 600;
        font-size: 0.9rem;
    }

    .promo-action-btn {
        background: none;
        border: none;
        color: #fbbf24;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    /* Pricing List */
    .pricing-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    /* Fixed: Removed default borders to prevent "everything highlighted" look */
    .pricing-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #262626;
        border: 1px solid transparent; /* Default transparent */
        border-color: transparent !important; /* Force transparent */
        border-radius: 16px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
        width: 100%;
        text-align: left;
    }

    @media (max-width: 768px) {
        .pricing-row {
            padding: 12px;
        }
        .pricing-list {
            gap: 5px;
        }
    }

    .pricing-row:hover {
        background: #333;
    }

    /* Selection State */
    .pricing-row.selected {
        background: rgba(251, 191, 36, 0.05); /* Subtle Gold Tint */
        border-color: #fbbf24 !important; /* Visible border ONLY when selected */
        box-shadow: 0 0 0 1px #fbbf24; /* Focus ring */
    }

    .row-left {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .icon-wrapper {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: #171717;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s;
    }

    .icon-wrapper.active {
        box-shadow: 0 0 15px rgba(251, 191, 36, 0.2);
    }

    .info-wrapper {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .neurons-count {
        font-size: 1.1rem;
        font-weight: 700;
        color: #ededed;
    }

    .neurons-count .unit {
        font-size: 0.8rem;
        font-weight: 400;
        color: #737373;
    }

    .bonus-pill {
        font-size: 0.75rem;
        color: #fbbf24;
        font-weight: 600;
        background: rgba(251, 191, 36, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        width: fit-content;
    }

    .row-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
    }

    .best-badge {
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: #000;
        font-size: 0.65rem;
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 800;
    }

    .price-container {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }

    .old-price {
        font-size: 0.75rem;
        color: #525252;
        text-decoration: line-through;
    }

    .current-price {
        font-size: 1rem;
        font-weight: 600;
        color: #a3a3a3;
        transition: color 0.2s;
    }

    .current-price.highlight {
        color: #fbbf24;
        font-weight: 700;
    }

    /* Footer */
    .modal-footer {
        padding: 24px;
        background: #171717;
        border-top: 1px solid #262626;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .policy-agreement {
        display: flex;
        justify-content: center;
        margin-bottom: 4px;
        width: 100%;
    }

    .checkbox-label {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        cursor: pointer;
        font-size: 0.85rem;
        color: #a3a3a3;
        user-select: none;
        line-height: 1.4;
    }

    .checkbox-label input {
        display: none;
    }

    .checkbox-custom {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        border: 2px solid #525252;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        background: #262626;
        color: black;
        margin-top: 1px;
    }

    .checkbox-label input:checked + .checkbox-custom {
        background: #fbbf24;
        border-color: #fbbf24;
    }

    .agreement-text a {
        color: #a3a3a3;
        text-decoration: underline;
        text-underline-offset: 2px;
        transition: color 0.2s;
    }

    .agreement-text a:hover {
        color: #ededed;
    }

    .current-balance {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.85rem;
        color: #737373;
        margin-bottom: 12px;
    }

    .current-balance strong {
        color: #fbbf24;
    }

    .purchase-btn {
        width: 100%;
        background: #3b82f6;
        color: white;
        border: none;
        padding: 16px;
        border-radius: 16px;
        font-size: 1rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .purchase-btn:hover:not(:disabled) {
        background: #2563eb;
        transform: translateY(-2px);
    }

    .purchase-btn:disabled {
        background: #262626;
        color: #525252;
        cursor: not-allowed;
    }

    /* Spinner */
    .spinner {
        width: 20px;
        height: 20px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 1s ease-in-out infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>

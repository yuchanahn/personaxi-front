<script lang="ts">
    import { goto } from "$app/navigation";
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import NeuronIcon from "../icons/NeuronIcon.svelte";
    import { get } from "svelte/store";
    import { st_user } from "$lib/stores/user";
    import { toast } from "$lib/stores/toast";
    import { pricingStore } from "$lib/stores/pricing";
    import { marked } from "marked";
    import { locale } from "svelte-i18n";
    import { slide, fly, fade } from "svelte/transition";
    import { page } from "$app/stores";

    let noticeContent = "";
    let isNoticeOpen = true;

    $: loc = $locale || "en";
    $: if (loc) {
        import(`$lib/i18n/locales/${loc}/shop_notice.md?raw`)
            .then(async (module) => {
                noticeContent = await marked(module.default);
            })
            .catch((e) => {
                console.error(e);
                noticeContent = "";
            });
    }

    // Check if we are in a chat-like page where navbar is hidden or overlayed
    $: isChatPage =
        $page.url.pathname.startsWith("/chat") ||
        $page.url.pathname.startsWith("/2d") ||
        $page.url.pathname.startsWith("/live2d") ||
        $page.url.pathname.startsWith("/character");

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

    import { v4 as uuidv4 } from "uuid";

    // PortOne V2
    async function handleRecharge() {
        if (!selectedOption) return;

        isPurchasing = true;

        const userValue = get(st_user);
        if (!userValue) {
            console.error("User not found");
            isPurchasing = false;
            return;
        }

        // Generate Merchant UID
        const credits =
            selectedOption.neurons + (selectedOption.bonus_amount || 0);
        // Format: ord_{timestamp}_{random} to meet KG Inicis 40-char limit
        const merchantUid = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        // Ensure PortOne SDK is loaded
        // @ts-ignore
        if (!window.PortOne) {
            console.error("PortOne SDK not loaded");
            isPurchasing = false;
            // Maybe show toast error
            return;
        }

        try {
            const storeId = "store-04392323-c1ba-4c80-9812-ae8577171bb0";
            const channelKey =
                "channel-key-e2e8e3dc-c4e4-45e1-8fb5-50ee82c9f8b2";
            const paymentId = uuidv4();
            const orderName =
                selectedOption.name ||
                `${(selectedOption.neurons + (selectedOption.bonus_amount || 0)).toLocaleString()} Neurons`;
            const totalAmount = selectedOption.price_krw;
            const credits =
                selectedOption.neurons + (selectedOption.bonus_amount || 0);

            // Mobile PWA Check: PWA environments behave poorly with Payment SDKs (popups blocked/weird).
            // Force open in system browser via Bridge Page.
            // @ts-ignore
            const isPWA =
                window.matchMedia("(display-mode: standalone)").matches ||
                (window.navigator as any).standalone === true;

            if (isPWA) {
                const params = new URLSearchParams({
                    paymentId,
                    amount: totalAmount.toString(),
                    credits: credits.toString(),
                    productName: orderName,
                    userId: userValue.id,
                    email: userValue.email || "",
                    name: userValue.name || "",
                });

                // Open in new window (System Browser)
                // Redirect to PWA Test Page
                window.location.href = `/payment/pwa-test?${params.toString()}`;

                closeModal();
                isPurchasing = false;
                toast.info("PWA Test Page Opened.");
                return;
            }

            // @ts-ignore
            const response = await window.PortOne.requestPayment({
                storeId,
                channelKey,
                paymentId,
                orderName,
                totalAmount,
                currency: "CURRENCY_KRW",
                payMethod: "CARD",
                customer: {
                    fullName: userValue.name,
                    phoneNumber: "010-0000-0000",
                    email: userValue.email,
                },
                customData: {
                    userId: userValue.id,
                    credits: credits,
                },
                redirectUrl: `${window.location.origin}${window.location.pathname}`, // Clean URL for better PG compatibility
            });
            // bypass: { ... } // Removed to prevent forced popup behavior on mobile

            if (response.code != null) {
                // Error
                console.error("PortOne Error:", response);
                toast.error(response.message || "Payment failed");
                isPurchasing = false;
                return;
            }

            // Success (Logic is handled via Webhook, but we can optimistically update or poll)
            // Or just close modal and show "Processing..."
            closeModal();
            isPurchasing = false;
        } catch (error) {
            console.error("PortOne Exception:", error);
            toast.error("An unexpected error occurred during payment.");
            isPurchasing = false;
        }
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);

        pricingStore.fetchPricingPolicy();

        // Load PortOne V2 SDK
        if (!document.getElementById("portone-v2-sdk")) {
            const script = document.createElement("script");
            script.id = "portone-v2-sdk";
            script.src = "https://cdn.portone.io/v2/browser-sdk.js";
            script.defer = true;
            document.body.appendChild(script);
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
        class:chat-mode={isChatPage}
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
            <!-- <p class="description">
                {#if isNeedNeurons}
                    {$t("needNeuronsModal.description")}
                {:else}
                    {$t("needNeuronsModal.rechargeDescription")}
                {/if}
            </p> -->

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

                <!-- Precautions Toggle -->
                <div class="precautions-section">
                    <button
                        class="toggle-btn"
                        on:click={() => (isNoticeOpen = !isNoticeOpen)}
                    >
                        <Icon icon="ph:info-bold" width="16" />
                        <span
                            >{$t("shop.notice.title", {
                                default: "Precautions",
                            })}</span
                        >
                        <Icon
                            icon="ph:caret-down-bold"
                            width="16"
                            class="caret {isNoticeOpen ? 'open' : ''}"
                        />
                    </button>
                    {#if isNoticeOpen}
                        <div class="notice-content" transition:slide>
                            {@html noticeContent}
                        </div>
                    {/if}
                </div>
                <!-- Business Info (Minimalist) -->
                <div class="business-info-minimal">
                    <p class="font-bold">{$t("footer.companyName")}</p>
                    <p>
                        {$t("footer.ceo")} <span class="mx-1">|</span>
                        {$t("footer.bizLicense")}
                    </p>
                    <p>{$t("footer.address")}</p>
                    <p>{$t("footer.mailOrder")}</p>
                    <p>
                        {$t("footer.phone")} <span class="mx-1">|</span>
                        {$t("footer.email")}
                    </p>
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
                            {$t("legal.checkedAndAgree")}
                            <a href="/refund" target="_blank"
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
    /* Dark Theme Variables Removed - Using global theme variables */

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
        padding-bottom: env(safe-area-inset-bottom);
        z-index: 10001; /* Higher than NavBottom (9999) */
        backdrop-filter: blur(8px);
    }

    .modal-backdrop.chat-mode {
        padding-bottom: env(safe-area-inset-bottom);
    }

    .modal-content {
        background-color: var(--card);
        border-top-left-radius: 24px;
        border-top-right-radius: 24px;
        width: 100%;
        max-width: 500px;
        max-height: 85vh; /* Allow it to be tall but not full screen */
        box-shadow: var(--shadow-popover);
        display: flex;
        flex-direction: column;
        border: 1px solid var(--border);
        border-bottom: none;
        overflow: hidden;
        color: var(--foreground);
    }

    /* Desktop: Center Modal */
    @media (min-width: 768px) {
        .modal-backdrop {
            align-items: center;
            padding-bottom: 0; /* Reset padding for desktop */
        }
        .modal-content {
            border-radius: 24px;
            border-bottom: 1px solid var(--border);
            max-height: 90vh;
        }
    }

    .modal-header {
        padding: 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--border);
    }

    .modal-header h2 {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--foreground);
        margin: 0;
    }

    .close-button {
        background: transparent;
        border: none;
        color: var(--muted-foreground);
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
        background: var(--secondary);
        color: var(--foreground);
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
        color: var(
            --foreground
        ); /* was #fbbf24, but context says "promo content color". Usually dark or light text. Wait, original was #fbbf24? No, looking at lines 486. Ah, it was #fbbf24 in original. I'll stick to variable if I can or keep gold. Let's keep gold for promo content if it's special, or use foreground. The snippet shows: color: #fbbf24; in original. I'll keep it gold or valid variable. Actually line 486 in original is color: #fbbf24; */
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
        background: var(--secondary);
        border: 1px solid transparent; /* Default transparent */
        border-color: transparent !important; /* Force transparent */
        border-radius: 16px;
        padding: 5px 7px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
        width: 100%;
        text-align: left;
    }

    @media (max-width: 768px) {
        .pricing-row {
            padding: 5px 7px;
        }
        .pricing-list {
            gap: 5px;
        }
    }

    .pricing-row:hover {
        background: var(--border);
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
        background: var(--background);
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
        color: var(--foreground);
    }

    .neurons-count .unit {
        font-size: 0.8rem;
        font-weight: 400;
        color: var(--muted-foreground);
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
        color: var(--muted-foreground);
        text-decoration: line-through;
    }

    .current-price {
        font-size: 1rem;
        font-weight: 600;
        color: var(--muted-foreground);
        transition: color 0.2s;
    }

    .current-price.highlight {
        color: #fbbf24;
        font-weight: 700;
    }

    /* Footer */
    .modal-footer {
        padding: 24px;
        background: var(--card);
        border-top: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .policy-agreement {
        display: flex;
        justify-content: center;
        margin-bottom: 1px;
        width: 100%;
    }

    .checkbox-label {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        cursor: pointer;
        font-size: 0.85rem;
        color: var(--muted-foreground);
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
        border: 2px solid var(--muted-foreground);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        background: var(--background);
        color: var(--foreground);
        margin-top: 1px;
    }

    .checkbox-label input:checked + .checkbox-custom {
        background: #fbbf24;
        border-color: #fbbf24;
        color: black;
    }

    .agreement-text a {
        color: var(--muted-foreground);
        text-decoration: underline;
        text-underline-offset: 2px;
        transition: color 0.2s;
    }

    .agreement-text a:hover {
        color: var(--foreground);
    }

    .current-balance {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.85rem;
        color: var(--muted-foreground);
        margin-bottom: 2px;
    }

    .current-balance strong {
        color: #fbbf24;
    }

    .purchase-btn {
        width: 100%;
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        padding: 12px;
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
        filter: brightness(1.1);
        transform: translateY(-2px);
    }

    .purchase-btn:disabled {
        background: var(--muted);
        color: var(--muted-foreground);
        cursor: not-allowed;
        opacity: 0.7;
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

    /* Precautions Toggle Styles */
    .precautions-section {
        margin-top: 20px;
        background: var(--background);
        border-radius: 12px;
        overflow: hidden;
    }

    .toggle-btn {
        width: 100%;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        background: none;
        border: none;
        color: var(--muted-foreground);
    }

    .toggle-btn:hover {
        background: rgba(0, 0, 0, 0.05);
        color: var(--foreground);
    }

    .notice-content {
        padding: 0 16px 16px;
        font-size: 0.8rem;
        line-height: 1.5;
        color: var(--muted-foreground);
    }

    /* Business Info (Minimalist) */
    .business-info-minimal {
        margin-top: 32px;
        padding-top: 24px;
        border-top: 1px solid var(--border);
        text-align: center;
        font-size: 0.7rem;
        color: var(--muted-foreground);
        opacity: 0.6;
        line-height: 1.5;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .business-info-minimal p {
        margin: 0;
    }

    .mx-1 {
        margin: 0 4px;
        opacity: 0.3;
    }

    .font-bold {
        font-weight: 700;
        margin-bottom: 4px !important;
        opacity: 0.9;
    }

    /* Markdown Styles within notice-content */
    .notice-content :global(ul) {
        padding-left: 20px;
        margin: 0;
        list-style: disc;
    }
    .notice-content :global(li) {
        margin-bottom: 4px;
    }
</style>

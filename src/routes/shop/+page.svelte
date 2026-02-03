<script lang="ts">
    import { onMount } from "svelte";
    import { st_user as user } from "$lib/stores/user";
    import { pricingStore } from "$lib/stores/pricing";
    import { t } from "svelte-i18n";
    import { fade, slide } from "svelte/transition";
    import Icon from "@iconify/svelte";
    import NeuronIcon from "$lib/components/icons/NeuronIcon.svelte";

    let lemonSqueezyUrl =
        "https://personaxi.lemonsqueezy.com/checkout/buy/37030093-8078-4bd9-bc76-9711cbac1f3e?embed=1";
    let selectedOption: any = null;

    function getCheckoutUrl(option: any) {
        if (!$user) return lemonSqueezyUrl;
        return `${lemonSqueezyUrl}&checkout[custom][user_id]=${$user.id}`;
    }

    function openCheckout() {
        if (!selectedOption) return;
        const url = getCheckoutUrl(selectedOption);
        // @ts-ignore
        if (!window.LemonSqueezy && window.createLemonSqueezy)
            window.createLemonSqueezy();
        // @ts-ignore
        if (window.LemonSqueezy) {
            // @ts-ignore
            window.LemonSqueezy.Url.Open(url);
        } else {
            window.open(url, "_blank");
        }
    }

    onMount(() => {
        if (!document.getElementById("lemon-js")) {
            const script = document.createElement("script");
            script.id = "lemon-js";
            script.src = "https://assets.lemonsqueezy.com/lemon.js";
            script.defer = true;
            script.onload = () => {
                // @ts-ignore
                if (window.createLemonSqueezy) window.createLemonSqueezy();
            };
            document.body.appendChild(script);
        }
    });

    function getBonusPercentage(option: any) {
        if (option.bonus_amount && option.bonus_amount > 0) {
            return Math.round((option.bonus_amount / option.neurons) * 100);
        }
        return 0;
    }

    $: bestOption = $pricingStore.purchase_options.reduce((prev, current) => {
        return getBonusPercentage(prev) > getBonusPercentage(current)
            ? prev
            : current;
    }, $pricingStore.purchase_options[0]);

    function getStandardPrice(neurons: number) {
        if ($pricingStore.purchase_options.length === 0) return 0;
        const baseOption = $pricingStore.purchase_options[0];
        // Calculate base rate (KRW per Neuron) from the smallest pack
        const baseRate = baseOption.price_krw / baseOption.neurons;
        return Math.floor(neurons * baseRate);
    }

    function getProductIconProps(index: number) {
        // Variants based on value
        const variants: ("simple" | "standard" | "double")[] = [
            "simple",
            "standard",
            "double",
            "double",
        ];
        const sizes = [28, 32, 36, 40];

        // Ensure index is within bounds
        const i = Math.min(index, variants.length - 1);

        return {
            variant: variants[i],
            size: sizes[i],
            // Default inactive color, selection handles active color
            color: "#525252",
        };
    }
</script>

<svelte:head>
    <title>{$t("shop.title", { default: "Neuron Shop" })} | PersonaXi</title>
</svelte:head>

<div class="shop-page" in:fade>
    <div class="shop-container">
        <header>
            <div class="header-text">
                <h1>{$t("shop.title", { default: "Neuron Shop" })}</h1>
                <p>
                    {$t("shop.subtitle", {
                        default: "Empower your AI with more neurons",
                    })}
                </p>
            </div>

            <div class="balance-card">
                <span class="label">{$t("shop.current_neurons")}</span>
                <div class="balance-row">
                    <!-- Static standard variant for balance -->
                    <NeuronIcon
                        size={40}
                        color={"#fbbf24"}
                        variant={"standard"}
                    />
                    <span class="count"
                        >{$user?.credits?.toLocaleString() || 0}</span
                    >
                    <span class="unit">N</span>
                </div>
            </div>
        </header>

        <div class="product-grid">
            {#each $pricingStore.purchase_options as option, i}
                {@const props = getProductIconProps(i)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    class="product-card"
                    class:selected={selectedOption === option}
                    on:click={() => (selectedOption = option)}
                    role="button"
                    tabindex="0"
                >
                    {#if option === bestOption}
                        <div class="best-badge">
                            <Icon icon="solar:star-bold" />
                            <span
                                >{$t("shop.best_value", {
                                    default: "BEST",
                                })}</span
                            >
                        </div>
                    {/if}

                    <div class="card-inner">
                        <div class="main-info">
                            <div class="icon-holder">
                                <NeuronIcon
                                    size={props.size}
                                    variant={props.variant}
                                    color={selectedOption === option
                                        ? "#fbbf24"
                                        : props.color}
                                />
                            </div>
                            <div class="text-group">
                                <span class="neurons">
                                    {option.neurons.toLocaleString()}
                                    <small>N</small>
                                </span>
                                {#if option.bonus_amount && option.bonus_amount > 0}
                                    <span class="bonus-label">
                                        +{option.bonus_amount.toLocaleString()}
                                        {$t("shop.bonus_label")}
                                    </span>
                                {/if}
                            </div>
                        </div>

                        <div class="price-group">
                            <!-- Percentage badge removed as per request -->
                            <div class="price-texts">
                                {#if option.price_krw < getStandardPrice(option.neurons + (option.bonus_amount || 0))}
                                    <span class="old"
                                        >{getStandardPrice(
                                            option.neurons +
                                                (option.bonus_amount || 0),
                                        ).toLocaleString()}₩</span
                                    >
                                {/if}
                                <span class="now">{option.price_display}</span>
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </div>

    <!-- Notice Section -->
    <div class="notice-section">
        <h3>
            <Icon icon="ph:info" />
            {$t("shop.notice.title")}
        </h3>
        <ul>
            <li>
                <span>{$t("shop.notice.refund_desc")}</span>
            </li>
            <li>
                <span>{$t("shop.notice.cancel_desc")}</span>
            </li>
            <li>
                <span>{$t("shop.notice.fee_desc")}</span>
            </li>
            <li>
                <span>{$t("shop.notice.ai_desc")}</span>
            </li>
            <li>
                <span>{$t("shop.notice.ban_desc")}</span>
            </li>
        </ul>
    </div>

    <!-- Force spacer to ensure content clears the sticky bottom bar -->
    <div style="height: 200px; width: 100%;" class="spacer"></div>

    <div class="checkout-bar">
        <div class="bar-content">
            <div class="info">
                {#if selectedOption}
                    <div class="selection-detail" in:slide>
                        <span class="lbl">{$t("shop.selected")}</span>
                        <span class="val"
                            >{$t("shop.neuron_pack", {
                                values: {
                                    count: (
                                        selectedOption.neurons +
                                        (selectedOption.bonus_amount || 0)
                                    ).toLocaleString(),
                                },
                            })}</span
                        >
                    </div>
                {/if}
            </div>
            <button
                class="pay-btn"
                disabled={!selectedOption}
                on:click={openCheckout}
            >
                {#if selectedOption}
                    {$t("shop.purchase_button", {
                        values: { price: selectedOption.price_display },
                    })}
                {:else}
                    {$t("shop.select_option")}
                {/if}
            </button>
        </div>
    </div>
</div>

<style>
    /* Global body styles removed to prevent theme conflict */

    .shop-page {
        min-height: 100vh;
        padding: 60px 20px 10px;
    }

    .shop-container {
        max-width: 600px;
        margin: 0 auto;
    }

    header {
        margin-bottom: 48px;
    }

    h1 {
        font-size: 2.2rem;
        font-weight: 800;
        margin: 0 0 8px;
        letter-spacing: -0.03em;
        color: var(--foreground);
    }

    header p {
        color: var(--muted-foreground);
        font-size: 1rem;
    }

    .balance-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 24px;
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .balance-card .label {
        font-size: 0.8rem;
        color: var(--muted-foreground);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 8px;
    }

    .balance-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 2.5rem;
        font-weight: 800;
    }

    .balance-row .icon {
        color: #fbbf24; /* Neurons = Gold */
    }

    .balance-row .unit {
        font-size: 1rem;
        color: var(--muted-foreground);
        margin-top: 12px;
    }

    .product-grid {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .product-card {
        position: relative;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 24px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .product-card:hover {
        border-color: var(--border);
        background: var(--secondary);
    }

    .product-card.selected {
        background: var(--card);
        border-color: #fbbf24; /* Impulsive Gold */
        box-shadow: 0 0 0 1px #fbbf24;
    }

    .card-inner {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .main-info {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .icon-holder {
        width: 40px;
        height: 40px;
        background: var(--secondary);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--muted-foreground);
        font-size: 1.2rem;
    }

    .selected .icon-holder {
        background: rgba(251, 191, 36, 0.15); /* Gold Tint */
        color: #fbbf24;
    }

    .neurons {
        display: block;
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--foreground);
    }

    .neurons small {
        font-size: 0.8rem;
        color: var(--muted-foreground);
    }

    .bonus-label {
        font-size: 0.75rem;
        color: #fbbf24; /* Bonus = Gold */
        font-weight: 600;
    }

    .price-group {
        text-align: right;
    }

    .notice-section {
        margin-top: 30px;
        /* Reduce max-width to make text lines shorter and easier to read */
        max-width: 660px;
        margin-left: auto;
        margin-right: auto;
        padding: 30px;
        background: var(--card); /* Darker than card, lighter than bg */
        border-radius: 20px;
        color: var(--muted-foreground);
        border: 1px solid var(--border);
    }

    .notice-section h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1rem;
        color: var(--foreground);
        margin: 0 0 20px 0;
    }

    .notice-section ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .notice-section li {
        font-size: 0.85rem;
        line-height: 1.5;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .notice-section li strong {
        color: var(--foreground);
        font-weight: 600;
        font-size: 0.9rem;
    }

    .notice-section li span {
        color: var(--muted-foreground);
    }

    .percent {
        display: inline-block;
        background: #fbbf24; /* Gold Background */
        color: #000; /* Black Text for contrast */
        font-size: 0.65rem;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 4px;
        margin-bottom: 4px;
    }

    .now {
        display: block;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--foreground);
    }

    .old {
        font-size: 0.8rem;
        color: var(--muted-foreground);
        text-decoration: line-through;
    }

    .best-badge {
        position: absolute;
        top: -10px;
        left: 20px;
        background: linear-gradient(
            135deg,
            #f59e0b,
            #d97706
        ); /* Gold Gradient */
        color: #000;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.65rem;
        font-weight: 800;
        display: flex;
        align-items: center;
        gap: 4px;
        box-shadow: 0 4px 10px rgba(251, 191, 36, 0.3);
    }

    .checkout-bar {
        position: fixed;
        bottom: 40px;
        left: 0;
        width: 100%;
        z-index: 100;
    }

    .bar-content {
        max-width: 560px;
        margin: 0 auto;
        background: var(--card); /* Fallback */
        backdrop-filter: blur(20px);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 12px 12px 12px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: var(--shadow-popover);
    }

    .selection-detail .lbl {
        display: block;
        font-size: 0.75rem;
        color: var(--muted-foreground);
    }

    .selection-detail .val {
        font-weight: 700;
        color: #fbbf24; /* Selected Value Gold */
    }

    .pay-btn {
        background: #3b82f6; /* Keep Blue for Trust */
        color: #fff;
        border: none;
        padding: 16px 32px;
        border-radius: 18px;
        font-weight: 700;
        font-size: 1rem;
        cursor: pointer;
        transition: transform 0.2s;
    }

    .pay-btn:hover:not(:disabled) {
        background: #2563eb;
        transform: translateY(-1px);
    }

    .pay-btn:disabled {
        background: var(--muted);
        color: var(--muted-foreground);
        cursor: not-allowed;
    }

    @media (max-width: 600px) {
        .bar-content {
            margin: 0 16px;
        }

        .checkout-bar {
            bottom: 80px;
        }
    }
</style>

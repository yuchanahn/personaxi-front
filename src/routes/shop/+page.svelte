<script lang="ts">
    import { onMount } from "svelte";
    import { st_user as user } from "$lib/stores/user";
    import { pricingStore } from "$lib/stores/pricing";
    import { t } from "svelte-i18n";
    import { fade } from "svelte/transition";

    let lemonSqueezyUrl =
        "https://personaxi.lemonsqueezy.com/checkout/buy/37030093-8078-4bd9-bc76-9711cbac1f3e?embed=1";

    function getCheckoutUrl(option: any) {
        if (!$user) return lemonSqueezyUrl;
        // In real implementation, use option.item_id or map to specific Lemon Squeezy URL variants

        let url = lemonSqueezyUrl;
        // Append user_id to checkout[custom] for webhook tracking
        return `${url}&checkout[custom][user_id]=${$user.id}`;
    }

    function openCheckout(option: any) {
        const url = getCheckoutUrl(option);

        // Try to initialize if missing
        // @ts-ignore
        if (!window.LemonSqueezy && window.createLemonSqueezy) {
            // @ts-ignore
            window.createLemonSqueezy();
        }

        // @ts-ignore
        if (window.LemonSqueezy) {
            // @ts-ignore
            window.LemonSqueezy.Url.Open(url);
        } else {
            window.open(url, "_blank");
        }
    }

    onMount(() => {
        // Dynamically load Lemon.js
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
</script>

<svelte:head>
    <title>{$t("shop.title", { default: "Neuron Shop" })} | PersonaXi</title>
</svelte:head>

<div class="shop-container" in:fade>
    <header>
        <h1>{$t("shop.title", { default: "Neuron Shop" })}</h1>
        <p>
            {$t("shop.subtitle", {
                default: "Charge Neurons to interact with more personas!",
            })}
        </p>
    </header>

    <div class="products-grid">
        {#each $pricingStore.purchase_options as option}
            <!-- Product Card -->
            <div class="product-card">
                <div class="product-icon">💎</div>
                <h2>
                    {$t("shop.neuron_pack", {
                        values: { count: option.neurons.toLocaleString() },
                        default: `${option.neurons.toLocaleString()} Neurons`,
                    })}
                </h2>
                {#if option.bonus_ratio && option.bonus_ratio > 0}
                    <div class="bonus-container">
                        <span class="bonus-tag"
                            >+{option.bonus_ratio}% Bonus</span
                        >
                    </div>
                {/if}
                <p class="price">{option.price_display}</p>
                <p class="description">Neuron Pack</p>
                <!-- Simple description -->

                <button
                    on:click={() => openCheckout(option)}
                    class="lemonsqueezy-button buy-btn"
                >
                    {$t("shop.buyNow", { default: "Buy Now" })}
                </button>
            </div>
        {/each}
    </div>
</div>

<style>
    .shop-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 40px 20px;
        color: white;
    }

    header {
        text-align: center;
        margin-bottom: 60px;
    }

    h1 {
        font-size: 2.5rem;
        margin-bottom: 10px;
        background: linear-gradient(to right, #a855f7, #ec4899);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .products-grid {
        display: flex;
        justify-content: center;
        gap: 30px;
        flex-wrap: wrap;
    }

    .product-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 30px;
        width: 300px;
        text-align: center;
        transition:
            transform 0.2s,
            box-shadow 0.2s;
    }

    .product-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 30px rgba(168, 85, 247, 0.2);
        border-color: rgba(168, 85, 247, 0.4);
    }

    .product-icon {
        font-size: 4rem;
        margin-bottom: 20px;
    }

    h2 {
        font-size: 1.5rem;
        margin-bottom: 10px;
    }

    .price {
        font-size: 1.8rem;
        font-weight: bold;
        color: #d8b4fe;
        margin-bottom: 15px;
    }

    .description {
        color: #9ca3af;
        margin-bottom: 25px;
    }

    .buy-btn {
        display: inline-block;
        background: linear-gradient(135deg, #a855f7, #ec4899);
        color: white;
        padding: 12px 30px;
        border-radius: 999px;
        text-decoration: none;
        font-weight: bold;
        transition: opacity 0.2s;
        cursor: pointer;
        border: none;
        width: 100%;
        box-sizing: border-box;
        font-size: 1rem;
    }

    .buy-btn:hover {
        opacity: 0.9;
    }

    .bonus-container {
        margin-bottom: 10px;
    }

    .bonus-tag {
        display: inline-block;
        background: #f59e0b; /* Amber 500 */
        color: #1a1a1a;
        font-weight: 800;
        padding: 4px 12px;
        border-radius: 999px;
        font-size: 0.85rem;
        box-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);
    }
</style>

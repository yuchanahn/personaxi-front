<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { t } from "svelte-i18n";

    let loading = true;
    let error = "";

    // Top-level variables for template access
    let productName = "";
    let amount = 0;

    onMount(async () => {
        return;
        const query = $page.url.searchParams;
        productName = query.get("productName") || "";
        amount = Number(query.get("amount")) || 0;
        const userId = query.get("userId");
        const paymentId = query.get("paymentId");

        if (!paymentId || !amount || !productName || !userId) {
            error = "Invalid payment parameters.";
            loading = false;
            return;
        }

        try {
            // Wait for SDK if not ready
            if (!window.PortOne) {
                await new Promise((resolve) => setTimeout(resolve, 500));
            }

            if (!window.PortOne) {
                error = "Payment SDK failed to load.";
                loading = false;
                return;
            }

            // Ready to pay - Show button
            loading = false;
        } catch (e: any) {
            error = e.message || "An unexpected error occurred.";
            loading = false;
        }
    });

    async function startPayment() {
        return;
        if (!window.PortOne) return;

        try {
            const query = $page.url.searchParams;
            const paymentId = query.get("paymentId");
            const userId = query.get("userId");
            const email = query.get("email") || undefined;
            const name = query.get("name") || undefined;
            const credits = Number(query.get("credits"));

            // Correct Config
            const storeId = "store-04392323-c1ba-4c80-9812-ae8577171bb0";
            const channelKey =
                "channel-key-c50f76a9-fa6e-47be-80e4-f77b8b8d6248";

            const response = await window.PortOne.requestPayment({
                storeId,
                channelKey,
                paymentId: paymentId!,
                orderName: productName!,
                totalAmount: amount,
                currency: "CURRENCY_KRW",
                payMethod: "CARD",
                customer: {
                    fullName: name,
                    phoneNumber: "010-0000-0000",
                    email: email,
                },
                customData: {
                    userId: userId,
                    credits: credits,
                },
                redirectUrl: `${window.location.origin}/payment/complete`,
            });

            if (response.code != null) {
                error = response.message || "Payment failed";
            } else {
                window.location.href =
                    "/payment/complete?paymentId=" + paymentId;
            }
        } catch (e: any) {
            error = e.message;
        }
    }
</script>

<div class="container">
    {#if loading}
        <div class="spinner"></div>
        <p>{$t("payment.processing", { default: "Processing payment..." })}</p>
        <p class="sub-text">
            {$t("payment.wait_moment", { default: "Please wait a moment." })}
        </p>
    {:else if error}
        <div class="error">
            <p>{error}</p>
            <button on:click={() => window.close()}
                >{$t("common.close", { default: "Close" })}</button
            >
        </div>
    {:else}
        <div class="payment-ready">
            <h2>Payment Ready</h2>
            <br />
            <p class="product-name">{productName}</p>
            <p class="amount">{amount.toLocaleString()} KRW</p>
            <br />
            <button class="pay-btn" on:click={startPayment}>
                Proceed to Payment
            </button>
        </div>
    {/if}
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100dvh; /* Use dynamic viewport height for mobile */
        background-color: #1a1a1a;
        color: white;
        text-align: center;
        font-family: sans-serif;
    }
    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 1s ease-in-out infinite;
        margin-bottom: 20px;
    }
    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
    .sub-text {
        font-size: 0.9em;
        color: #888;
        margin-top: 10px;
    }
    .error {
        color: #ff4444;
    }
    button {
        margin-top: 20px;
        padding: 10px 20px;
        background: #333;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }
    .pay-btn {
        background: #0070f3;
        font-size: 1.2rem;
        padding: 15px 30px;
        font-weight: bold;
        border-radius: 8px;
        width: 80%;
        max-width: 300px;
    }
    .product-name {
        font-size: 1.5rem;
        font-weight: bold;
    }
    .amount {
        font-size: 1.2rem;
        color: #ddd;
    }
</style>

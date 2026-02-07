<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { t } from "svelte-i18n";

    let loading = true;
    let error = "";

    onMount(async () => {
        const query = $page.url.searchParams;

        const paymentId = query.get("paymentId");
        const amount = Number(query.get("amount"));
        const credits = Number(query.get("credits"));
        const productName = query.get("productName");

        // User Info
        const userId = query.get("userId");
        const email = query.get("email") || undefined;
        const name = query.get("name") || undefined;

        // Config (Should match environment variables/constants used in Modal)
        const storeId = "store-43890393-27d1-4db5-8eb0-2af3d9021e15"; // Hardcoded for now, ideally from env
        const channelKey = "channel-key-32127265-5003-455b-9878-01e428df133c"; // Hardcoded for now

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

            const response = await window.PortOne.requestPayment({
                storeId,
                channelKey,
                paymentId,
                orderName: productName,
                totalAmount: amount,
                currency: "CURRENCY_KRW",
                payMethod: "EASY_PAY",
                customer: {
                    fullName: name,
                    email: email,
                },
                customData: {
                    userId: userId,
                    credits: credits,
                },
                redirectUrl: `${window.location.origin}/payment/complete`,
            });

            if (response.code != null) {
                // Error handling
                error = response.message || "Payment failed";
                loading = false;
                // alert(error);
                // window.close(); // Optional
            } else {
                // Success - typically redirects, but if not:
                window.location.href =
                    "/payment/complete?paymentId=" + paymentId;
            }
        } catch (e: any) {
            error = e.message || "An unexpected error occurred.";
            loading = false;
        }
    });
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
    {/if}
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
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
</style>

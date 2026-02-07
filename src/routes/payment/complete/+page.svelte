<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import Icon from "@iconify/svelte";
    import { t } from "svelte-i18n";

    let status = "processing"; // 'processing', 'success', 'failed'
    let message = "";

    onMount(async () => {
        // Parse URL params
        const urlParams = new URLSearchParams(window.location.search);
        // PortOne V1/V2 params might vary, but usually imp_success or success
        // V2 might just redirect back.
        // We assume if they reached here, the PG flow finished.
        // Webhook handles the actual logic.

        // Simulate a short delay to allow webhook to process
        setTimeout(() => {
            status = "success";
            setTimeout(() => {
                goto("/shop"); // Redirect to shop or hub
            }, 3000);
        }, 2000);
    });
</script>

<div class="payment-complete-container">
    <div class="content">
        {#if status === "processing"}
            <div class="spinner"></div>
            <h2>
                {$t("payment.processing", { default: "Processing Payment..." })}
            </h2>
            <p>
                {$t("payment.wait_moment", {
                    default: "Please wait a moment.",
                })}
            </p>
        {:else if status === "success"}
            <Icon icon="ph:check-circle-bold" class="success-icon" width="64" />
            <h2>{$t("payment.success", { default: "Payment Successful!" })}</h2>
            <p>
                {$t("payment.redirecting", {
                    default: "Redirecting to shop...",
                })}
            </p>
        {:else}
            <Icon icon="ph:x-circle-bold" class="error-icon" width="64" />
            <h2>{$t("payment.failed", { default: "Payment Failed" })}</h2>
            <p>{message}</p>
            <button on:click={() => goto("/shop")}
                >{$t("common.back", { default: "Go Back" })}</button
            >
        {/if}
    </div>
</div>

<style>
    .payment-complete-container {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background-color: var(--background);
        color: var(--foreground);
        text-align: center;
    }

    .content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
    }

    .spinner {
        width: 48px;
        height: 48px;
        border: 5px solid var(--muted);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .success-icon {
        color: #10b981; /* Green */
    }

    .error-icon {
        color: #ef4444; /* Red */
    }

    h2 {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
    }

    p {
        color: var(--muted-foreground);
        margin: 0;
    }

    button {
        margin-top: 1rem;
        padding: 0.75rem 1.5rem;
        background-color: var(--primary);
        color: var(--primary-foreground);
        border: none;
        border-radius: 0.5rem;
        font-weight: 600;
        cursor: pointer;
    }
</style>

<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import Icon from "@iconify/svelte";
    import { t } from "svelte-i18n";

    let status = "processing";
    let message = "";
    let returnUrl = "" as string | null;

    onMount(async () => {
        // 1. Parse URL params immediately
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const msg = urlParams.get("message");
        const decodedMessage = msg ? decodeURIComponent(msg) : "";

        // 2. Get stored state
        returnUrl = localStorage.getItem("payment_return_url");

        // 3. Logic for Smart Rewind (reused for both success/fail to exit PG)
        const performRewind = () => {
            const startLenStr = localStorage.getItem(
                "payment_start_history_len",
            );
            const doFallback = () => {
                if (returnUrl) {
                    goto(returnUrl, { replaceState: true });
                } else {
                    goto("/", { replaceState: true });
                }
            };

            if (startLenStr) {
                const startLen = parseInt(startLenStr, 10);
                const currentLen = window.history.length;
                const delta = currentLen - startLen;
                localStorage.removeItem("payment_start_history_len");

                if (delta > 0) {
                    window.history.go(-delta);
                    // Safety timeout in case go() fails or takes too long
                    setTimeout(() => {
                        // checks? just wait
                    }, 500);
                } else {
                    doFallback();
                }
            } else {
                doFallback();
            }
        };

        // 4. Handle Failure/Cancellation
        if (code) {
            status = "failed";
            message = decodedMessage || "Payment was cancelled or failed.";
            console.error("Payment Failed:", code, message);

            // Clear token to prevent loops, but effectively we are done
            localStorage.removeItem("payment_return_url");

            // Automatically go back after showing error
            setTimeout(() => {
                performRewind();
            }, 3000);
            return;
        }

        // 5. Handle Missing Token (Direct Access protection)
        if (!returnUrl) {
            goto("/", { replaceState: true });
            return;
        }

        // 6. Handle Success (Assumed if no code and token exists)
        // Simulate verify delay
        setTimeout(() => {
            status = "success";

            // Consume the ticket
            localStorage.removeItem("payment_return_url");

            // Redirect back
            setTimeout(() => {
                performRewind();
            }, 3000);
        }, 1500);
    });

    function performRewind() {
        const startLenStr = localStorage.getItem("payment_start_history_len");
        if (!returnUrl) {
            goto("/", { replaceState: true });
            return;
        }
        const doFallback = () => {
            goto(returnUrl!, { replaceState: true });
        };

        if (startLenStr) {
            const startLen = parseInt(startLenStr, 10);
            const currentLen = window.history.length;
            const delta = currentLen - startLen;
            localStorage.removeItem("payment_start_history_len");

            if (delta > 0) {
                window.history.go(-delta);

                setTimeout(() => {}, 500);
            } else {
                doFallback();
            }
        } else {
            doFallback();
        }
    }
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
            <button on:click={() => performRewind()}
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

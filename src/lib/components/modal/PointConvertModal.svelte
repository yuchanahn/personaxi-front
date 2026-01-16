<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { createEventDispatcher } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";

    export let isOpen: boolean = false;
    export let userPoints: number = 0;

    const dispatch = createEventDispatcher();

    let amount: number | null = null;
    let isLoading = false;

    // Configuration (Mock)
    const FEE_RATE = 0.1; // 10% fee
    const EXCHANGE_RATE = 1; // 1 Point = 1 Neuron

    $: fee = amount ? Math.floor(amount * FEE_RATE) : 0;
    $: resultNeurons = amount ? Math.floor((amount - fee) * EXCHANGE_RATE) : 0;
    $: isValid = amount && amount > 0 && amount <= userPoints;

    function handleClose() {
        dispatch("close");
        amount = null;
    }

    async function handleConvert() {
        if (!isValid || !amount) return;
        isLoading = true;

        // Simulate API call or Emit event
        // In real impl, we would call api.post('/api/points/convert', { amount })

        // For now, dispatch event
        dispatch("confirm", { amount });

        isLoading = false;
        handleClose();
    }
</script>

{#if isOpen}
    <div
        class="modal-backdrop"
        on:click={handleClose}
        transition:fade={{ duration: 160 }}
    >
        <div
            class="modal-content"
            transition:fly={{ y: -14, duration: 220 }}
            on:click|stopPropagation
        >
            <div class="modal-header">
                <h3>{$t("pointConvertModal.title")}</h3>
                <button class="close-btn" on:click={handleClose}>
                    <Icon icon="ph:x-bold" />
                </button>
            </div>

            <div class="modal-body">
                <div class="info-box">
                    <p class="info-title">
                        <Icon icon="ph:info-duotone" />
                        {$t("pointConvertModal.infoTitle")}
                    </p>
                    <p class="info-text">{$t("pointConvertModal.infoDesc")}</p>
                    <p class="info-sub invalid">
                        <Icon icon="ph:warning-circle-bold" />
                        {$t("pointConvertModal.cashoutNotice")}
                    </p>
                </div>

                <div class="input-section">
                    <div class="label-row">
                        <span>{$t("pointConvertModal.convertAmount")}</span>
                        <span class="max-text"
                            >{$t("pointConvertModal.max")}: {userPoints} P</span
                        >
                    </div>
                    <div class="input-wrapper">
                        <input
                            type="number"
                            bind:value={amount}
                            placeholder="0"
                            min="0"
                            max={userPoints}
                        />
                        <span class="unit">P</span>
                    </div>
                    {#if amount && amount > userPoints}
                        <p class="error-msg">
                            {$t("pointConvertModal.insufficientPoints")}
                        </p>
                    {/if}
                </div>

                <div class="summary-card">
                    <div class="summary-row">
                        <span>{$t("pointConvertModal.exchangeRate")}</span>
                        <span>1 P = {EXCHANGE_RATE} Neuron</span>
                    </div>
                    <div class="summary-row">
                        <span>{$t("pointConvertModal.fee")} (10%)</span>
                        <span class="fee-text">-{fee} P</span>
                    </div>
                    <div class="divider"></div>
                    <div class="summary-row total">
                        <span>{$t("pointConvertModal.receiveAmount")}</span>
                        <span class="total-text">+{resultNeurons} ⚡️</span>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button class="btn-cancel" on:click={handleClose}>
                    {$t("common.cancel")}
                </button>
                <button
                    class="btn-confirm"
                    disabled={!isValid || isLoading}
                    on:click={handleConvert}
                >
                    {#if isLoading}
                        <Icon icon="ph:spinner-bold" class="spin" />
                    {:else}
                        {$t("pointConvertModal.convertAction")}
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }
    .modal-content {
        background: var(--background);
        width: 90%;
        max-width: 420px;
        border-radius: 20px;
        border: 1px solid var(--border);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        overflow: hidden;
    }
    .modal-header {
        padding: 1.25rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--border);
    }
    .modal-header h3 {
        margin: 0;
        font-size: 1.1rem;
    }
    .close-btn {
        background: transparent;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 50%;
        display: flex;
    }
    .close-btn:hover {
        background: var(--muted);
    }

    .modal-body {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .info-box {
        background: var(--muted);
        padding: 1rem;
        border-radius: 12px;
        font-size: 0.9rem;
    }
    .info-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
    }
    .info-text {
        color: var(--muted-foreground);
        font-size: 0.85rem;
        margin-bottom: 0.75rem;
        line-height: 1.4;
    }
    .info-sub {
        font-size: 0.8rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    .info-sub.invalid {
        color: var(--primary); /* Use primary color for notice, or orange */
    }

    .input-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .label-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
        color: var(--muted-foreground);
    }
    .max-text {
        font-size: 0.8rem;
    }
    .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }
    input {
        width: 100%;
        padding: 0.75rem 1rem;
        padding-right: 3rem;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--secondary);
        color: var(--foreground);
        font-size: 1.1rem;
        outline: none;
    }
    input:focus {
        border-color: var(--primary);
    }
    .unit {
        position: absolute;
        right: 1rem;
        font-weight: 600;
        color: var(--muted-foreground);
    }
    .error-msg {
        color: var(--destructive);
        font-size: 0.8rem;
    }

    .summary-card {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1rem;
        background: var(--secondary);
    }
    .summary-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
        color: var(--muted-foreground);
    }
    .fee-text {
        color: var(--destructive);
    }
    .divider {
        height: 1px;
        background: var(--border);
        margin: 0.75rem 0;
    }
    .summary-row.total {
        margin-bottom: 0;
        font-weight: 700;
        color: var(--foreground);
        font-size: 1.05rem;
    }
    .total-text {
        color: var(--primary);
    }

    .modal-footer {
        padding: 1.25rem;
        border-top: 1px solid var(--border);
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
    }
    .btn-cancel,
    .btn-confirm {
        padding: 0.75rem 1.5rem;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
    }
    .btn-cancel {
        background: transparent;
        color: var(--muted-foreground);
    }
    .btn-cancel:hover {
        background: var(--muted);
    }
    .btn-confirm {
        background: var(--primary);
        color: var(--primary-foreground);
        min-width: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .btn-confirm:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .spin {
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        100% {
            transform: rotate(360deg);
        }
    }
</style>

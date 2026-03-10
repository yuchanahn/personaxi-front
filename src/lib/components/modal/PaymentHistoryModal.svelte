<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from "svelte";
    import { fade } from "svelte/transition";
    import Icon from "@iconify/svelte";
    import { api } from "$lib/api";
    import { toast } from "$lib/stores/toast";
    import {
        getPaymentHistory,
        getCreditHistory,
        type CreditTransaction,
    } from "$lib/api/user";
    import type { PaymentRecord } from "$lib/types";
    import { st_user } from "$lib/stores/user";
    import NeuronIcon from "$lib/components/icons/NeuronIcon.svelte";

    export let isOpen = false;

    const dispatch = createEventDispatcher();

    type Tab = "history" | "usage";
    let activeTab: Tab = "history";
    const PAGE_SIZE = 10;

    let history: PaymentRecord[] = [];
    let creditHistory: CreditTransaction[] = [];
    let historyOffset = 0;
    let creditOffset = 0;
    let hasMoreHistory = true;
    let hasMoreCreditHistory = true;
    let historyLoaded = false;
    let creditHistoryLoaded = false;
    let listContainerEl: HTMLDivElement | null = null;

    let isLoading = false;
    let isLoadingMore = false;
    let isRefundingMap: Record<string, boolean> = {};

    $: if (isOpen) {
        if (activeTab === "history" && !historyLoaded) loadHistory(true);
        else if (activeTab === "usage" && !creditHistoryLoaded)
            loadCreditHistory(true);
    }

    $: if (!isOpen) {
        history = [];
        creditHistory = [];
        historyOffset = 0;
        creditOffset = 0;
        hasMoreHistory = true;
        hasMoreCreditHistory = true;
        historyLoaded = false;
        creditHistoryLoaded = false;
        isLoadingMore = false;
    }

    async function loadHistory(reset = false) {
        if (isLoading || isLoadingMore || (!reset && !hasMoreHistory)) return;
        if (reset) {
            history = [];
            historyOffset = 0;
            hasMoreHistory = true;
            historyLoaded = true;
            isLoading = true;
        } else {
            isLoadingMore = true;
        }
        try {
            const nextPage = await getPaymentHistory(PAGE_SIZE, historyOffset);
            history = reset ? nextPage : [...history, ...nextPage];
            hasMoreHistory = nextPage.length === PAGE_SIZE;
            historyOffset = history.length;
        } catch (error) {
            console.error("Failed to load payment history:", error);
        } finally {
            isLoading = false;
            isLoadingMore = false;
        }
    }

    async function loadCreditHistory(reset = false) {
        if (isLoading || isLoadingMore || (!reset && !hasMoreCreditHistory))
            return;
        if (reset) {
            creditHistory = [];
            creditOffset = 0;
            hasMoreCreditHistory = true;
            creditHistoryLoaded = true;
            isLoading = true;
        } else {
            isLoadingMore = true;
        }
        try {
            const nextPage = await getCreditHistory(PAGE_SIZE, creditOffset);
            creditHistory = reset ? nextPage : [...creditHistory, ...nextPage];
            hasMoreCreditHistory = nextPage.length === PAGE_SIZE;
            creditOffset = creditHistory.length;
        } catch (error) {
            console.error("Failed to load credit history:", error);
        } finally {
            isLoading = false;
            isLoadingMore = false;
        }
    }

    async function switchTab(tab: Tab) {
        activeTab = tab;
        if (!isOpen) return;
        if (tab === "history" && !historyLoaded) await loadHistory(true);
        if (tab === "usage" && !creditHistoryLoaded)
            await loadCreditHistory(true);
    }

    function handleListScroll() {
        if (!listContainerEl || isLoading || isLoadingMore) return;
        const nearBottom =
            listContainerEl.scrollHeight -
                listContainerEl.scrollTop -
                listContainerEl.clientHeight <
            120;
        if (!nearBottom) return;

        if (activeTab === "history" && hasMoreHistory) {
            loadHistory(false);
        } else if (activeTab === "usage" && hasMoreCreditHistory) {
            loadCreditHistory(false);
        }
    }

    function closeModal() {
        dispatch("close");
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape" && isOpen) {
            closeModal();
        }
    }

    // Refund Logic
    function isEligibleForRefund(record: PaymentRecord): boolean {
        if (record.status !== "paid") return false;
        const purchaseDate = new Date(record.created_at);
        const sevenDaysInMillis = 7 * 24 * 60 * 60 * 1000;
        return Date.now() - purchaseDate.getTime() < sevenDaysInMillis;
    }

    let refundingItemId: string | null = null;
    let selectedReason = "";
    let customReason = "";

    function startRefund(record: PaymentRecord) {
        if (refundingItemId === record.id) {
            refundingItemId = null; // Toggle off
        } else {
            refundingItemId = record.id;
            selectedReason = "";
            customReason = "";
        }
    }

    async function submitRefund(record: PaymentRecord) {
        if (!selectedReason) {
            toast.error($t("paymentHistoryModal.reasons.label"));
            return;
        }

        const finalReason =
            selectedReason === "other"
                ? `Other: ${customReason}`
                : $t(`paymentHistoryModal.reasons.${selectedReason}`);

        if (isRefundingMap[record.id]) return;

        isRefundingMap[record.id] = true;
        try {
            const res = await api.post(`/api/user/payments/refund`, {
                orderId: record.id,
                reason: finalReason,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(
                    errData.message || "Failed to submit refund request",
                );
            }

            toast.success($t("paymentHistoryModal.refundRequested"));

            toast.success($t("paymentHistoryModal.refundRequested"));

            history = history.map((r) =>
                r.id === record.id ? { ...r, status: "refund_requested" } : r,
            );
            refundingItemId = null;
        } catch (error: any) {
            console.error("Refund request failed:", error);
            toast.error(error.message || "Failed to submit refund request.");
        } finally {
            isRefundingMap[record.id] = false;
        }
    }

    function formatItemName(
        name: string,
        amount: number,
        variantId?: string,
    ): string {
        if (variantId === "reward") {
            const parts = name.split(" ");
            const credits = parts[0] || "200";
            return `${credits} ${$t("paymentHistoryModal.rewardItem")}`;
        }
        if (variantId) {
            const translated = $t(`itemName.${variantId}`);
            if (translated && translated !== `itemName.${variantId}`) {
                return translated;
            }
        }
        if (amount === 1200) return $t("itemName.pack_1");
        if (amount === 5000) return $t("itemName.pack_2");
        if (amount === 10000) return $t("itemName.pack_3");
        return name;
    }

    function formatPaymentAmount(record: PaymentRecord): string {
        if (record.variant_id === "reward") {
            return $t("paymentHistoryModal.freeLabel");
        }
        if (record.amount > 0) {
            const currency = record.currency || "USD";
            const zeroDecimalCurrencies = new Set(["JPY", "KRW"]);
            const displayAmount = zeroDecimalCurrencies.has(currency)
                ? record.amount.toLocaleString()
                : (record.amount / 100).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                  });
            return `${displayAmount} ${currency}`;
        }
        return $t("paymentHistoryModal.externalPaid");
    }

    function formatCreditReason(reason: string): string {
        const normalized = reason.trim().toLowerCase();

        if (
            normalized.includes("portone") ||
            normalized.includes("paypal") ||
            normalized.includes("lemonsqueezy")
        ) {
            return $t("creditReason.purchase");
        }
        if (normalized.includes("2d chat start")) {
            return $t("creditReason.chat_start_2d");
        }
        if (normalized.includes("3d chat start")) {
            return $t("creditReason.chat_start_3d");
        }
        if (normalized.includes("live2d chat start")) {
            return $t("creditReason.chat_start_live2d");
        }
        if (normalized.includes("situation image generation")) {
            return $t("creditReason.image_generation");
        }
        if (normalized.includes("welcome bonus")) {
            return $t("creditReason.initial_bonus");
        }
        if (normalized.includes("first creation")) {
            return $t("creditReason.first_persona_bonus");
        }
        if (normalized.includes("point_conversion")) {
            return $t("creditReason.convert_point");
        }
        if (normalized.includes("refund")) {
            return $t("creditReason.refund");
        }
        if (normalized.includes("expired:")) {
            return $t("creditReason.expired");
        }
        if (normalized.includes("admin gift")) {
            return $t("creditReason.admin_bonus");
        }

        const cleanReason = reason.split(" ")[0];
        const translated = $t(`creditReason.${cleanReason}`);
        return translated && translated !== `creditReason.${cleanReason}`
            ? translated
            : reason;
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);
    });

    onDestroy(() => {
        window.removeEventListener("keydown", handleKeydown);
    });
</script>

{#if isOpen}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal-backdrop" on:click={closeModal} transition:fade>
        <div class="modal-container" on:click|stopPropagation>
            <button class="close-button" on:click={closeModal}>
                <Icon icon="ph:x-bold" />
            </button>

            <h2 class="modal-title">{$t("paymentHistoryModal.title")}</h2>

            <div class="balance-summary">
                <div class="balance-card">
                    <span class="balance-label"
                        >{$t("settingPage.credits")}</span
                    >
                    <div class="balance-value neuron">
                        <NeuronIcon size={24} color="currentColor" />

                        <span>{$st_user?.credits?.toLocaleString() || "0"}</span
                        >
                    </div>
                </div>
                <div class="balance-card">
                    <span class="balance-label"
                        >{$t("settingPage.creatorPoints")}</span
                    >
                    <div class="balance-value">
                        <Icon icon="ph:coins-fill" class="point-icon" />
                        <span
                            >{$st_user?.creator_points?.toLocaleString() ||
                                "0"}</span
                        >
                    </div>
                </div>
            </div>

            <div class="tabs">
                <button
                    class="tab-btn"
                    class:active={activeTab === "history"}
                    on:click={() => switchTab("history")}
                >
                    {$t("paymentHistoryModal.tabs.chargeHistory")}
                </button>
                <button
                    class="tab-btn"
                    class:active={activeTab === "usage"}
                    on:click={() => switchTab("usage")}
                >
                    {$t("paymentHistoryModal.tabs.usageHistory")}
                </button>
            </div>

            <div
                class="history-list-container"
                bind:this={listContainerEl}
                on:scroll={handleListScroll}
            >
                {#if isLoading}
                    <div class="loading-state">
                        <Icon icon="svg-spinners:ring-resize" width="32" />
                    </div>
                {:else if activeTab === "history"}
                    {#if history.length === 0}
                        <div class="empty-state">
                            <Icon
                                icon="ph:receipt-bold"
                                width="48"
                                style="opacity: 0.3;"
                            />
                            <p>{$t("paymentHistoryModal.noHistory")}</p>
                        </div>
                    {:else}
                        <div class="history-list">
                            {#each history as record}
                                <div class="history-item-wrapper">
                                    <div class="history-item">
                                        <div class="item-info">
                                            <div class="item-main">
                                                <span class="item-name"
                                                    >{formatItemName(
                                                        record.item_name,
                                                        record.amount,
                                                        record.variant_id,
                                                    )}</span
                                                >
                                                <span class="item-amount">
                                                    {formatPaymentAmount(
                                                        record,
                                                    )}
                                                </span>
                                            </div>
                                            <div class="item-sub">
                                                <span class="item-date"
                                                    >{new Date(
                                                        record.created_at,
                                                    ).toLocaleDateString()}</span
                                                >
                                                <span
                                                    class={`status-badge status-${record.status}`}
                                                >
                                                    {$t(
                                                        `paymentHistoryModal.status.${record.status}`,
                                                    ) || record.status}
                                                </span>
                                            </div>
                                        </div>

                                        {#if isEligibleForRefund(record) && record.status === "paid"}
                                            <button
                                                class="refund-btn"
                                                class:active={refundingItemId ===
                                                    record.id}
                                                on:click={() =>
                                                    startRefund(record)}
                                            >
                                                {$t(
                                                    "paymentHistoryModal.refund",
                                                )}
                                            </button>
                                        {/if}
                                    </div>

                                    {#if refundingItemId === record.id}
                                        <div
                                            class="refund-form"
                                            transition:fade
                                        >
                                            <div class="reason-select">
                                                <p class="reason-label">
                                                    {$t(
                                                        "paymentHistoryModal.reasons.label",
                                                    )}
                                                </p>
                                                <div class="radio-group">
                                                    {#each ["simple_change", "mistake", "error", "other"] as reason}
                                                        <label
                                                            class="radio-label"
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="refund_reason_{record.id}"
                                                                value={reason}
                                                                bind:group={
                                                                    selectedReason
                                                                }
                                                            />
                                                            {$t(
                                                                `paymentHistoryModal.reasons.${reason}`,
                                                            )}
                                                        </label>
                                                    {/each}
                                                </div>

                                                {#if selectedReason === "other"}
                                                    <input
                                                        class="custom-reason-input"
                                                        type="text"
                                                        placeholder="Detailed reason..."
                                                        bind:value={
                                                            customReason
                                                        }
                                                    />
                                                {/if}
                                            </div>
                                            <div class="form-actions">
                                                <button
                                                    class="cancel-btn"
                                                    on:click={() =>
                                                        (refundingItemId =
                                                            null)}
                                                >
                                                    {$t(
                                                        "paymentHistoryModal.cancel",
                                                    )}
                                                </button>
                                                <button
                                                    class="submit-btn"
                                                    disabled={!selectedReason ||
                                                        isRefundingMap[
                                                            record.id
                                                        ]}
                                                    on:click={() =>
                                                        submitRefund(record)}
                                                >
                                                    {#if isRefundingMap[record.id]}...{:else}{$t(
                                                            "paymentHistoryModal.submit",
                                                        )}{/if}
                                                </button>
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                {:else}
                    <!-- Usage History -->
                    {#if creditHistory.length === 0}
                        <div class="empty-state">
                            <Icon
                                icon="ph:coin-vertical"
                                width="48"
                                style="opacity: 0.3;"
                            />
                            <p>{$t("paymentHistoryModal.noUsageHistory")}</p>
                        </div>
                    {:else}
                        <div class="history-list">
                            {#each creditHistory as item}
                                <div
                                    class="history-item-wrapper"
                                    style="padding: 0.75rem;"
                                >
                                    <div class="history-item">
                                        <div class="item-info">
                                            <div class="item-main">
                                                <span class="item-name text-sm">
                                                    {formatCreditReason(
                                                        item.reason,
                                                    )}
                                                </span>
                                                <span
                                                    class="item-amount {item.amount >
                                                    0
                                                        ? 'text-green-500'
                                                        : 'text-red-400'}"
                                                >
                                                    {item.amount > 0
                                                        ? "+"
                                                        : ""}{item.amount.toLocaleString()}
                                                    <NeuronIcon
                                                        size={14}
                                                        color="currentColor"
                                                    />
                                                </span>
                                            </div>
                                            <div class="item-sub">
                                                <span
                                                    class="item-date text-xs opacity-60"
                                                >
                                                    {new Date(
                                                        item.created_at,
                                                    ).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                {/if}
                {#if isLoadingMore}
                    <div class="loading-more">
                        <Icon icon="svg-spinners:ring-resize" width="20" />
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    /* ... existing styles ... */
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    }

    .modal-container {
        position: relative;
        background: var(--card);
        color: var(--foreground);
        padding: 2rem;
        border-radius: 16px;
        width: 90%;
        max-width: 500px;
        border: 1px solid var(--border);
        max-height: 80vh;
        display: flex;
        flex-direction: column;
    }

    .close-button {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .close-button:hover {
        background: var(--muted);
    }

    .modal-title {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 0 1.5rem 0;
        text-align: center;
    }

    .balance-summary {
        display: flex;
        gap: 1rem;
        margin-bottom: 2rem;
    }

    .balance-card {
        flex: 1;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 0.75rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .balance-label {
        font-size: 0.8rem;
        color: var(--muted-foreground);
        font-weight: 500;
    }

    .balance-value {
        font-size: 1.25rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .balance-value.neuron {
        color: var(--primary);
    }

    .point-icon {
        color: #fbbf24;
    }

    .tabs {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.5rem;
    }

    .tab-btn {
        flex: 1;
        padding: 0.5rem;
        background: transparent;
        border: none;
        color: var(--muted-foreground);
        font-weight: 600;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s;
    }

    .tab-btn:hover {
        background: var(--muted);
        color: var(--foreground);
    }

    .tab-btn.active {
        background: var(--primary);
        color: var(--primary-foreground);
    }

    .history-list-container {
        flex: 1;
        overflow-y: auto;
        min-height: 200px;
    }

    .loading-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: var(--muted-foreground);
        gap: 1rem;
    }

    .history-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .loading-more {
        display: flex;
        justify-content: center;
        padding: 0.75rem 0;
        color: var(--muted-foreground);
    }

    .history-item-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
        background: var(--secondary);
        border: 1px solid var(--border);
        border-radius: 12px;
    }

    .history-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
    }

    .item-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .item-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        font-size: 1rem;
        gap: 0.5rem;
    }

    .item-amount {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        white-space: nowrap;
    }

    .item-sub {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        color: var(--muted-foreground);
    }

    .status-badge {
        padding: 0.1rem 0.5rem;
        border-radius: 10px;
        font-size: 0.75rem;
        font-weight: 600;
        background: var(--muted);
        color: var(--muted-foreground);
    }

    .status-paid {
        background: hsl(142 76% 36% / 0.1);
        color: hsl(142 76% 36%);
    }

    .status-refunded {
        background: hsl(0 84% 60% / 0.1);
        color: hsl(0 84% 60%);
    }

    .status-refund_requested {
        background: hsl(45 93% 47% / 0.1);
        color: hsl(45 93% 47%);
    }

    .status-completed {
        background: hsl(217 91% 60% / 0.1);
        color: hsl(217 91% 60%);
    }

    .refund-btn {
        padding: 0.4rem 0.8rem;
        font-size: 0.85rem;
        background: transparent;
        border: 1px solid var(--border);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        color: var(--muted-foreground);
        white-space: nowrap;
    }

    .refund-btn:hover:not(:disabled) {
        border-color: var(--destructive);
        color: var(--destructive);
        background: hsl(from var(--destructive) h s l / 0.1);
    }

    .refund-btn.active {
        background: var(--muted);
        border-color: var(--foreground);
        color: var(--foreground);
    }

    .refund-btn:disabled {
        opacity: 0.5;
        cursor: Default;
    }

    .refund-form {
        background: var(--background);
        border-radius: 8px;
        padding: 1rem;
        margin-top: 0.5rem;
        border: 1px solid var(--border);
    }

    .reason-label {
        font-size: 0.9rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
    }

    .radio-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .radio-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        cursor: pointer;
    }

    .custom-reason-input {
        width: 100%;
        padding: 0.5rem;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--input);
        color: var(--foreground);
        margin-top: 0.5rem;
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 1rem;
    }

    .cancel-btn,
    .submit-btn {
        padding: 0.4rem 1rem;
        border-radius: 6px;
        font-size: 0.9rem;
        cursor: pointer;
        border: none;
    }

    .cancel-btn {
        background: var(--muted);
        color: var(--muted-foreground);
    }

    .submit-btn {
        background: var(--primary);
        color: var(--primary-foreground);
    }

    .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>

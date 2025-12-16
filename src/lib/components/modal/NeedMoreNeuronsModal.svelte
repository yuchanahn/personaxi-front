<script lang="ts">
    import { goto } from "$app/navigation";
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import NeuronIcon from "../icons/NeuronIcon.svelte";
    import { get } from "svelte/store";
    import { st_user } from "$lib/stores/user";
    import { toast } from "$lib/stores/toast";

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

    // 충전 옵션 데이터 (실제로는 서버에서 받아올 수 있습니다)
    const rechargeOptions = [
        { neurons: 1000, price: "₩1,200" },
        { neurons: 5500, price: "₩5,900" },
        { neurons: 12000, price: "₩12,000" },
    ];

    import { api } from "$lib/api"; // Assuming api client exists
    import { notificationStore } from "$lib/stores/notification";

    let isPurchasing = false;
    let purchaseSuccess = false;
    let purchasedAmount = 0;

    function handleRecharge(amount: number) {
        if (isPurchasing) return;
        isPurchasing = true;
        purchaseSuccess = false;

        let itemId = "";
        if (amount == 1000) itemId = "neuron_1000";
        else if (amount == 5500) itemId = "neuron_5500";
        else if (amount == 12000) itemId = "neuron_12000";

        api.post("/api/shop/purchase/virtual", { itemId })
            .then((res: any) => {
                // Update local store
                st_user.update((u) => {
                    if (u) {
                        // Ensure credits is treated as number to avoid string concatenation "10" + 1000 = "101000"
                        u.credits = parseInt(String(u.credits), 10) + amount;
                    }
                    return u;
                });

                purchaseSuccess = true;
                purchasedAmount = amount;

                // Refresh notifications
                notificationStore.fetchNotifications();
                notificationStore.fetchUnreadCount();

                // Auto close after 2 seconds
                setTimeout(() => {
                    closeModal();
                    // Reset states after closing for next time
                    setTimeout(() => {
                        purchaseSuccess = false;
                        isPurchasing = false;
                    }, 500);
                }, 2000);
            })
            .catch((err) => {
                console.error(err);
                toast.error("Failed to charge credits.");
                isPurchasing = false;
            });
    }

    let current_neurons_count: number = 0;
    $: current_neurons_count = $st_user?.credits || 0;

    let isFrist = get(st_user)?.data.hasReceivedFirstCreationReward;
</script>

{#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-backdrop" on:click|self={closeModal}>
        <div class="modal-content">
            <button class="close-button" on:click={closeModal}>&times;</button>

            {#if purchaseSuccess}
                <div class="success-view">
                    <Icon
                        icon="ph:check-circle-fill"
                        color="#4caf50"
                        width="64"
                    />
                    <h2>
                        {$t("needNeuronsModal.rechargeSuccess", {
                            default: "Purchase Successful!",
                        })}
                    </h2>
                    <p class="description">
                        {purchasedAmount.toLocaleString()} Neurons added.
                    </p>
                </div>
            {:else}
                {#if isNeedNeurons}
                    <h2>{$t("needNeuronsModal.title")}</h2>
                    <p class="description">
                        {$t("needNeuronsModal.description")}
                    </p>
                {:else}
                    <h2>{$t("needNeuronsModal.rechargeTitle")}</h2>
                    <p class="description">
                        {$t("needNeuronsModal.rechargeDescription")}
                    </p>
                {/if}

                {#if !isFrist}
                    <div class="promo-box">
                        <Icon icon="ph:gift-bold" width="24" />
                        <span>{$t("needNeuronsModal.firstCreationReward")}</span
                        >
                    </div>

                    <button
                        class="go-to-edit-button"
                        on:click={() => {
                            closeModal();
                            goto("/edit");
                        }}
                    >
                        <Icon icon="ph:plus-circle-bold" width="20" />
                        <span>{$t("needNeuronsModal.getFreeNeurons")}</span>
                    </button>
                {/if}

                <div
                    style="display: flex; justify-content: center; align-items: center;"
                >
                    <p>
                        {$t("needNeuronsModal.currentNeurons", {
                            values: { count: current_neurons_count },
                        })}
                    </p>
                </div>
                <div class="recharge-options">
                    {#each rechargeOptions as option}
                        <button
                            class="recharge-button"
                            disabled={isPurchasing}
                            class:disabled={isPurchasing}
                            on:click={() => handleRecharge(option.neurons)}
                        >
                            <div
                                style="display:flex; align-items:center; gap:8px;"
                            >
                                <NeuronIcon />
                                <span class="neurons-amount">
                                    X {option.neurons.toLocaleString()}
                                </span>
                            </div>

                            {#if isPurchasing}
                                <span class="spinner">...</span>
                            {:else}
                                <span class="price-tag">{option.price}</span>
                            {/if}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    }
    .modal-content {
        background-color: #2a2a2a;
        border-radius: 16px;
        padding: 2rem;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
        position: relative;
        color: #e0e0e0;
        border: 1px solid #444;
        text-align: center;
    }
    .close-button {
        position: absolute;
        top: 10px;
        right: 15px;
        background: none;
        border: none;
        color: #888;
        font-size: 2.5rem;
        cursor: pointer;
        line-height: 1;
        transition:
            color 0.2s,
            transform 0.2s;
    }
    .close-button:hover {
        color: #fff;
        transform: rotate(90deg);
    }
    h2 {
        color: #ffffff;
        font-size: 1.8em;
        margin-top: 0;
        margin-bottom: 0.5rem;
    }
    .description {
        font-size: 1rem;
        color: #aaa;
        margin-bottom: 2rem;
    }
    .promo-box {
        background-color: rgba(74, 144, 226, 0.1);
        color: #87c3ff;
        border: 1px solid rgba(74, 144, 226, 0.3);
        border-radius: 8px;
        padding: 12px;
        margin: 1rem 0;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
    }

    .go-to-edit-button {
        background-color: #4a90e2;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 1.1em;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        margin-bottom: 1.5rem;
        transition: background-color 0.2s ease;
    }

    .go-to-edit-button:hover {
        background-color: #357abd;
    }

    .recharge-options {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .recharge-button {
        background-color: #4a4a4a;
        color: #ffffff;
        border: none;
        padding: 15px 20px;
        border-radius: 8px;
        font-size: 1.1em;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background-color 0.2s ease;
    }
    .recharge-button:hover {
        background-color: #5e5e5e;
    }
    .neurons-amount {
        font-weight: bold;
    }
    .price-tag {
        background-color: #3e6f9f;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.9em;
    }

    .recharge-button.disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .success-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem 0;
        animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>

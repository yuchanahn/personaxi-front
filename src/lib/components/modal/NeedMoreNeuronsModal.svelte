<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";

    // 부모 컴포넌트로부터 모달 가시성 상태를 양방향으로 바인딩합니다.
    export let isOpen: boolean = false;

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

    function handleRecharge(amount: number) {
        alert(`${amount} 뉴런 충전을 선택했습니다. (결제 로직 연동 필요)`);
        closeModal();
    }
</script>

{#if isOpen}
    <div class="modal-backdrop" on:click|self={closeModal}>
        <div class="modal-content">
            <button class="close-button" on:click={closeModal}>&times;</button>

            <h2>뉴런이 부족해요!</h2>

            <div class="promo-box">
                <Icon icon="ph:gift-bold" width="24" />
                <span>페르소나 최초 생성 시 100 뉴런 무료 지급!</span>
            </div>

            <p class="description">
                더 많은 대화를 나누려면 뉴런을 충전해주세요.
            </p>

            <div class="recharge-options">
                {#each rechargeOptions as option}
                    <button
                        class="recharge-button"
                        on:click={() => handleRecharge(option.neurons)}
                    >
                        <span class="neurons-amount"
                            >{option.neurons.toLocaleString()} 뉴런</span
                        >
                        <span class="price-tag">{option.price}</span>
                    </button>
                {/each}
            </div>
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
</style>

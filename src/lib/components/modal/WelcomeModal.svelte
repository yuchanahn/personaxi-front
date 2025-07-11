<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";

    export let isOpen: boolean = false;
    export let neuronAmount: number = 0; // 지급될 뉴런 양

    const dispatch = createEventDispatcher();

    function closeModal() {
        isOpen = false;
        dispatch("close");
    }

    function handleConfirm() {
        dispatch("confirm");
        closeModal();
    }
</script>

{#if isOpen}
    <div class="modal-overlay" on:click={closeModal}>
        <div class="modal-content" on:click={(e) => e.stopPropagation()}>
            <button class="close-button" on:click={closeModal}>&times;</button>

            <h2>{$t('welcomeModal.title')}</h2>

            <div class="promo-box">
                <Icon icon="ph:confetti-bold" width="24" />
                <span>{$t('welcomeModal.neuronReward', { values: { amount: neuronAmount } })}</span>
            </div>

            <p class="description">
                {$t('welcomeModal.message')}
            </p>

            <div class="modal-footer">
                <button class="confirm-button" on:click={handleConfirm}>
                    {$t('welcomeModal.confirmButton')}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
        animation: fadeIn 0.3s ease-out forwards;
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
        justify-content: center;
    }
    .promo-box svg {
        color: #facc15; /* 뉴런 아이콘 색상 */
    }
    .confirm-button {
        background-color: #4a90e2;
        color: white;
        border: none;
        padding: 0.8rem 2rem;
        border-radius: 8px;
        font-size: 1.1rem;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }
    .confirm-button:hover {
        background-color: #357abd;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes slideIn {
        from { transform: translateY(-50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }

    @media (max-width: 600px) {
        .modal-content {
            padding: 1.5rem;
            width: 95%;
        }
        h2 {
            font-size: 1.6em;
        }
        .confirm-button {
            padding: 0.7rem 1.5rem;
            font-size: 1rem;
        }
    }
</style>

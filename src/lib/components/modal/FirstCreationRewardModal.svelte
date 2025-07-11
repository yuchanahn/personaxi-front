<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import NeuronIcon from "$lib/components/icons/NeuronIcon.svelte"; // 우리가 만들었던 뉴런 아이콘

    // 부모로부터 모달의 열림/닫힘 상태를 받아와
    export let isOpen: boolean = false;

    const dispatch = createEventDispatcher();

    function closeModal() {
        isOpen = false;
        dispatch("close");
    }

    function handleKeydown(event: KeyboardEvent) {
        if (isOpen && event.key === "Escape") {
            closeModal();
        }
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);
    });
    onDestroy(() => {
        window.removeEventListener("keydown", handleKeydown);
    });
</script>

{#if isOpen}
    <div class="modal-backdrop" on:click|self={closeModal}>
        <div class="confetti" />
        <div class="confetti" />
        <div class="confetti" />

        <div class="modal-content">
            <button class="close-button" on:click={closeModal}>&times;</button>

            <div class="icon-container">
                <NeuronIcon size={64} color={"#ffc107"} />
            </div>

            <h2>첫 페르소나 생성 완료!</h2>

            <p class="reward-text">
                첫걸음을 축하하는 의미로<br />
                <span class="highlight">100 뉴런</span>을 선물로 드렸어요!
            </p>

            <p class="description">
                이제 이 뉴런으로 당신만의 '디지털 생명체'와<br />더 깊은 대화를
                나눠보세요.
            </p>

            <button class="confirm-button" on:click={closeModal}> 확인 </button>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
        overflow: hidden;
    }

    .modal-content {
        background: linear-gradient(145deg, #2e2e2e, #1a1a1a);
        border-radius: 20px;
        padding: 2.5rem 2rem;
        width: 90%;
        max-width: 420px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        position: relative;
        color: #e0e0e0;
        border: 1px solid #444;
        text-align: center;
        animation: scale-up 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) forwards;
    }

    @keyframes scale-up {
        from {
            transform: scale(0.9);
            opacity: 0;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
    }

    .close-button {
        position: absolute;
        top: 15px;
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

    .icon-container {
        margin-bottom: 1rem;
        animation: pop-in 0.5s 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)
            forwards;
        opacity: 0;
        transform: scale(0.5);
    }

    @keyframes pop-in {
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    h2 {
        color: #ffffff;
        font-size: 2em;
        margin: 0;
        font-weight: 700;
    }

    .reward-text {
        font-size: 1.2em;
        color: #e0e0e0;
        margin: 1rem 0;
        line-height: 1.6;
    }

    .reward-text .highlight {
        color: #ffc107; /* 금색 느낌의 하이라이트 */
        font-weight: bold;
        font-size: 1.2em;
    }

    .description {
        font-size: 1em;
        color: #aaa;
        margin-bottom: 2rem;
        line-height: 1.5;
    }

    .confirm-button {
        background: linear-gradient(45deg, #6a82fb, #fc5c7d);
        color: white;
        border: none;
        padding: 14px 20px;
        width: 100%;
        border-radius: 10px;
        font-size: 1.1em;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .confirm-button:hover {
        transform: translateY(-3px);
        box-shadow: 0 4px 15px rgba(252, 92, 125, 0.4);
    }

    /* 색종이 애니메이션 */
    .confetti {
        position: absolute;
        width: 10px;
        height: 10px;
        background-color: #f0f;
        animation: confetti-fall 5s linear infinite;
        opacity: 0.7;
    }
    .confetti:nth-child(2) {
        background-color: #0ff;
        animation-delay: -1s;
        animation-duration: 4s;
    }
    .confetti:nth-child(3) {
        background-color: #ff0;
        animation-delay: -3s;
        animation-duration: 6s;
    }
    @keyframes confetti-fall {
        from {
            top: -20px;
            transform: rotate(0deg);
        }
        to {
            top: 105vh;
            transform: rotate(720deg);
        }
    }
</style>

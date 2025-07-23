<script lang="ts">
    import ContentHub from "$lib/components/portal/ContentHub.svelte";
    import FeedbackModal from "$lib/components/modal/FeedbackModal.svelte"; // 👈 피드백 모달 import
    import Icon from "@iconify/svelte"; // 👈 버튼 아이콘 import

    let isFeedbackModalOpen = false;
</script>

<main>
    <ContentHub />
</main>

<button
    class="feedback-fab"
    on:click={() => (isFeedbackModalOpen = true)}
    aria-label="피드백 보내기"
>
    <Icon icon="ph:paper-plane-tilt-bold" />
    <span>피드백</span>
</button>

{#if isFeedbackModalOpen}
    <FeedbackModal on:close={() => (isFeedbackModalOpen = false)} />
{/if}

<style>
    .feedback-fab {
        position: fixed; /* 화면에 고정 */
        bottom: 2rem; /* 오른쪽 아래에 위치 */
        right: 2rem;
        z-index: 999; /* 다른 요소들 위에 오도록 */

        display: flex;
        align-items: center;
        gap: 0.5rem;

        padding: 0.8rem 1.2rem;
        background: linear-gradient(45deg, #ff79c6, #bd93f9);
        color: white;
        border: none;
        border-radius: 50px; /* 동그란 알약 모양 */
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;

        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        transition: all 0.2s ease-in-out;
    }

    .feedback-fab:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    }

    .feedback-fab :global(svg) {
        font-size: 1.2rem;
    }
</style>

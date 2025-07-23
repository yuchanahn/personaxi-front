<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { fade } from "svelte/transition";
    import { onMount, onDestroy } from "svelte";
    import Icon from "@iconify/svelte";

    const dispatch = createEventDispatcher();

    function closeModal() {
        dispatch("close");
    }

    // Escape 키를 누르면 모달이 닫히도록 설정 (사용자 경험 향상!)
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
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

<div
    class="modal-backdrop"
    on:click={closeModal}
    transition:fade={{ duration: 200 }}
>
    <div class="modal-container" on:click|stopPropagation>
        <button class="close-button" on:click={closeModal} aria-label="닫기">
            <Icon icon="ph:x-bold" />
        </button>

        <div class="modal-content">
            <h2 class="modal-title">
                <Icon icon="ph:info-duotone" />
                <span>안내</span>
            </h2>
            <p class="modal-body">
                이 프로젝트는 아직 정식 출시 버전이 아니며, 개발 및 테스트가
                진행 중인 알파 버전입니다.
                <br /><br />
                사용 중 예기치 않은 오류가 발생하거나 데이터가 변경 또는 초기화될
                수 있습니다. 정식 출시를 위해 최선을 다하고 있으니, 너그러운 양해
                부탁드립니다.
            </p>
            <button class="confirm-button" on:click={closeModal}>
                확인했습니다
            </button>
        </div>
    </div>
</div>

<style>
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
        background: #2a2a2a;
        color: #e0e0e0;
        padding: 2.5rem;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        width: 90%;
        max-width: 500px;
        border: 1px solid #444;
    }

    .close-button {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        color: #888;
        cursor: pointer;
        font-size: 1.5rem;
        line-height: 1;
        padding: 0.5rem;
        transition: color 0.2s;
    }
    .close-button:hover {
        color: white;
    }

    .modal-title {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 1rem 0;
        color: white;
    }

    .modal-body {
        font-size: 1rem;
        line-height: 1.6;
        margin: 0 0 2rem 0;
        color: #ccc;
    }

    .confirm-button {
        width: 100%;
        padding: 0.8rem;
        font-size: 1rem;
        font-weight: bold;
        color: #fff;
        background: linear-gradient(45deg, #ff79c6, #bd93f9);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    .confirm-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }
</style>

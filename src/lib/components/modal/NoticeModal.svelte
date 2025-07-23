<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { fade } from "svelte/transition";
    import { onMount, onDestroy } from "svelte";
    import Icon from "@iconify/svelte";

    const dispatch = createEventDispatcher();

    function closeModal() {
        dispatch("close");
    }

    // Escape 키를 누르면 모달이 닫히도록 설정
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
                <Icon icon="ph:sparkle-duotone" />
                <span>알파 테스트 참여 안내</span>
            </h2>

            <div class="modal-body">
                <p>
                    이 서비스는 현재 개발 중인 <strong>알파 버전</strong>으로,
                    여러분과 함께 더 나은 AI 페르소나를 만들어가고자 합니다.
                    <br /><br />
                    테스트 기간 중에는
                    <strong>예기치 않은 오류가 발생</strong>하거나 데이터가
                    임의로 <strong>변경 또는 초기화</strong>될 수 있습니다. 정식
                    출시를 위해 최선을 다하고 있으니, 너그러운 양해
                    부탁드립니다.
                </p>

                <div class="info-section">
                    <h3 class="info-title">
                        <Icon icon="ph:robot-duotone" />
                        주요 기술 스택
                    </h3>
                    <p>
                        본 서비스는 최신 기술들을 실험적으로 적용하고 있습니다.
                    </p>
                    <ul class="tech-list">
                        <li>
                            <strong>AI 모델:</strong> Google Gemini 2.5 Flash & Lite
                        </li>
                        <li><strong>음성모델(TTS):</strong> ElevenLabs</li>
                        <li><strong>3D 모델:</strong> Pixiv VRM</li>
                    </ul>
                </div>

                <div class="info-section">
                    <h3 class="info-title">
                        <Icon icon="ph:warning-circle-duotone" />
                        AI 답변 관련 주의사항
                    </h3>
                    <p>
                        AI 모델에 실험적인 프롬프팅 기술을 적용하고 있어, 때때로
                        AI가 <strong>민감하거나 부적절한 답변</strong>을 할 수
                        있습니다. 이는 더 자유롭고 인간적인 상호작용을 구현하기
                        위한 과정의 일부입니다.
                    </p>
                </div>
            </div>

            <button class="confirm-button" on:click={closeModal}>
                <span>위 내용을 모두 확인했습니다</span>
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

        /* --- 스크롤을 위한 핵심 스타일 --- */
        max-height: 85vh;
        display: flex;
        flex-direction: column;
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

    .modal-content {
        display: flex;
        flex-direction: column;
        flex-grow: 1; /* 남는 공간을 모두 차지 */
        overflow: hidden; /* 내부 body가 스크롤되도록 */
    }

    .modal-title {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 1rem 0;
        color: white;
        flex-shrink: 0; /* 제목은 줄어들지 않도록 */
    }

    .modal-body {
        text-align: left;
        font-size: 0.95rem;
        line-height: 1.6;
        margin: 0 0 2rem 0;
        color: #ccc;

        /* --- 스크롤을 위한 핵심 스타일 --- */
        flex-grow: 1;
        overflow-y: auto;
        padding-right: 1rem; /* 스크롤바와 내용 간격 */
    }

    /* --- strong 태그 스타일 수정 --- */
    .modal-body strong {
        font-weight: 700;
        color: #ffffff;
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
        flex-shrink: 0; /* 버튼은 줄어들지 않도록 */
    }
    .confirm-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }
    .confirm-button span {
        margin-left: 0.5rem;
    }

    .info-section {
        background-color: rgba(0, 0, 0, 0.2);
        border: 1px solid #444;
        border-radius: 12px;
        padding: 1rem 1.5rem;
        margin: 1.5rem 0;
    }

    .info-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.1rem;
        font-weight: 600;
        color: #e0e0e0;
        margin: 0 0 0.5rem 0;
    }

    .tech-list {
        list-style-type: "⚡️";
        padding-left: 1.5rem;
    }

    .tech-list li {
        padding-left: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .final-notice strong {
        font-weight: 700;
    }

    /* --- 스크롤바 디자인 --- */
    .modal-body::-webkit-scrollbar {
        width: 8px;
    }
    .modal-body::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
    }
    .modal-body::-webkit-scrollbar-thumb {
        background: #555;
        border-radius: 4px;
    }
    .modal-body::-webkit-scrollbar-thumb:hover {
        background: #777;
    }
</style>

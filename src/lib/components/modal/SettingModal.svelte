<!-- src/lib/components/SettingsModal.svelte 또는 새롭게 생성할 컴포넌트의 경로 -->
<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { deleteChatHistory, resetChatHistory } from "$lib/api/chat";

    export let isOpen: boolean = false; // 부모 컴포넌트로부터 모달 가시성 상태를 받음
    export let cssid: string;

    const dispatch = createEventDispatcher(); // 부모 컴포넌트로 이벤트를 보낼 디스패처 생성

    // 모달 콘텐츠 DOM 요소에 대한 참조
    let modalContent: HTMLDivElement;

    // 배경 클릭 시 모달 닫기
    function handleBackdropClick(event: MouseEvent) {
        // 클릭된 요소가 백드롭 자체일 경우에만 모달을 닫음 (모달 콘텐츠 내부 클릭 시 닫히지 않도록)
        if (event.target === event.currentTarget) {
            dispatch("close"); // 'close' 이벤트를 부모 컴포넌트로 보냄
        }
    }

    // Escape 키 누르면 모달 닫기
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            dispatch("close");
        }
    }

    // 모달 열림/닫힘 상태에 따라 keydown 이벤트 리스너 추가/제거
    $: if (isOpen) {
        document.addEventListener("keydown", handleKeydown);
    } else {
        document.removeEventListener("keydown", handleKeydown);
    }

    // --- 각 버튼 클릭 시 실행될 TODO 함수들 ---
    function handleResetChat() {
        resetChatHistory(cssid);
        dispatch("close"); // 작업 완료 후 모달 닫기
    }

    function handleDeleteChat() {
        deleteChatHistory(cssid);
        dispatch("close"); // 작업 완료 후 모달 닫기
    }

    function handleIncludeAllUtterances() {
        dispatch("close"); // 작업 완료 후 모달 닫기
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if isOpen}
    <!-- 모달 배경 (클릭 시 닫기 기능 포함) -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="settings-modal-backdrop" on:click={handleBackdropClick}>
        <!-- 모달 내용 컨테이너 -->
        <div class="settings-modal-content" bind:this={modalContent}>
            <!-- 닫기 버튼 -->
            <button class="close-button" on:click={() => dispatch("close")}
                >&times;</button
            >

            <h2>세션 설정</h2>

            <!-- 설정 버튼 그룹 -->
            <div class="button-group">
                <button class="action-button reset" on:click={handleResetChat}>
                    채팅 초기화 하기
                </button>
                <button
                    class="action-button delete"
                    on:click={handleDeleteChat}
                >
                    삭제하기
                </button>
                <button
                    class="action-button include-all"
                    on:click={handleIncludeAllUtterances}
                >
                    발화 전부 포함하기
                </button>
            </div>

            <p class="guidance-text">
                * 각 기능은 현재 캐릭터 세션에 영향을 미칩니다. 신중하게
                선택해주세요.
            </p>
        </div>
    </div>
{/if}

<style>
    /* 모달 배경 스타일 */
    .settings-modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw; /* 뷰포트 전체 너비 */
        height: 100vh; /* 뷰포트 전체 높이 */
        background-color: rgba(0, 0, 0, 0.7); /* 어둡게 배경 처리 */
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000; /* 다른 모든 요소 위에 오도록 */
        backdrop-filter: blur(5px); /* 배경 흐림 효과 (선택 사항) */
        opacity: 0; /* 초기 투명 (애니메이션 적용) */
        animation: fadeIn 0.3s forwards; /* 서서히 나타나는 애니메이션 */
    }

    /* 모달 내용 박스 스타일 */
    .settings-modal-content {
        background-color: #2a2a2a; /* 어두운 배경 */
        border-radius: 12px; /* 둥근 모서리 */
        padding: 30px;
        width: 90%; /* 화면 너비의 90% */
        max-width: 450px; /* 최대 너비 */
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.4); /* 그림자 효과 */
        position: relative;
        color: #e0e0e0; /* 밝은 글자색 */
        transform: translateY(-20px) scale(0.95); /* 초기 위치 및 크기 (애니메이션 적용) */
        animation: slideInFadeIn 0.3s forwards; /* 슬라이드 및 페이드인 애니메이션 */
        display: flex;
        flex-direction: column;
        gap: 20px; /* 버튼 간격 */
        border: 1px solid #444; /* 미묘한 테두리 */
    }

    /* 모달 나타나는 애니메이션 */
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes slideInFadeIn {
        from {
            transform: translateY(-20px) scale(0.95);
            opacity: 0;
        }
        to {
            transform: translateY(0) scale(1);
            opacity: 1;
        }
    }

    /* 닫기 버튼 스타일 */
    .close-button {
        position: absolute;
        top: 15px;
        right: 15px;
        background: none;
        border: none;
        color: #bdbdbd; /* 회색 */
        font-size: 2rem; /* 크게 */
        cursor: pointer;
        line-height: 1; /* 높이 조정 */
        padding: 5px;
        transition:
            color 0.3s ease,
            transform 0.3s ease;
    }

    .close-button:hover {
        color: #ffffff; /* 호버 시 흰색 */
        transform: rotate(90deg); /* 호버 시 회전 */
    }

    /* 제목 스타일 */
    h2 {
        text-align: center;
        color: #ffffff;
        font-size: 1.8em;
        margin-bottom: 25px;
        border-bottom: 1px solid #555; /* 하단 구분선 */
        padding-bottom: 10px;
    }

    /* 버튼 그룹 스타일 */
    .button-group {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    /* 모든 액션 버튼 공통 스타일 */
    .action-button {
        background-color: #4a4a4a;
        color: #ffffff;
        border: none;
        padding: 15px 20px;
        border-radius: 8px;
        font-size: 1.1em;
        cursor: pointer;
        transition:
            background-color 0.3s ease,
            transform 0.2s ease,
            box-shadow 0.3s ease;
        width: 100%; /* 너비를 꽉 채움 */
        font-weight: bold;
        letter-spacing: 0.5px;
    }

    .action-button:hover {
        background-color: #5e5e5e;
        transform: translateY(-2px); /* 살짝 위로 이동 */
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    }

    .action-button:active {
        transform: translateY(0);
        box-shadow: none;
    }

    /* 각 버튼별 색상 (원하는 대로 조정) */
    .action-button.reset {
        background-color: #3f51b5; /* 파란색 계열 */
    }
    .action-button.reset:hover {
        background-color: #303f9f;
    }

    .action-button.delete {
        background-color: #d32f2f; /* 붉은색 계열 */
    }
    .action-button.delete:hover {
        background-color: #b71c1c;
    }

    .action-button.include-all {
        background-color: #4caf50; /* 초록색 계열 */
    }
    .action-button.include-all:hover {
        background-color: #388e3c;
    }

    /* 안내 문구 스타일 */
    .guidance-text {
        font-size: 0.9em;
        color: #999;
        text-align: center;
        margin-top: 20px;
    }

    /* 모바일 반응형 조정 */
    @media (max-width: 600px) {
        .settings-modal-content {
            padding: 20px;
            max-width: 95%; /* 작은 화면에서는 거의 전체 너비 */
            margin: 0 10px; /* 좌우 마진 */
        }

        h2 {
            font-size: 1.5em;
            margin-bottom: 15px;
        }

        .action-button {
            padding: 12px 15px;
            font-size: 1em;
        }

        .close-button {
            font-size: 1.5rem;
            top: 10px;
            right: 10px;
        }
    }
</style>

<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { placeBid } from "$lib/api/auction"; // 경매 API 함수
    import { quintOut } from "svelte/easing"; // 애니메이션 이징 함수
    import { fly } from "svelte/transition"; // Svelte 애니메이션
    import { t } from "svelte-i18n";

    export let personaId: string;
    export let currentHighestBid: number = 0; // 현재 최고 입찰가 (외부에서 받음)
    export let minBidIncrement: number = 10; // 최소 입찰 단위 (외부에서 받음, 기본값 10)

    const dispatch = createEventDispatcher();

    let amount: number = currentHighestBid + minBidIncrement; // 초기 입찰가는 최고 입찰가 + 최소 단위
    let error: string = "";
    let isLoading: boolean = false; // 입찰 중 로딩 상태

    // 모달 닫기 함수 (외부 클릭 포함)
    function closeModal() {
        dispatch("close");
    }

    async function submit() {
        if (amount <= currentHighestBid) {
            error = $t('bidModal.bidTooLow', { values: { currentHighestBid } });
            return;
        }
        if (amount % minBidIncrement !== 0) {
            error = $t('bidModal.bidIncrementError', { values: { minBidIncrement } });
            return;
        }

        isLoading = true; // 로딩 시작
        error = ""; // 이전 에러 초기화

        try {
            await placeBid(personaId, amount);
            dispatch("close"); // 성공하면 모달 닫기
        } catch (e: any) {
            error = e.message || $t('bidModal.bidError');
            // dispatch("error", e.message); // 외부로 에러 전달 필요시 활성화
        } finally {
            isLoading = false; // 로딩 종료
        }
    }

    // Esc 키로 모달 닫기
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            closeModal();
        }
    }
</script>

<div
    class="modal-backdrop"
    on:click|self={closeModal}
    on:keydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
>
    <div
        class="modal-content"
        transition:fly={{ y: -50, duration: 300, easing: quintOut }}
    >
        <h2>{$t('bidModal.title')}</h2>

        <div class="bid-info">
            <p><strong>{$t('bidModal.currentHighestBid')}:</strong> {currentHighestBid} {$t('bidModal.credits')}</p>
            <p><strong>{$t('bidModal.minBidIncrement')}:</strong> {minBidIncrement} {$t('bidModal.credits')}</p>
        </div>

        <div class="input-group">
            <label for="bid-amount">{$t('bidModal.bidCredits')}:</label>
            <input
                id="bid-amount"
                type="number"
                bind:value={amount}
                min={currentHighestBid + minBidIncrement}
                step={minBidIncrement}
                placeholder={`${currentHighestBid + minBidIncrement} ${$t('bidModal.minBidPlaceholder')}`}
                disabled={isLoading}
            />
        </div>

        {#if error}
            <p class="error-message">{error}</p>
        {/if}

        <div class="button-group">
            <button
                on:click={submit}
                disabled={isLoading}
                class="submit-button"
            >
                {#if isLoading}
                    {$t('bidModal.biddingInProgress')}
                {:else}
                    {$t('bidModal.placeBid')}
                {/if}
            </button>
            <button
                on:click={closeModal}
                disabled={isLoading}
                class="cancel-button">{$t('bidModal.cancel')}</button
            >
        </div>
    </div>
</div>

<style>
    /* 모달 배경 */
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.6); /* 어두운 배경 */
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        /* 키보드 접근성: Tab으로 포커스 가능하도록 */
        outline: none;
    }

    /* 모달 내용 컨테이너 */
    .modal-content {
        background: #fff;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        width: 90%;
        max-width: 400px; /* 최대 너비 제한 */
        text-align: center;
        color: #333;
        box-sizing: border-box; /* 패딩이 너비에 포함되도록 */
        position: relative; /* 애니메이션 기준점 */
    }

    h2 {
        color: #333;
        margin-bottom: 25px;
        font-size: 1.8em;
    }

    .bid-info {
        background-color: #f5f5f5;
        padding: 10px 15px;
        border-radius: 5px;
        margin-bottom: 20px;
        font-size: 0.95em;
        text-align: left;
    }

    .bid-info p {
        margin: 5px 0;
    }

    /* 입력 그룹 */
    .input-group {
        margin-bottom: 20px;
        text-align: left;
    }

    .input-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: bold;
        color: #555;
    }

    input[type="number"] {
        width: calc(100% - 20px); /* 패딩 고려 */
        padding: 12px 10px;
        border: 1px solid #ddd;
        border-radius: 5px;
        font-size: 1.1em;
        text-align: center;
        box-sizing: border-box;
    }

    input[type="number"]:focus {
        border-color: #007bff;
        outline: none;
        box-shadow: 0 0 5px rgba(0, 123, 255, 0.3);
    }

    /* 에러 메시지 */
    .error-message {
        color: #d9534f;
        margin-top: -10px; /* 인풋과의 간격 조절 */
        margin-bottom: 15px;
        font-size: 0.9em;
        font-weight: bold;
    }

    /* 버튼 그룹 */
    .button-group {
        display: flex;
        justify-content: space-between;
        gap: 10px; /* 버튼 사이 간격 */
        margin-top: 25px;
    }

    button {
        flex-grow: 1; /* 버튼이 공간을 균등하게 차지 */
        padding: 12px 20px;
        border: none;
        border-radius: 5px;
        font-size: 1.1em;
        cursor: pointer;
        transition:
            background-color 0.2s ease,
            transform 0.1s ease;
        font-weight: bold;
    }

    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    /* 제출 버튼 */
    .submit-button {
        background-color: #007bff;
        color: white;
    }

    .submit-button:not(:disabled):hover {
        background-color: #0056b3;
        transform: translateY(-2px);
    }

    /* 취소 버튼 */
    .cancel-button {
        background-color: #6c757d;
        color: white;
    }

    .cancel-button:not(:disabled):hover {
        background-color: #545b62;
        transform: translateY(-2px);
    }
</style>

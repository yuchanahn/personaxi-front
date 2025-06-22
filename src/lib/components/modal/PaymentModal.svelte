<script lang="ts">
    import { createEventDispatcher } from "svelte";

    // props로 모달 상태와 크레딧 부족 여부를 받음
    export let isOpen: boolean = false;
    export let isCreditLow: boolean = false; // 크레딧 부족 상태 여부

    const dispatch = createEventDispatcher();

    // 결제 아이템 타입 정의 (간단하게)
    interface PaymentItem {
        id: string;
        name: string;
        credits: number;
        price: number;
    }

    // 랜덤 결제 아이템 목록 (더 추가할 수 있음!)
    let paymentItems: PaymentItem[] = [
        { id: "pack_100", name: "기본 크레딧 팩", credits: 100, price: 5000 },
        { id: "pack_300", name: "실속 크레딧 팩", credits: 300, price: 12000 },
        {
            id: "pack_500",
            name: "프리미엄 크레딧 팩",
            credits: 500,
            price: 18000,
        },
        {
            id: "pack_1000",
            name: "무제한 크레딧 팩 (한정)",
            credits: 1000,
            price: 30000,
        },
        { id: "pack_50", name: "맛보기 크레딧", credits: 50, price: 2800 },
    ];

    let randomItems: PaymentItem[] = [];

    // 모달 열릴 때마다 랜덤 아이템 3개 선택 (최대 5개)
    $: if (isOpen) {
        selectRandomItems();
    }

    function selectRandomItems() {
        const shuffled = [...paymentItems].sort(() => 0.5 - Math.random());
        randomItems = shuffled.slice(
            0,
            Math.min(shuffled.length, 3 + Math.floor(Math.random() * 3)),
        ); // 3개에서 5개 사이 랜덤
    }

    function closeModal() {
        isOpen = false;
        dispatch("close");
    }

    function handlePurchase(item: PaymentItem) {
        // 실제 결제 로직은 여기서 처리 (아마 서버 API 호출?)
        console.log(
            `결제 요청: ${item.name} (${item.price}원) - ${item.credits} 크레딧 추가`,
        );
        alert(
            `"${item.name}" 결제 기능을 개발 중입니다! (실제 결제는 이루어지지 않습니다.)`,
        ); // 실제 결제 로직 추가
        // 결제 성공 후, 크레딧 업데이트 및 모달 닫기
        // dispatch('purchaseSuccess', { credits: item.credits }); // 필요한 경우 이벤트 발송
        closeModal();
    }

    // esc 키로 모달 닫기
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            closeModal();
        }
    }
</script>

{#if isOpen}
    <div class="modal-overlay" on:click={closeModal} on:keydown={handleKeydown}>
        <div class="modal-content" on:click|stopPropagation>
            <button class="close-button" on:click={closeModal}>&times;</button>

            {#if isCreditLow}
                <div class="credit-low-alert">
                    <h2>⚠️ 크레딧이 부족합니다!</h2>
                    <p>
                        더 많은 캐릭터 챗을 이용하시려면 크레딧을 충전해주세요.
                    </p>
                    <p>
                        아래에서 원하는 크레딧 팩을 선택하여 충전할 수 있습니다.
                    </p>
                </div>
            {:else}
                <h2>크레딧 충전하기</h2>
                <p>원하는 크레딧 팩을 선택하여 더 많은 기능을 이용해보세요.</p>
            {/if}

            <div class="payment-items-grid">
                {#each randomItems as item (item.id)}
                    <div class="item-card">
                        <h3>{item.name}</h3>
                        <p class="credits">{item.credits} 크레딧</p>
                        <p class="price">{item.price.toLocaleString()}원</p>
                        <button on:click={() => handlePurchase(item)}
                            >구매하기</button
                        >
                    </div>
                {/each}
            </div>

            <div class="modal-footer">
                <p>결제 관련 문의는 고객센터로 연락주세요.</p>
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
        background: rgba(0, 0, 0, 0.7); /* 배경 오버레이 */
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000; /* 다른 요소 위에 표시 */
        backdrop-filter: blur(5px); /* 뒤에 있는 화면 블러 처리 */
    }

    .modal-content {
        background: var(--color-bg); /* 테마 배경색 */
        padding: 2.5rem;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
        position: relative;
        width: 90%;
        max-width: 700px; /* 최대 너비 제한 */
        text-align: center;
        color: var(--color-text); /* 텍스트 색상 */
        box-sizing: border-box;
        animation: fadeInScale 0.3s ease-out forwards;
    }

    .close-button {
        position: absolute;
        top: 15px;
        right: 20px;
        background: none;
        border: none;
        font-size: 2rem;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: color 0.2s ease;
    }

    .close-button:hover {
        color: var(--color-accent);
    }

    h2 {
        color: var(--color-primary); /* 주요 색상 */
        margin-bottom: 1rem;
        font-size: 2em;
    }

    p {
        margin-bottom: 1.5rem;
        line-height: 1.5;
    }

    .credit-low-alert {
        background: rgba(255, 99, 71, 0.15); /* 붉은색 계열 경고 배경 */
        border: 1px solid tomato;
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 2rem;
        color: tomato;
    }

    .credit-low-alert h2 {
        color: tomato;
        margin-top: 0.5rem;
        font-size: 1.8em;
    }

    .credit-low-alert p {
        margin-bottom: 0.5rem;
        color: var(--color-text);
    }

    .payment-items-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2.5rem;
        justify-content: center; /* 아이템 중앙 정렬 */
    }

    .item-card {
        background: var(--color-card-bg); /* 카드 배경색 */
        border: 1px solid var(--color-border);
        border-radius: 10px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
    }

    .item-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    }

    .item-card h3 {
        font-size: 1.3em;
        color: var(--color-primary);
        margin-bottom: 0.5rem;
    }

    .item-card .credits {
        font-size: 1.8em;
        font-weight: bold;
        color: var(--color-accent);
        margin-bottom: 0.5rem;
    }

    .item-card .price {
        font-size: 1.2em;
        color: var(--color-text-secondary);
        margin-bottom: 1.5rem;
    }

    .item-card button {
        background: var(--color-button-bg); /* 버튼 배경색 */
        color: var(--color-button-text); /* 버튼 텍스트 색상 */
        border: none;
        padding: 0.8rem 1.5rem;
        border-radius: 25px;
        font-size: 1em;
        cursor: pointer;
        transition:
            background-color 0.2s ease,
            transform 0.1s ease;
        min-width: 120px;
    }

    .item-card button:hover {
        background-color: var(--color-button-hover);
        transform: translateY(-2px);
    }

    .modal-footer {
        margin-top: 2rem;
        font-size: 0.9em;
        color: var(--color-text-secondary);
    }

    /* 모달 애니메이션 */
    @keyframes fadeInScale {
        from {
            opacity: 0;
            transform: scale(0.9);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    /* 반응형 */
    @media (max-width: 600px) {
        .modal-content {
            padding: 1.5rem;
            width: 95%;
        }
        h2 {
            font-size: 1.6em;
        }
        .payment-items-grid {
            grid-template-columns: 1fr; /* 모바일에서 한 줄에 하나씩 */
        }
    }
</style>

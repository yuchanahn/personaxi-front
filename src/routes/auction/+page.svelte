<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { page } from "$app/stores";
    import type { Persona } from "$lib/types";
    import { loadPersona } from "$lib/api/edit_persona";
    import { fetchAuctionStatus } from "$lib/api/auction";
    import BroadcastChatWindow from "$lib/components/live/BroadcastChatWindow.svelte";
    import BroadcastChatInput from "$lib/components/live/BroadcastChatInput.svelte";
    import {
        connectBroadcastSocket,
        sendChatMessage,
    } from "$lib/socket/broadcast";
    import {
        setBroadcastModel,
        type BroadcastMessage,
    } from "$lib/services/broadcast";
    import { test as viewVrmInCanvas } from "$lib/vrm/test";
    import { writable } from "svelte/store";
    // 상단 script 안에 추가
    import { placeBid } from "$lib/api/auction";
    import BidModal from "$lib/components/modal/BidModal.svelte";
    import { t } from "svelte-i18n";

    let showBidModal = false;
    let bidError = "";

    let persona: Persona | null = null;
    let auctionStatus: {
        highestBid: number;
        endAt: string;
        winner: string;
    } | null = null;
    let canvas: HTMLCanvasElement;
    let socket: WebSocket | null = null;

    export const broadcastMessages = writable<BroadcastMessage[]>([]);

    onMount(async () => {
        const id = $page.url.searchParams.get("c");
        if (!id) return;

        persona = await loadPersona(id);

        try {
            auctionStatus = await fetchAuctionStatus(id);
        } catch (error) {
            console.error("fetchAuctionStatus :", error);
        }
        socket = connectBroadcastSocket(persona?.id || "fuck", (packet) => {
            /*
                type Bid struct {
                	UserID string    `json:"userId"`
                	Amount int64     `json:"amount"`
                	Time   time.Time `json:"time"`
                }
            */
            if (packet.type === "bid") {
                let bid = packet.bid;
                if (!auctionStatus) return;
                auctionStatus.highestBid = bid.amount;
                auctionStatus.winner = bid.userId;
            } else if (packet.type === "chat") {
                broadcastMessages.update((prev) => [
                    ...prev,
                    { user: $t("auctionPage.bidder"), msg: packet.msg as string },
                ]);
            }
        });

        try {
            if (persona) {
            }
            //viewVrmInCanvas(canvas, persona)
            //    .then((m) => setBroadcastModel(m))
            //    .finally();
        } catch (error) {
            console.error("Error loading VRM:", error);
        }
    });

    function handleSend(msg: string) {
        sendChatMessage(msg);
    }

    let remainingTimeFormatted: string = $t("auctionPage.calculatingTime");
    let countdownInterval: number; // setInterval의 반환 값 타입을 지정

    // 시간을 "1일 1시 1분 1초" 형식으로 포맷하는 함수
    function formatTimeDifference(ms: number): string {
        if (ms <= 0) {
            return $t("auctionPage.auctionEnded");
        }

        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        const s = seconds % 60;
        const m = minutes % 60;
        const h = hours % 24;

        let parts: string[] = [];
        if (days > 0) parts.push(`${days}${$t("auctionPage.dayUnit")}`);
        if (h > 0) parts.push(`${h}${$t("auctionPage.hourUnit")}`);
        if (m > 0) parts.push(`${m}${$t("auctionPage.minuteUnit")}`);
        // 남은 시간이 1분 미만이거나, '일', '시', '분'이 모두 0일 경우 '초'를 표시
        if (s > 0 || parts.length === 0) parts.push(`${s}${$t("auctionPage.secondUnit")}`);

        // 모든 단위가 0일 경우 (예: ms가 0과 1000 사이) "0초"로 표시될 것
        if (parts.length === 0 && ms > 0) {
            return `0${$t("auctionPage.secondUnit")}`; // 아주 짧은 시간이 남았을 때
        }

        return parts.join(" ");
    }

    // 카운트다운을 업데이트하는 함수
    function updateCountdown() {
        if (!auctionStatus || !auctionStatus.endAt) {
            remainingTimeFormatted = $t("auctionPage.noTimeInfo");
            if (countdownInterval) {
                clearInterval(countdownInterval);
            }
            return;
        }

        const endTime = new Date(auctionStatus.endAt).getTime(); // 문자열을 밀리초 타임스탬프로 변환
        const now = Date.now(); // 현재 시간 (밀리초)
        const timeLeft = endTime - now; // 남은 시간 (밀리초)

        remainingTimeFormatted = formatTimeDifference(timeLeft);

        // 시간이 0 이하면 인터벌 중지
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
        }
    }

    // `auctionStatus` prop이 변경될 때마다 (초기 로드 포함) 카운트다운을 시작하거나 재설정
    // Svelte의 반응형 구문 (`$:`)을 활용
    $: if (auctionStatus) {
        if (countdownInterval) {
            clearInterval(countdownInterval); // 이전 인터벌이 있다면 중지
        }
        updateCountdown(); // 즉시 한 번 업데이트
        countdownInterval = setInterval(updateCountdown, 1000); // 1초마다 업데이트 설정
    }

    // 컴포넌트가 파괴될 때 인터벌을 반드시 정리해줘야 메모리 누수를 막을 수 있음
    onDestroy(() => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
    });
</script>

<div class="auction-live-layout">
    <canvas bind:this={canvas} class="vrm-canvas"></canvas>

    <div class="info-sidebar">
        <div class="auction-info">
            {#if persona}
                <h2 class="persona-name">{persona.name}</h2>
                <p class="user-credits">
                    {$t("auctionPage.myCredits")}: <strong>{255}</strong>
                </p>
            {/if}

            {#if auctionStatus}
                <div class="status-box">
                    <p>
                        <strong>{$t("auctionPage.highestBid")}:</strong>
                        <span class="highlight-bid"
                            >{auctionStatus.highestBid}</span
                        > {$t("auctionPage.creditsUnit")}
                    </p>
                    <p>
                        <strong>{$t("auctionPage.remainingTime")}:</strong>
                        <span class="highlight-time"
                            >{remainingTimeFormatted}</span
                        >
                    </p>
                    <p>
                        <strong>{$t("auctionPage.currentLeader")}:</strong>
                        <span class="highlight-winner"
                            >{auctionStatus.winner}</span
                        >
                    </p>
                </div>
            {/if}

            <button class="bid-button" on:click={() => (showBidModal = true)}>
                {$t("auctionPage.placeBidButton")}
            </button>
            {#if bidError}
                <p class="error-message">{bidError}</p>
            {/if}
        </div>

        <div class="chat-area">
            <BroadcastChatWindow messages={broadcastMessages} />
            <BroadcastChatInput onSend={handleSend} />
        </div>
    </div>
</div>

{#if showBidModal && persona}
    <BidModal
        personaId={persona.id}
        currentHighestBid={auctionStatus?.highestBid || 0}
        minBidIncrement={10}
        on:close={() => (showBidModal = false)}
        on:error={(e) => (bidError = e.detail)}
    />
{/if}

<style>
    /* ✨ 전체 페이지 기본 스타일 (body, html 등에 적용될 수 있음) */
    :global(body) {
        margin: 0;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        background-color: #121212; /* 전체 배경을 더 어둡게 */
        color: #e0e0e0; /* 기본 텍스트 색상 */
        overflow: hidden; /* 스크롤바 숨김 */
    }

    .auction-live-layout {
        display: flex;
        height: 100vh;
        overflow: hidden;
        background-color: #1a1a1a; /* 레이아웃 배경색 */
    }

    .vrm-canvas {
        width: 65%; /* 캔버스 비율 조금 더 늘림 */
        background: #000; /* VRM 배경은 검정으로 유지 */
        flex-shrink: 0; /* 캔버스가 줄어들지 않도록 */
    }

    .info-sidebar {
        width: 35%; /* 사이드바 비율 조정 */
        display: flex;
        flex-direction: column;
        background: #1f1f1f; /* 사이드바 배경색 */
        box-shadow: -2px 0 5px rgba(0, 0, 0, 0.3); /* 그림자 추가 */
    }

    .auction-info {
        padding: 1.5rem; /* 패딩 증가 */
        border-bottom: 1px solid #333; /* 구분선 */
        background: #252525; /* 경매 정보 섹션 배경 */
        flex-shrink: 0; /* 내용이 많아도 줄어들지 않도록 */
        text-align: center; /* 가운데 정렬 */
    }

    .persona-name {
        margin-top: 0;
        margin-bottom: 0.8rem;
        font-size: 2.2rem; /* 제목 크기 키움 */
        color: #f0f0f0; /* 제목 색상 */
        font-weight: 600;
        letter-spacing: -0.5px;
    }

    .user-credits {
        font-size: 1.1rem;
        color: #bbb;
        margin-bottom: 1.5rem;
    }

    .status-box {
        margin: 1.5rem 0; /* 마진 증가 */
        background: #1a1a1a; /* 상태 박스 배경 */
        padding: 1.2rem;
        border-radius: 8px; /* 둥근 모서리 */
        box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2); /* 내부 그림자 */
        text-align: left; /* 텍스트는 왼쪽 정렬 */
    }

    .status-box p {
        margin: 0.6rem 0;
        font-size: 1.05rem;
        line-height: 1.4;
    }

    .status-box strong {
        color: #aaa; /* 레이블 색상 */
        margin-right: 0.5rem;
    }

    .highlight-bid {
        color: #4caf50; /* 초록색 강조 */
        font-weight: bold;
        font-size: 1.2rem;
    }

    .highlight-time {
        color: #ffc107; /* 노란색 강조 */
        font-weight: bold;
        font-size: 1.2rem;
    }

    .highlight-winner {
        color: #2196f3; /* 파란색 강조 */
        font-weight: bold;
        font-size: 1.2rem;
    }

    .bid-button {
        background: #007bff; /* 파란색으로 변경 */
        color: white;
        padding: 0.9rem 2rem;
        border: none;
        border-radius: 6px;
        font-size: 1.1rem;
        cursor: pointer;
        width: 80%; /* 버튼 너비 */
        margin: 0 auto; /* 가운데 정렬 */
        display: block; /* 블록 요소로 만들어 margin:auto 작동 */
        transition:
            background 0.2s ease,
            transform 0.1s ease;
    }

    .bid-button:hover {
        background: #0056b3; /* 호버 시 진한 파랑 */
        transform: translateY(-2px); /* 살짝 위로 */
    }

    .bid-button:active {
        transform: translateY(0); /* 클릭 시 원위치 */
    }

    .error-message {
        color: #ff6b6b; /* 에러 메시지 색상 */
        font-size: 0.9rem;
        margin-top: 0.8rem;
        text-align: center;
    }

    .chat-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-top: 1px solid #333; /* 채팅 영역 상단 구분선 */
    }

    /* BroadcastChatWindow와 BroadcastChatInput 내부 스타일은 해당 컴포넌트에서 관리 */
</style>

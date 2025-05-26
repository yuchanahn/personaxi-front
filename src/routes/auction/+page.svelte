<script lang="ts">
    import { onMount } from "svelte";
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
        socket = connectBroadcastSocket((packet) => {
            let msg = packet as {
                type: string;
                msg: string;
            };
            broadcastMessages.update((prev) => [
                ...prev,
                { user: "입찰자", msg: msg.msg },
            ]);
        });

        try {
            if (persona)
                viewVrmInCanvas(canvas, persona)
                    .then((m) => setBroadcastModel(m))
                    .finally();
        } catch (error) {
            console.error("Error loading VRM:", error);
        }
    });

    function handleSend(msg: string) {
        sendChatMessage(msg);
    }
</script>

<div class="auction-live-layout">
    <canvas bind:this={canvas} class="vrm-canvas"></canvas>

    <div class="info-sidebar">
        <div class="auction-info">
            {#if persona}
                <h2>{persona.name}</h2>
                <p>{persona.style}</p>
            {/if}

            {#if auctionStatus}
                <div class="status">
                    <p>
                        <strong>Highest Bid:</strong>
                        {auctionStatus.highestBid} credits
                    </p>
                    <p>
                        <strong>Auction Ends In:</strong>
                        {auctionStatus.endAt}
                    </p>
                    <p>
                        <strong>Current Leader:</strong>
                        {auctionStatus.winner}
                    </p>
                </div>
            {/if}

            <button class="bid-button" on:click={() => (showBidModal = true)}>
                Place a Bid
            </button>
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
        on:close={() => (showBidModal = false)}
        on:error={(e) => (bidError = e.detail)}
    />
{/if}

<style>
    .auction-live-layout {
        display: flex;
        height: 100vh;
        overflow: hidden;
    }

    .vrm-canvas {
        width: 60%;
        background: black;
    }

    .info-sidebar {
        width: 40%;
        display: flex;
        flex-direction: column;
        background: #1e1e1e;
        color: white;
    }

    .auction-info {
        padding: 1rem;
        border-bottom: 1px solid #333;
        background: #292929;
    }

    .status {
        margin: 1rem 0;
        background: #222;
        padding: 1rem;
        border-radius: 0.5rem;
    }

    .bid-button {
        background: #e91e63;
        color: white;
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 0.5rem;
        font-size: 1rem;
        cursor: pointer;
    }

    .bid-button:hover {
        background: #c2185b;
    }

    .chat-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
</style>

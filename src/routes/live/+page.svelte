<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import {
        connectBroadcastSocket,
        sendChatMessage,
    } from "$lib/socket/broadcast";
    import {
        handleBroadcastReaction,
        setBroadcastModel,
        type BroadcastMessage,
    } from "$lib/services/broadcast";
    import type { Persona } from "$lib/types";
    import { test as viewVrmInCanvas } from "$lib/vrm/test";
    import BroadcastChatWindow from "$lib/components/live/BroadcastChatWindow.svelte";
    import BroadcastChatInput from "$lib/components/live/BroadcastChatInput.svelte";
    import { writable } from "svelte/store";

    let persona: Persona | null = null;
    let canvas: HTMLCanvasElement;
    let socket: WebSocket | null = null;

    persona = {
        name: "test",
    } as Persona;

    export const broadcastMessages = writable<BroadcastMessage[]>([]);
    broadcastMessages.set([
        { user: "시청자1", msg: "이 캐릭터 뭐야 ㅋㅋ" },
        { user: "시청자2", msg: "존예다 ㄹㅇ" },
        { user: "시청자3", msg: "대답함??" },
    ]);

    onMount(() => {
        socket = connectBroadcastSocket((packet) => {
            let msg = packet as {
                type: string;
                msg: string;
            };

            broadcastMessages.update((prev) => [
                ...prev,
                { user: "나", msg: msg.msg },
            ]);
            //handleBroadcastReaction(packet);
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

    onDestroy(() => {
        if (socket) {
            console.log("🔌 WebSocket 연결 해제");
            socket.close();
        }
    });

    function handleSend(msg: string) {
        sendChatMessage(msg);
    }
</script>

<div id="broadcast-layout">
    <canvas bind:this={canvas} class="vrm-canvas"></canvas>

    <div class="sidebar">
        <div class="persona-header">
            <h2>방송 콘텐츠</h2>
        </div>
        <BroadcastChatWindow messages={broadcastMessages} />
        <BroadcastChatInput onSend={handleSend} />
    </div>
</div>

<style>
    #broadcast-layout {
        display: flex;
        height: 100vh;
        overflow: hidden;
    }

    .vrm-canvas {
        width: 60%;
        background: black;
    }

    .sidebar {
        width: 40%;
        display: flex;
        flex-direction: column;
        background: #1e1e1e;
        color: white;
    }

    .persona-header {
        padding: 1rem;
        border-bottom: 1px solid #333;
        background: #292929;
    }
</style>

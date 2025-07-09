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
    import { loadPersona } from "$lib/api/edit_persona";
    import { page } from "$app/stores";
    import { t } from "svelte-i18n";

    let persona: Persona | null = null;
    let canvas: HTMLCanvasElement;
    let socket: WebSocket | null = null;
    let lastSessionId: string | null = null;

    persona = {
        name: "test",
    } as Persona;

    export const broadcastMessages = writable<BroadcastMessage[]>([]);
    broadcastMessages.set([
        { user: $t("livePage.viewer1"), msg: $t("livePage.viewer1Message") },
        { user: $t("livePage.viewer2"), msg: $t("livePage.viewer2Message") },
        { user: $t("livePage.viewer3"), msg: $t("livePage.viewer3Message") },
    ]);

    onMount(async () => {
        const sessionId = $page.url.searchParams.get("c");
        if (sessionId !== lastSessionId) {
            lastSessionId = sessionId;
            if (sessionId) {
                persona = await loadPersona(sessionId);
            }
        }

        if (!persona) return;

        socket = connectBroadcastSocket(persona.id, (packet) => {
            let msg = packet as {
                type: string;
                msg: string;
            };

            broadcastMessages.update((prev) => [
                ...prev,
                { user: $t("livePage.me"), msg: msg.msg },
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
            console.log($t("livePage.websocketDisconnected"));
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
            <h2>{$t("livePage.broadcastContent")}</h2>
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
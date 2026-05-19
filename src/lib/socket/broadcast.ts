// WebSocket 연결 및 송수신 처리 (순수 WebSocket 버전)

import { branding } from "$lib/branding/config";
import { isLocalWebHost } from "$lib/utils/appShell";

let socket: WebSocket | null = null;

function getBroadcastSocketUrl(personaId: string): string {
    const baseUrl = isLocalWebHost()
        ? "http://localhost:8080"
        : branding.apiOrigin;
    const url = new URL("/ws/broadcast", baseUrl);
    url.searchParams.set("personaId", personaId);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
}

export function connectBroadcastSocket(
    personaId: string, // <-- personaId 인자를 추가해줘
    onReaction: (packet: any) => void,
    onConnect?: () => void,
    onDisconnect?: () => void
): WebSocket {
    socket = new WebSocket(getBroadcastSocketUrl(personaId));

    socket.onopen = () => {
        console.log("broadcast.connected");
        onConnect?.();
    };

    socket.onclose = () => {
        console.warn("broadcast.disconnected");
        onDisconnect?.();
    };

    socket.onmessage = (event) => {
        try {
            const packet = JSON.parse(event.data);
            onReaction(packet);
        } catch (e) {
            console.warn("broadcast.jsonParseFailed")
            console.error(e);
        }
    };

    return socket;
}

export function sendChatMessage(message: string) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "chat", msg: message }));
    } else {
        console.warn("broadcast.sendFailed");
    }
}

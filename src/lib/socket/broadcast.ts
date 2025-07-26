// WebSocket 연결 및 송수신 처리 (순수 WebSocket 버전)

let socket: WebSocket | null = null;

export function connectBroadcastSocket(
    personaId: string, // <-- personaId 인자를 추가해줘
    onReaction: (packet: any) => void,
    onConnect?: () => void,
    onDisconnect?: () => void
): WebSocket {
    socket = new WebSocket(`ws://localhost:8080/ws/broadcast?personaId=${personaId}`);

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

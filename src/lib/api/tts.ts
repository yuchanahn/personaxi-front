import { api } from '$lib/api';
import { API_BASE_URL } from '$lib/constants';
import { ttsState } from '$lib/stores/ttsStore';

let socket: WebSocket | null = null;
let audioContext: AudioContext | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function initializeAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.AudioContext)();
        console.log("🎶 AudioContext 초기화됨");

        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('AudioContext resumed successfully');
            }).catch(e => console.error("AudioContext resume failed:", e));
        }
    }
}

function startHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    heartbeatInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            console.log('❤️ Sending heartbeat ping');
            socket.send(JSON.stringify({ type: 'ping' }));
        }
    }, 30000); // 30초마다
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

export function connectTTSSocket(speek?: (audio: ArrayBuffer) => void): WebSocket {
    socket = api.ws('/ws/tts', {})


    if (!socket) {
        console.error("❌ WebSocket 연결 실패");
        ttsState.set('disconnected');
    }

    console.log("🔗 tts WebSocket 연결 시도...");
    ttsState.set('connecting');

    socket.onopen = () => {
        console.log("✅ tts WebSocket 연결됨");
        ttsState.set('connected');
        startHeartbeat();
    };

    socket.onclose = () => {
        console.warn("⚠️ tts WebSocket 끊김");
        ttsState.set('disconnected');
        stopHeartbeat();
    };

    socket.onmessage = async (event) => {
        // 하트비트 응답 처리
        if (typeof event.data === 'string') {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'pong') {
                    console.log('❤️ Received heartbeat pong');
                    return; // pong 메시지는 오디오 처리를 하지 않음
                }
            } catch (e) {
                // JSON 파싱 실패 시, 일반 텍스트 메시지로 간주 (필요 시 처리)
            }
        }

        if (!audioContext || audioContext.state === 'closed') {
            initializeAudioContext();
        }
        if (!audioContext) {
            console.error("❌ AudioContext가 초기화되지 않았습니다. 사용자 제스처가 필요할 수 있습니다.");
            return;
        }

        let audioData: ArrayBuffer;
        if (event.data instanceof Blob) {
            audioData = await event.data.arrayBuffer();
            console.log("Blob 타입 오디오 데이터 수신. ArrayBuffer로 변환됨.");
        } else if (event.data instanceof ArrayBuffer) {
            audioData = event.data;
            console.log("ArrayBuffer 타입 오디오 데이터 수신.");
        } else {
            console.error("❌ 알 수 없는 형식의 오디오 데이터:", typeof event.data, event.data);
            return;
        }

        try {
            if (speek) {
                console.log("🎶 외부 함수 호출로 오디오 재생 시작");

                speek(audioData);
                return;
            }

            const audioBuffer = await audioContext.decodeAudioData(audioData);

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);

            source.start(0);
            console.log("🎶 오디오 재생 시작!");

            source.onended = () => {
                console.log("🔇 오디오 재생 완료.");
                source.disconnect();
            };

        } catch (e) {
            console.error("❌ 오디오 데이터 디코딩 또는 재생 실패:", e);
        }
    };

    return socket;
}

//연결 해제
export function disconnectTTSSocket() {
    stopHeartbeat();
    if (socket) {
        socket.close();
        socket = null;
        console.log("✅ tts WebSocket 연결 해제됨");
    } else {
        console.warn("⚠️ tts WebSocket이 이미 연결되어 있지 않습니다.");
    }

    if (audioContext) {
        audioContext.close().then(() => {
            audioContext = null;
            console.log("🎶 AudioContext가 성공적으로 닫혔습니다.");
        }).catch(e => console.error("AudioContext 닫기 실패:", e));
    }
}
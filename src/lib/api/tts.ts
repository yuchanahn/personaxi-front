import { api } from '$lib/api';
import { ttsState } from '$lib/stores/ttsStore';

let socket: WebSocket | null = null;
let audioContext: AudioContext | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let currentAudioSource: AudioBufferSourceNode | null = null;

export function stopCurrentAudio() {
    if (currentAudioSource) {
        console.log("🛑 현재 오디오 재생을 중지합니다.");
        currentAudioSource.onended = null;
        try {
            currentAudioSource.stop(0);
        } catch (e) {
            console.warn("오디오 중지 시도 중 오류:", e);
        }
        currentAudioSource.disconnect();
        currentAudioSource = null;
    }
}

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
        if (typeof event.data === 'string') {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'pong') {
                    return;
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
        } else if (event.data instanceof ArrayBuffer) {
            audioData = event.data;
        } else {
            console.error("❌ 알 수 없는 형식의 오디오 데이터:", typeof event.data, event.data);
            return;
        }

        try {
            if (speek) {
                stopCurrentAudio();
                console.log("🎶 외부 함수 호출로 오디오 재생 시작 (자체 중단 로직 필요)");
                speek(audioData);
                return;
            }

            if (currentAudioSource) {
                console.log("⏩ 새로운 오디오 수신. 이전 오디오를 중지합니다.");
                stopCurrentAudio();
            }

            const audioBuffer = await audioContext.decodeAudioData(audioData);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);

            currentAudioSource = source;

            source.start(0);

            source.onended = () => {
                source.disconnect();
                if (currentAudioSource === source) {
                    currentAudioSource = null;
                }
            };

        } catch (e) {
            console.error("❌ 오디오 데이터 디코딩 또는 재생 실패:", e);
            currentAudioSource = null;
        }
    };

    return socket;
}

export function disconnectTTSSocket() {
    stopHeartbeat();
    stopCurrentAudio();
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
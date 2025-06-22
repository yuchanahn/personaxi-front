import { API_BASE_URL } from '$lib/constants';

let socket: WebSocket | null = null;
let audioContext: AudioContext | null = null; // ★ AudioContext 인스턴스 생성

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



export function connectTTSSocket(speek?: (audio: ArrayBuffer) => void): WebSocket {
    socket = new WebSocket(`ws://localhost:8080/ws/tts`);

    if (!socket) {
        console.error("❌ WebSocket 연결 실패");
    }

    console.log("🔗 tts WebSocket 연결 시도...");

    socket.onopen = () => {
        console.log("✅ tts WebSocket 연결됨");
    };

    socket.onclose = () => {
        console.warn("⚠️ tts WebSocket 끊김");
    };

    socket.onmessage = async (event) => {
        if (!audioContext || audioContext.state === 'closed') {
            initializeAudioContext(); // AudioContext가 닫혔거나 없으면 다시 초기화 시도
        }
        if (!audioContext) { // 초기화 실패했으면 더 이상 진행 불가
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

                speek(audioData); // 외부 함수 호출
                return; // 외부 함수가 처리하면 여기서 종료
            }

            const audioBuffer = await audioContext.decodeAudioData(audioData);

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer; // 디코딩된 오디오 버퍼 연결
            source.connect(audioContext.destination); // 오디오 출력 장치에 연결

            source.start(0); // 0초부터 재생 시작
            console.log("🎶 오디오 재생 시작!");

            source.onended = () => {
                console.log("🔇 오디오 재생 완료.");
                source.disconnect(); // 리소스 해제
            };

        } catch (e) {
            console.error("❌ 오디오 데이터 디코딩 또는 재생 실패:", e);
        }
    };

    return socket;
}

//연결 해제
export function disconnectTTSSocket() {
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
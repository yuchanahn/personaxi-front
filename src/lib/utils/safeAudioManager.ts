import { toastError } from "$lib/utils/errorMapper";

/**
 * Safari 호환성을 위한 오디오 싱글톤 매니저
 * - AudioContext와 AudioElement를 전역에서 하나만 생성하여 재사용합니다.
 * - speak() 함수 하나로 기존 로직을 대체합니다.
 */
export class SafeAudioManager {
    // --- Singleton Instances ---
    private static _context: AudioContext | null = null;
    private static _audio: HTMLAudioElement | null = null;
    private static _source: MediaElementAudioSourceNode | null = null;
    private static _analyser: AnalyserNode | null = null;
    private static _gain: GainNode | null = null;

    // --- State ---
    private static _isInit = false;

    /**
     * [필수] 사용자 인터랙션(클릭/터치) 시점에 호출하여 오디오 컨텍스트를 깨웁니다.
     */
    public static init() {
        if (this._isInit && this._context?.state === "running") return;

        try {
            if (!this._context) {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                this._context = new AudioContextClass();

                // Audio Element 생성 (딱 1개)
                this._audio = new Audio();
                this._audio.crossOrigin = "anonymous";
                this._audio.preload = "auto";

                // Gain Node (볼륨 조절용)
                this._gain = this._context.createGain();
                this._gain.connect(this._context.destination);

                // Analyser Node (립싱크용)
                this._analyser = this._context.createAnalyser();
                this._analyser.fftSize = 256;
                this._analyser.minDecibels = -90;
                this._analyser.maxDecibels = -10;
                this._analyser.smoothingTimeConstant = 0.85;
                this._analyser.connect(this._gain);

                // Source Node 연결 (1회만 수행해야 에러 없음)
                this._source = this._context.createMediaElementSource(this._audio);
                this._source.connect(this._analyser);

                console.log("🔊 SafeAudioManager Initialized (Singleton)");
            }

            // Suspended 상태라면 Resume (Safari 핵심)
            if (this._context.state === "suspended") {
                this._context.resume().then(() => {
                    console.log("🔊 AudioContext Resumed!");
                });
            }
            this._isInit = true;
        } catch (e) {
            console.error("❌ SafeAudioManager Init Failed:", e);
        }
    }

    /**
     * 기존 MotionManager.speak 함수를 대체하는 함수입니다.
     * @param model Live2D 모델 객체 (currentModel)
     * @param soundUrl 오디오 파일 URL 또는 Base64
     * @param options 옵션 (볼륨, 표정 등)
     */
    public static async speak(
        model: any,
        soundUrl: string,
        options: {
            volume?: number;
            expression?: string | number;
            resetExpression?: boolean;
            onFinish?: () => void;
            onError?: (e: Error) => void;
        } = {}
    ): Promise<boolean> {
        // 1. 초기화 (혹시 안되어있다면 시도)
        this.init();

        if (!this._context || !this._audio || !this._gain || !this._analyser) {
            console.error("❌ Audio System not ready. Call init() on user click.");
            options.onError?.(new Error("Audio System not ready"));
            return false;
        }

        const {
            volume = 0.5,
            expression,
            resetExpression = false,
            onFinish,
            onError
        } = options;

        // 2. 오디오 설정
        this._gain.gain.value = volume;
        this._audio.pause();
        this._audio.src = soundUrl;
        this._audio.currentTime = 0;

        // 3. Live2D 모델에 립싱크 정보 주입 (Dependency Injection)
        // 기존 라이브러리가 내부적으로 생성하지 않도록, 우리가 만든 싱글톤을 꽂아줍니다.
        if (model && model.internalModel && model.internalModel.motionManager) {
            const mgr = model.internalModel.motionManager;
            mgr.currentAudio = this._audio;
            mgr.currentContext = this._context;
            mgr.currentAnalyzer = this._analyser;
            // 라이브러리가 내부적으로 사용하는 SoundManager.volume 값 동기화 (선택사항)
            // (window as any).PIXI?.live2d?.SoundManager?.volume = volume;
        }

        // 4. 표정 설정 (Expression)
        if (expression && model.expression) {
            if (resetExpression) {
                // 기존 표정 리셋 로직이 필요하다면 여기에 추가 (모델마다 다름)
                // 보통 setExpression 호출 시 자동 전환됨
            }
            model.expression(expression);
        }

        // 5. 재생 시작
        return new Promise((resolve) => {
            const audio = this._audio;
            if (!audio) return resolve(false);

            // 이벤트 핸들러 (한번 쓰고 제거하기 위해 함수로 정의)
            const handleEnded = () => {
                cleanup();
                if (resetExpression && model.internalModel?.motionManager?.expressionManager) {
                    model.internalModel.motionManager.expressionManager.resetExpression();
                }
                onFinish?.();
            };

            const handleError = (e: Event) => {
                cleanup();
                console.error("Audio Playback Error:", e);
                onError?.(new Error("Audio Playback Error"));
                resolve(false);
            };

            const cleanup = () => {
                audio.removeEventListener("ended", handleEnded);
                audio.removeEventListener("error", handleError);
            };

            audio.addEventListener("ended", handleEnded);
            audio.addEventListener("error", handleError);

            // Play
            audio.play()
                .then(() => {
                    resolve(true);
                })
                .catch((e) => {
                    console.warn("Autoplay blocked or interrupted:", e);
                    cleanup();
                    // 사용자가 아직 클릭하지 않았을 가능성이 높음
                    toastError("audioBlocked");
                    // 여기서 화면에 글자 보이기
                    onError?.(new Error("Audio Blocked"));
                    resolve(false);
                });
        });
    }

    /**
     * 립싱크 계산 로직 (기존 SoundManager.analyze 복사본)
     * 혹시 수동으로 데이터를 뽑아야 할 때 사용합니다.
     */
    public static getLipSyncValue(): number {
        if (!this._analyser) return 0;

        const pcmData = new Float32Array(this._analyser.fftSize);
        this._analyser.getFloatTimeDomainData(pcmData);

        let sumSquares = 0.0;
        for (const amplitude of pcmData) {
            sumSquares += amplitude * amplitude;
        }

        return parseFloat(Math.sqrt((sumSquares / pcmData.length) * 20).toFixed(1));
    }

    /**
     * 현재 오디오 즉시 정지
     */
    public static stop() {
        if (this._audio) {
            this._audio.pause();
            this._audio.currentTime = 0;
        }
    }
}

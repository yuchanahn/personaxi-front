export class CustomSoundManager {
    private static _context: AudioContext | null = null;
    private static _audio: HTMLAudioElement | null = null;
    private static _source: MediaElementAudioSourceNode | null = null;
    private static _analyser: AnalyserNode | null = null;
    private static _gain: GainNode | null = null;

    public static async init() {
        if (!this._context) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this._context = new AudioContextClass();

            this._gain = this._context.createGain();
            this._gain.connect(this._context.destination);

            this._analyser = this._context.createAnalyser();
            this._analyser.fftSize = 256;
            this._analyser.smoothingTimeConstant = 0.5;
            this._analyser.connect(this._gain);

            this._audio = new Audio();
            this._audio.crossOrigin = "anonymous";

            this._source = this._context.createMediaElementSource(this._audio);
            this._source.connect(this._analyser);

            console.log("🔊 CustomSoundManager Initialized (Single Context)");
        }

        if (this._context.state === 'suspended') {
            await this._context.resume();
            console.log("🔊 AudioContext Resumed!");
        }
    }

    public static async play(url: string, volume: number = 0.5): Promise<void> {
        if (!this._context) await this.init();
        if (!this._audio || !this._gain) return;

        this._gain.gain.value = volume;

        this._audio.pause();
        this._audio.src = url;
        this._audio.currentTime = 0;

        try {
            await this._audio.play();
        } catch (e) {
            console.error("❌ Play failed (Check User Interaction):", e);
            throw e;
        }
    }

    public static get audio(): HTMLAudioElement | null {
        return this._audio;
    }

    public static get context(): AudioContext | null {
        return this._context;
    }

    public static get analyzer(): AnalyserNode | null {
        return this._analyser;
    }

    public static stop() {
        if (this._audio) {
            this._audio.pause();
            this._audio.currentTime = 0;
        }
    }
}
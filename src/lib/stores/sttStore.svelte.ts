export const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

export class SpeechToText {
    private sr: SpeechRecognition | null = null
    private stream: MediaStream | null = null
    private speechTimer: number = 0
    private speechTimeout: number = 1.5 * 1000
    private speechTimeoutCallback: () => void

    public enabled: boolean = false
    public speechFull: string = ''
    public speechCurrent: string = $state('')

    constructor(speechTimeoutCallback: () => void) {
        this.speechTimeoutCallback = speechTimeoutCallback

        if (!SpeechRecognition) {
            console.log('SpeechRecognition is not supported!')
            return
        }

        console.log('SpeechRecognition is supported!')
        this.sr = new SpeechRecognition()
        this.sr.lang = 'ko-KR'
        this.sr.continuous = false
        this.sr.interimResults = true
        this.sr.maxAlternatives = 1
        this.sr.addEventListener('result', (event) => this.onResult(event))
        this.sr.addEventListener('end', (event) => this.onEnd(event))
    }

    public enable(value: boolean) {
        this.enabled = value
        if (this.enabled) {
            this.start()
        } else {
            this.stop()
        }
    }

    public async start() {
        if (this.sr) {
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });

                // Experimental support for passing track
                const audioTrack = this.stream.getAudioTracks()[0];

                clearTimeout(this.speechTimer)
                this.speechTimer = window.setTimeout(() => this.onSpeechTimeout(), this.speechTimeout)

                this.sr.start(audioTrack)
            } catch (e) {
                console.error("Mic Error or SR Start Error:", e);
                // Fallback if getUserMedia fails or whatever
                try {
                    this.sr.start();
                } catch (e2) { }
            }
        }
    }

    public stop() {
        if (this.sr) {
            clearTimeout(this.speechTimer)
            this.sr.stop()
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    private onResult(event: SpeechRecognitionEvent) {
        clearTimeout(this.speechTimer)
        this.speechTimer = window.setTimeout(() => this.onSpeechTimeout(), this.speechTimeout)
        this.speechCurrent = event.results[0][0].transcript
        if (event.results[0].isFinal) {
            this.speechFull += ' ' + this.speechCurrent
            this.speechCurrent = ''
            this.onSpeechTimeout()
        }
    }

    private onEnd(_event: Event) {
        if (this.enabled) {
            this.start()
        }
    }

    private onSpeechTimeout() {
        clearTimeout(this.speechTimer)
        if (this.speechFull !== '') {
            this.speechTimeoutCallback()
            this.speechFull = ''
        }
    }
}

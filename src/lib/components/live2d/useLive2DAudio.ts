import { SafeAudioManager } from "$lib/utils/safeAudioManager";

type CreateLive2DAudioOptions = {
    getCurrentModel: () => any;
    getAutonomy: () => any;
    setSpeechError: (value: boolean) => void;
};

export function createLive2DAudioController({
    getCurrentModel,
    getAutonomy,
    setSpeechError,
}: CreateLive2DAudioOptions) {
    const speak = async (audioUrl: string, onFinish?: () => void) => {
        const model = getCurrentModel();
        if (!model) return;

        setSpeechError(false);
        getAutonomy()?.setSpeaking(true);

        await SafeAudioManager.speak(model, audioUrl, {
            onFinish: () => {
                getAutonomy()?.setSpeaking(false);
                onFinish?.();
            },
            onError: (e) => {
                console.error("TTS Error", e);
                getAutonomy()?.setSpeaking(false);
                setSpeechError(true);
            },
        });
    };

    const setupInteractionAudioInit = () => {
        const wakeUpAudio = () => {
            SafeAudioManager.init();
            window.removeEventListener("click", wakeUpAudio);
            window.removeEventListener("touchstart", wakeUpAudio);
        };

        window.addEventListener("click", wakeUpAudio);
        window.addEventListener("touchstart", wakeUpAudio);

        return () => {
            window.removeEventListener("click", wakeUpAudio);
            window.removeEventListener("touchstart", wakeUpAudio);
        };
    };

    const stop = () => {
        SafeAudioManager.stop();
    };

    return {
        speak,
        setupInteractionAudioInit,
        stop,
    };
}


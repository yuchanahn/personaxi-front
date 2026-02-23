<script lang="ts">
    import { onDestroy } from "svelte";
    import { SpeechToText } from "$lib/stores/sttStore.svelte";
    import Icon from "@iconify/svelte";
    import { fade } from "svelte/transition";

    const stt: SpeechToText = new SpeechToText(handleSpeechComplete);
    let isSupported = true;

    let {
        isListening = $bindable(false),
        text = $bindable(""),
        onSpeechComplete = (msg: string) => {
            console.log("Speech complete:", msg);
        },
    }: {
        isListening?: boolean;
        text?: string;
        onSpeechComplete?: (msg: string) => void;
    } = $props();

    let error = $state<string | null>(null);

    function handleSpeechComplete() {
        showMessage(stt.speechFull.trim());
        onSpeechComplete(stt.speechFull.trim());
    }

    onDestroy(() => {
        stt?.enable(false);
    });

    function toggleListen() {
        if (!stt) return;
        stt.enable(!stt.enabled);
        isListening = stt.enabled;
        if (stt.enabled) {
            error = null;
        }
    }

    let timer: number | null = null;

    function showMessage(msg: string, duration: number = 1000) {
        text = msg;
        if (timer) {
            clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            text = "";
        }, duration);
    }

    $effect(() => {
        if (stt.speechCurrent) {
            showMessage(stt.speechCurrent, 1000);
        }
    });
</script>

<div class="stt-container">
    {#if isSupported}
        <button
            class="mic-button"
            class:listening={isListening}
            onclick={toggleListen}
            aria-label={isListening ? "음성 인식 중지" : "음성 인식 시작"}
        >
            <Icon icon="mdi:microphone" width="32" height="32" />
        </button>
        {#if text !== "" && isListening}
            <div class="transcript-box" transition:fade={{ duration: 1000 }}>
                {@html text.replace(/\n/g, "<br/>")}
            </div>
        {/if}
        <!-- {#if stt.speechCurrent || error}
            <div class="transcript-box" transition:fade={{ duration: 1000 }}>
                {#if error}
                    <p class="error">오류: {error}</p>
                {:else if stt.speechCurrent}
                    <p>
                        {@html stt.speechCurrent.replace(/\n/g, "<br/>")}
                    </p>
                {:else if stt.speechFull}
                    <p>
                        {@html stt.speechFull.replace(/\n/g, "<br/>")}
                    </p>
                {/if}
            </div>
        {/if} -->
    {:else}
        <p class="error">현재 브라우저에서는 음성 인식을 지원하지 않습니다.</p>
    {/if}
</div>

<style>
    .stt-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        height: 100%;
    }

    .mic-button {
        width: 100%;
        height: 100%;
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    .mic-button:hover {
        background-color: #e0e0e0;
    }

    .mic-button.listening {
        background-color: #ff4d4d;
        color: white;
        animation: pulse 1.5s infinite;
    }

    .transcript-box {
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);

        width: 300px;
        max-width: 80vw;
        min-height: 50px;
        padding: 0.75rem 1rem;

        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 8px;
        text-align: center;
        font-size: 1rem;
        line-height: 1.5;
        overflow-wrap: break-word;
        box-sizing: border-box;
    }

    .error {
        color: #ff4d4d;
        font-weight: bold;
    }

    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 rgba(255, 77, 77, 0.7);
        }
        70% {
            box-shadow: 0 0 0 10px rgba(255, 77, 77, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(255, 77, 77, 0);
        }
    }
</style>

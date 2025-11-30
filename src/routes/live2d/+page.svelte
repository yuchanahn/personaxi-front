<script lang="ts">
    import Live2DViewer from "$lib/components/live2d/Live2DViewer.svelte";
    import ChatControls3D from "$lib/components/chat3D/ChatControls3D.svelte";
    import ChatWindow from "$lib/components/chat/ChatWindow.svelte";
    import ChatInput from "$lib/components/chat/ChatInput.svelte";
    import { onDestroy, onMount } from "svelte";
    import { page } from "$app/stores";
    import { loadChatHistory, sendPromptStream } from "$lib/api/chat";
    import type { Persona } from "$lib/types";
    import { loadPersona } from "$lib/api/edit_persona";
    import { connectTTSSocket, disconnectTTSSocket } from "$lib/api/tts";
    import TtsStatusModal from "$lib/components/modal/TTSStatusModal.svelte";

    let lastSessionId: string | null = null;
    let persona: Persona | null = null;

    let Viewer: Live2DViewer;
    let showChat: boolean = true;
    let isLoading = false;

    // Hardcoded model for testing if not present in persona
    const TEST_MODEL_URL = "/live2d/huohuo/huohuo.model3.json";

    onMount(async () => {
        const sessionId = $page.url.searchParams.get("c");
        lastSessionId = sessionId;
        if (sessionId) {
            persona = null;
            loadChatHistory(sessionId);
            loadPersona(sessionId).then((p) => {
                // Fallback to test model if live2d_model_url is missing
                if (!p.live2d_model_url) {
                    console.warn("No Live2D URL found, using test model.");
                    p.live2d_model_url = TEST_MODEL_URL;
                }
                persona = p;
            });

            await connectTTSSocket((audio: ArrayBuffer) => {
                if (Viewer && Viewer.speak) {
                    const blob = new Blob([audio], { type: "audio/mp3" });
                    const url = URL.createObjectURL(blob);
                    Viewer.speak(url);
                } else {
                    console.warn("Viewer not ready for TTS audio.");
                }
            });
        }
    });

    $: {
        const sessionId = $page.url.searchParams.get("c");
        if (sessionId !== lastSessionId) {
            lastSessionId = sessionId;
            if (sessionId) {
                persona = null;
                loadChatHistory(sessionId);
                loadPersona(sessionId).then((p) => {
                    if (!p.live2d_model_url) {
                        p.live2d_model_url = TEST_MODEL_URL;
                    }
                    persona = p;
                });
            }
        }
    }

    const send = async (prompt: string) => {
        if (!persona || !lastSessionId) return;
        isLoading = true;
        // Use "3d" type to leverage existing 3D backend logic (TTS, Emotion, etc.)
        await sendPromptStream(
            lastSessionId,
            prompt,
            "live2d",
            () => {
                isLoading = false;
            },
            (emotion) => {
                // Handle emotion detection
                if (Viewer && Viewer.setExpression) {
                    Viewer.setExpression(emotion);
                }
            },
        );
    };

    const handleInputChange = (text: string) => {
        // Optional: Add lip sync or idle animation changes on input
    };

    onDestroy(() => {
        disconnectTTSSocket();
    });
</script>

<main>
    {#if persona}
        <TtsStatusModal
            impl_connectTTS={async () => {
                await connectTTSSocket((audio: ArrayBuffer) => {
                    if (Viewer && Viewer.speak) {
                        const blob = new Blob([audio], { type: "audio/mp3" });
                        const url = URL.createObjectURL(blob);
                        Viewer.speak(url);
                    }
                });
            }}
            impl_disconnectTTS={() => {
                disconnectTTSSocket();
            }}
        />

        <div class="live2d-wrapper">
            {#if persona.live2d_model_url}
                <Live2DViewer
                    bind:this={Viewer}
                    modelUrl={persona.live2d_model_url}
                    scale={0.2}
                />
            {:else}
                <div class="error-message">No Model URL</div>
            {/if}
        </div>

        <div class="chat-overlay">
            <div class="chat-content">
                <ChatWindow
                    cssid={lastSessionId ?? ""}
                    {showChat}
                    {isLoading}
                />
                <ChatInput onSend={send} onChangeInput={handleInputChange} />
            </div>
        </div>

        <ChatControls3D
            cssid={lastSessionId ?? ""}
            bind:showChat
            {persona}
            llmType={"3d"}
        />

        <!-- Debug UI - At top level to avoid pointer-events issues -->
        <div class="debug-controls">
            <button
                class="debug-btn"
                on:click={() => {
                    if (Viewer && Viewer.toggleDebug) {
                        Viewer.toggleDebug();
                    }
                }}
            >
                🔍 Debug
            </button>
        </div>
    {/if}
</main>

<style>
    main {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
    }

    .live2d-wrapper {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
    }

    .chat-overlay {
        position: absolute;
        bottom: 0;
        width: 100%;
        height: 100vh;
        padding-bottom: env(safe-area-inset-bottom, 0px);
        background-color: rgba(255, 255, 255, 0);
        display: flex;
        flex-direction: column;
        z-index: 2;
        pointer-events: none; /* Allow clicks to pass through to model where possible */
    }

    .chat-content {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        pointer-events: auto; /* Re-enable pointer events for chat interactions */
    }

    .chat-content :global(.chat-window) {
        flex: 1;
        overflow-y: auto;
    }

    .chat-content :global(.chat-input-wrapper) {
        position: sticky;
        bottom: 0;
        z-index: 10;
        background-color: rgba(255, 255, 255, 0);
    }

    .error-message {
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
    }

    .debug-controls {
        position: fixed;
        bottom: 80px;
        right: 20px;
        z-index: 9999;
        pointer-events: auto;
        max-height: calc(100vh - 100px);
        overflow: visible;
    }

    .debug-btn {
        background: rgba(0, 0, 0, 0.8);
        color: #0f0;
        border: 2px solid #0f0;
        padding: 10px 15px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        transition: all 0.2s;
        pointer-events: auto;
    }

    .debug-btn:hover {
        background: rgba(0, 255, 0, 0.2);
        box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
        transform: scale(1.05);
    }
</style>

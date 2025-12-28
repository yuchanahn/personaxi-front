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

    import { ttsState } from "$lib/stores/ttsStore";
    import ThoughtBubble from "$lib/components/chat/ThoughtBubble.svelte";
    import SpeechBubble from "$lib/components/chat/SpeechBubble.svelte";
    import { messages } from "$lib/stores/messages";
    import { st_user } from "$lib/stores/user";
    import { pricingStore } from "$lib/stores/pricing";
    import { get } from "svelte/store";
    import { chatSessions } from "$lib/stores/chatSessions";

    let lastSessionId: string | null = null;
    let persona: Persona | null = null;

    let Viewer: Live2DViewer;
    let showChat: boolean = false;
    let isLoading = false;

    // Thought Bubble State
    let thought1 = "";
    let thought2 = "";
    let showThought1 = false;
    let showThought2 = false;
    let isSpeaking = false;

    const TEST_MODEL_URL = "/live2d/huohuo/huohuo.model3.json";

    $: if ($messages.length > 0 && persona !== null) {
        const lastMsg = $messages[$messages.length - 1];
        if (lastMsg.role === "assistant") {
            const text = lastMsg.content;

            const t1Match = text.match(/^\s*\((.*?)\)/);
            if (t1Match) {
                if (thought1 !== t1Match[1]) {
                    console.log("Thought 1 detected:", t1Match[1]);
                    thought1 = t1Match[1];
                    if (!isSpeaking && !showThought2) {
                        console.log("Showing Thought 1");
                        showThought1 = true;
                    }
                }
            }

            const t2Match = text.match(/\((.*?)\)\s*$/);
            if (t2Match) {
                if (text.trim() !== t2Match[0].trim()) {
                    thought2 = t2Match[1];
                }
            }
        }
    }

    let speechText = "";
    let showSpeech = false;

    let currentCost = 0;
    $: if (lastSessionId) {
        const session = $chatSessions.find((s) => s.id === lastSessionId);
        const llmType = session?.llmType || "gemini-flash-lite"; // Default
        const baseCost = $pricingStore.costs.chat_live2d || 10;
        const multiplier = $pricingStore.model_multipliers[llmType] || 1.0;
        currentCost = Math.round(baseCost * multiplier);
    }

    onMount(async () => {
        const sessionId = $page.url.searchParams.get("c");
        lastSessionId = sessionId;
        $messages = [];
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

            await connectTTSSocket(async (audio: ArrayBuffer) => {
                if (Viewer && Viewer.speak) {
                    const blob = new Blob([audio], { type: "audio/mp3" });
                    const url = URL.createObjectURL(blob);

                    // Calculate duration
                    const tempAudio = new Audio(url);
                    await new Promise((resolve) => {
                        tempAudio.onloadedmetadata = () => resolve(true);
                        // Fallback if metadata fails
                        setTimeout(() => resolve(true), 1000);
                    });
                    const durationMs = tempAudio.duration * 1000 || 3000; // Default to 3s if unknown
                    // console.log(`Audio Duration: ${durationMs}ms`);

                    // Audio Start
                    // console.log("Audio Start: Resetting thoughts");
                    isSpeaking = true;
                    showThought2 = false;
                    showThought1 = false;

                    // Start speaking (don't await if it resolves early, we use duration)
                    Viewer.speak(url);

                    // Wait for audio to finish
                    setTimeout(() => {
                        // Audio End
                        // console.log("Audio End: Showing Thought 2");
                        isSpeaking = false;
                        showThought1 = false; // Ensure thought1 is gone

                        if (thought2) {
                            // Random delay between 2000ms and 3000ms
                            const delay =
                                Math.floor(Math.random() * 1000) + 2000;
                            setTimeout(() => {
                                showThought2 = true; // Show thought 2
                                // Hide thought 2 after 8 seconds
                                setTimeout(() => {
                                    showThought2 = false;
                                }, 8000);
                            }, delay);
                        }
                    }, durationMs);
                } else {
                    console.warn("Viewer not ready for TTS audio.");
                }
            });
        }
    });

    let motionMap: Record<string, string> = {};
    let motionExprMap: Record<string, string> = {};
    let hitMotionMap: Record<string, string> = {}; // New
    let expressionMap: Record<string, string> = {};
    let lastTriggeredAction: string = "";

    $: {
        const sessionId = $page.url.searchParams.get("c");
        if (sessionId !== lastSessionId) {
            lastSessionId = sessionId;
            if (sessionId) {
                persona = null;
                motionMap = {}; // Reset map
                motionExprMap = {};
                expressionMap = {}; // Reset map
                hitMotionMap = {}; // Reset map
                loadChatHistory(sessionId);
                loadPersona(sessionId).then((p) => {
                    if (!p.live2d_model_url) {
                        p.live2d_model_url = TEST_MODEL_URL;
                    }

                    // Parse first_scene for mappings
                    try {
                        if (p.first_scene) {
                            const fs = JSON.parse(p.first_scene);

                            // Parse Motions
                            if (
                                fs.live2d_motion_list &&
                                Array.isArray(fs.live2d_motion_list)
                            ) {
                                fs.live2d_motion_list.forEach((m: any) => {
                                    if (m.name && m.file) {
                                        motionMap[m.name] = m.file;
                                    }
                                });
                                // // console.log("Parsed Motion Map:", motionMap);
                            }

                            // Parse Expressions
                            if (fs.live2d_expression_map) {
                                expressionMap = fs.live2d_expression_map;
                            }

                            // Parse Hit Motion Map
                            if (fs.live2d_hit_motion_map) {
                                hitMotionMap = fs.live2d_hit_motion_map;
                            }
                        }
                    } catch (e) {
                        console.error(
                            "Failed to parse first_scene for mappings:",
                            e,
                        );
                    }

                    persona = p;
                });
            }
        }
    }

    // Action Tag Parsing
    $: if ($messages.length > 0) {
        const lastMsg = $messages[$messages.length - 1];
        if (lastMsg.role === "assistant") {
            const text = lastMsg.content;

            // console.log("Debug: Last message content:", text);

            // Regex to find [ActionName]
            const actionMatch = text.match(/\[(.*?)\]/);

            if (actionMatch) {
                const rawTag = actionMatch[1];
                const actionName = rawTag.split(":")[0].trim();

                if (actionName && actionName !== lastTriggeredAction) {
                    lastTriggeredAction = actionName;

                    if (motionMap[actionName] || expressionMap[actionName]) {
                        const mappedFile = motionMap[actionName];

                        if (Viewer) {
                            console.log(
                                "Debug: Triggering action:",
                                actionName,
                            );
                            // Check if it's an expression
                            // Heuristic: Check against known availableExpressions OR file extension
                            const isExpression =
                                (Viewer.getAvailableExpressions &&
                                    Viewer.getAvailableExpressions().includes(
                                        mappedFile,
                                    )) ||
                                mappedFile.endsWith(".exp3.json") ||
                                mappedFile.endsWith(".exp.json"); // legacy check

                            if (isExpression) {
                                if (Viewer.triggerExpression)
                                    Viewer.triggerExpression(mappedFile);
                            } else {
                                if (Viewer.triggerMotion)
                                    Viewer.triggerMotion(mappedFile);
                            }
                        } else {
                            console.warn(
                                "Debug: Viewer or triggerMotion missing",
                            );
                        }
                    } else {
                        console.warn(
                            `Debug: Action [${actionName}] not found in map. Available: ${Object.keys(motionMap).join(", ")}`,
                        );
                    }
                } else if (actionName === lastTriggeredAction) {
                    // Skipping duplicate action
                }
            } else {
                // No action tag found in text
            }
        }
    }

    const send = async (prompt: string) => {
        if (!persona || !lastSessionId) return;

        // Optimistic Credit Deduction
        st_user.update((u) => {
            if (u && u.credits >= currentCost) {
                u.credits -= currentCost;
            }
            return u;
        });

        isLoading = true;

        // Reset thoughts for new turn
        thought1 = "";
        thought2 = "";
        showThought1 = false;
        showThought2 = false;
        lastTriggeredAction = "";

        // Use "3d" type to leverage existing 3D backend logic (TTS, Emotion, etc.)
        await sendPromptStream(
            lastSessionId,
            prompt,
            "live2d",
            () => {
                isLoading = false;
            },
            (emotion) => {
                // Handle emotion detection via Viewer logic
                // console.log("Raw API Emotion:", emotion);
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

    function handleThoughtEnded(): void {
        if ($ttsState == "connected") return;
        const lastMsg = $messages[$messages.length - 1];
        if (lastMsg.role === "assistant") {
            let content = lastMsg.content;
            content = content.replace(/\([^)]*\)/g, "");
            content = content.replace(/\[[^\]]*\]/g, "");
            console.log("content: ", content);
            speechText = content;
        }
        showSpeech = true;
        setTimeout(() => {
            showThought1 = false;
        }, 2000);
    }

    function handleSpeechEnded(): void {
        showSpeech = false;
        showThought1 = false;
        showThought2 = true;
        setTimeout(() => {
            showThought2 = false;
        }, 8000);
    }
</script>

<main>
    {#if persona}
        <TtsStatusModal
            impl_connectTTS={async () => {
                await connectTTSSocket(async (audio: ArrayBuffer) => {
                    if (Viewer && Viewer.speak) {
                        const blob = new Blob([audio], { type: "audio/mp3" });
                        const url = URL.createObjectURL(blob);

                        // Calculate duration
                        const tempAudio = new Audio(url);
                        await new Promise((resolve) => {
                            tempAudio.onloadedmetadata = () => resolve(true);
                            setTimeout(() => resolve(true), 1000);
                        });
                        const durationMs = tempAudio.duration * 1000 || 3000;

                        // Audio Start
                        console.log("Audio Start (Modal): Resetting thoughts");
                        isSpeaking = true;
                        showThought2 = false;

                        Viewer.speak(url);
                        showThought1 = false;

                        // Wait for audio to finish
                        setTimeout(() => {
                            // Audio End
                            console.log("Audio End (Modal): Showing Thought 2");
                            isSpeaking = false;
                            showThought1 = false;

                            if (thought2) {
                                // Random delay between 2000ms and 3000ms
                                const delay =
                                    Math.floor(Math.random() * 1000) + 2000;
                                setTimeout(() => {
                                    showThought2 = true;
                                    setTimeout(() => {
                                        showThought2 = false;
                                    }, 8000);
                                }, delay);
                            }
                        }, durationMs);
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
                    {expressionMap}
                    {hitMotionMap}
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
                <ChatInput
                    onSend={send}
                    onChangeInput={handleInputChange}
                    placeholderName={persona?.name}
                    mode="3d"
                    neededNeurons={currentCost}
                />
            </div>
        </div>

        <ChatControls3D
            cssid={lastSessionId ?? ""}
            bind:showChat
            {persona}
            llmType={"3d"}
        />

        <ThoughtBubble
            text={thought1}
            visible={showThought1}
            type="thought1"
            customStyle="top: 5vh; left: 50%; transform: translateX(-50%); z-index: 20;"
            onEnded={handleThoughtEnded}
        />
        <ThoughtBubble
            text={thought2}
            visible={showThought2}
            type="thought2"
            customStyle="top: 5vh; left: 50%; transform: translateX(-50%); z-index: 20;"
        />

        <SpeechBubble
            text={speechText}
            visible={showSpeech}
            customStyle="top: 25vh; left: 50%; transform: translateX(-50%); z-index: 25;"
            onEnded={handleSpeechEnded}
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
        pointer-events: none; /* Let clicks pass through empty areas */
    }

    .chat-content :global(.chat-window) {
        flex: 1;
        overflow-y: auto;
        pointer-events: none; /* Allow clicks/drags to pass through empty areas to the model */
        scrollbar-width: none; /* Hide scrollbar to reduce visual clutter */
    }
    .chat-content :global(.chat-window)::-webkit-scrollbar {
        display: none;
    }

    /* Make messages and interactive elements capture events again */
    .chat-content :global(.chat-window > *) {
        pointer-events: auto;
    }

    .chat-content :global(.chat-input-wrapper) {
        position: sticky;
        bottom: 0;
        z-index: 10;
        background-color: rgba(255, 255, 255, 0);
        pointer-events: auto; /* Capture clicks on input */
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

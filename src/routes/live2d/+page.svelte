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

    import { ttsState } from "$lib/stores/ttsStore";
    import ThoughtBubble from "$lib/components/chat/ThoughtBubble.svelte";
    import SpeechBubble from "$lib/components/chat/SpeechBubble.svelte";
    import { messages } from "$lib/stores/messages";
    import { st_user } from "$lib/stores/user";
    import { pricingStore } from "$lib/stores/pricing";
    import { chatSessions } from "$lib/stores/chatSessions";
    import { toast } from "$lib/stores/toast";
    import { settings } from "$lib/stores/settings";
    import type { Live2DAutonomy } from "$lib/utils/live2d/Live2DAutonomy";

    // --- Mobile Keyboard Fix ---
    let viewportHeight = 0;
    // ----------------------------

    let lastSessionId: string | null = null;
    let persona: Persona | null = null;
    let idleTimer: any = null;
    const IDLE_TIMEOUT = 60000; // 60 seconds

    let Viewer: Live2DViewer;
    let showChat: boolean = false;
    let isLoading = false;
    let showDebugUI = false;
    let closeupScale: number = 1.5;
    let closeupOffset: number = 0.1;
    let isCloseup: boolean = false;

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
                    thought1 = t1Match[1];
                    if (!isSpeaking && !showThought2) {
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

    let affectionScore = 0;

    let blackOpacity = 1;
    let pinkOpacity = 0;

    $: {
        const t = Math.max(0, Math.min(100, affectionScore)) / 100;
        blackOpacity = 0.95 - t * 0.95;
        pinkOpacity = t * 0.45;
    }

    let motionMap: Record<string, string> = {};
    let motionExprMap: Record<string, string> = {};
    let hitMotionMap: Record<string, string> = {};
    let expressionMap: Record<string, string> = {};
    let lastTriggeredAction: string = "";

    let isStartSpeech = false;
    let autonomySensitivity = 1.0;

    $: if (Viewer && Viewer.setSensitivity) {
        Viewer.setSensitivity(autonomySensitivity);
    }

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

                Promise.all([
                    loadChatHistory(sessionId, (esf) => {
                        isStartSpeech = esf.recent_turns.length < 1;
                        console.log("@@@ isStartSpeech @@@", isStartSpeech);
                    }),
                    loadPersona(sessionId),
                ]).then(([_, p]) => {
                    if (!p) return;

                    if (!p.live2d_model_url) {
                        p.live2d_model_url = TEST_MODEL_URL;
                    }

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
                            }

                            // HIT Motions
                            if (fs.live2d_hit_motion_map) {
                                hitMotionMap = fs.live2d_hit_motion_map;
                            }

                            // Expressions
                            if (fs.live2d_expression_map) {
                                expressionMap = fs.live2d_expression_map;
                            }
                        }
                    } catch (e) {
                        console.error("Failed to parse first_scene JSON:", e);
                    }

                    persona = p;
                });
            }
        }
    }

    interface Action {
        name: string;
        type: string;
    }

    const actionQueue: Action[] = [];

    $: if ($messages.length > 0) {
        const lastMsg = $messages[$messages.length - 1];
        if (lastMsg.role === "assistant") {
            const text = lastMsg.content;

            const actionMatch = text.match(/\[(.*?)\]/);

            if (actionMatch) {
                const rawTag = actionMatch[1];
                const actionName = rawTag.split(":")[0].trim();

                if (actionName && actionName !== lastTriggeredAction) {
                    lastTriggeredAction = actionName;

                    const gestureKey = actionName
                        .toUpperCase()
                        .replace(/\s+/g, "_");
                    const validGestures = [
                        "NOD",
                        "SHAKE",
                        "TILT",
                        "FIDGET",
                        "SIGH",
                        "LOOK_DOWN",
                        "CLOSE_EYES",
                        "WINK",
                        "PUFF_CHEEKS",
                        "STICK_TONGUE",
                        "SQUINT",
                        "ROLL_EYES",
                        "LOOK_UP_THINK",
                        "FLINCH",
                        "PANT",
                    ];

                    if (validGestures.includes(gestureKey)) {
                        console.log(`Debug: Triggering Gesture: ${gestureKey}`);

                        actionQueue.push({
                            name: gestureKey,
                            type: "gesture",
                        });
                        //if (Viewer && Viewer.playGesture) {
                        //    Viewer.playGesture(gestureKey);
                        //}
                    } else if (
                        motionMap[actionName] ||
                        expressionMap[actionName]
                    ) {
                        // Existing Motion/Expression Logic
                        const mappedFile = motionMap[actionName];

                        if (Viewer) {
                            console.log(
                                "Debug: Triggering action:",
                                actionName,
                            );
                            const isExpression =
                                (Viewer.getAvailableExpressions &&
                                    Viewer.getAvailableExpressions().includes(
                                        mappedFile,
                                    )) ||
                                mappedFile.endsWith(".exp3.json") ||
                                mappedFile.endsWith(".exp.json"); // legacy check

                            if (isExpression) {
                                //if (Viewer.triggerExpression) {
                                actionQueue.push({
                                    name: actionName,
                                    type: "expression",
                                });
                                //Viewer.triggerExpression(mappedFile);
                            } else {
                                //if (Viewer.triggerMotion) {
                                actionQueue.push({
                                    name: actionName,
                                    type: "motion",
                                });
                                //Viewer.triggerMotion(mappedFile);
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
                }
            }
        }
    }

    let autonomy: Live2DAutonomy | null = null;

    const send = async (prompt: string) => {
        if (!persona || !lastSessionId) return;

        st_user.update((u) => {
            if (u && u.credits >= currentCost) {
                u.credits -= currentCost;
            }
            return u;
        });

        isLoading = true;

        thought1 = "";
        thought2 = "";
        showThought1 = false;
        showThought2 = false;
        lastTriggeredAction = "";

        if (autonomy) {
            autonomy.WakeUp();
        }

        await sendPromptStream(
            lastSessionId,
            prompt,
            "live2d",
            () => {
                isLoading = false;
                resetIdleTimer();
            },
            (emotion) => {
                if (Viewer && Viewer.setExpression) {
                    Viewer.setExpression(emotion);
                }
            },
        );
    };

    const handleInputChange = (text: string) => {
        // TODO: Add lip sync or idle animation changes on input
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

        handleSpeechStarted();
        showSpeech = true;

        setTimeout(() => {
            showThought1 = false;
        }, 2000);
    }

    function handleSpeechStarted(): void {
        while (actionQueue.length > 0) {
            const action = actionQueue.shift();
            if (action && action.type === "gesture") {
                if (Viewer && Viewer.playGesture) {
                    Viewer.playGesture(action.name);
                }
            } else if (action && action.type === "motion") {
                if (Viewer && Viewer.triggerMotion) {
                    Viewer.triggerMotion(action.name);
                }
            } else if (action && action.type === "expression") {
                if (Viewer && Viewer.triggerExpression) {
                    Viewer.triggerExpression(action.name);
                }
            }
        }
    }

    function handleSpeechEnded(): void {
        showSpeech = false;
        showThought1 = false;
        showThought2 = true;
        isSpeaking = false;

        if (thought2) {
            const delay = Math.floor(Math.random() * 1000) + 2000;
            setTimeout(() => {
                showThought2 = true;
                setTimeout(() => {
                    showThought2 = false;
                }, 8000);
            }, delay);
        }
    }

    $: if (error_showSpeech) {
        console.log("Audio Blocked Error Detected: Triggering Fallback");
        error_showSpeech = false;
        showSpeech = true;
        handleSpeechStarted();
    }

    const handleTTSResponse = async (audio: ArrayBuffer | null) => {
        if (!audio) {
            toast.error("TTS Server Busy (Fallback to Text)");
            console.warn("TTS Failed (Fallback).");
            error_showSpeech = true;
            return;
        }

        if (Viewer && Viewer.speak) {
            const blob = new Blob([audio], { type: "audio/mp3" });
            const url = URL.createObjectURL(blob);

            // Calculate duration
            const tempAudio = new Audio(url);
            await new Promise((resolve) => {
                tempAudio.onloadedmetadata = () => resolve(true);
                setTimeout(() => resolve(true), 1000);
            });

            if (!tempAudio.duration) {
                console.warn("Audio duration not found.");
                error_showSpeech = true;
                return;
            }

            const durationMs = tempAudio.duration * 1000 || 3000;
            console.log(`Audio Duration: ${durationMs}ms`);

            // Audio Start
            console.log("Audio Start: Resetting thoughts");
            isSpeaking = true;
            showThought2 = false;
            showThought1 = false;

            Viewer.speak(url, handleSpeechEnded);
            handleSpeechStarted();
        } else {
            console.warn("Viewer not ready for TTS audio.");
        }
    };

    const connectTTSImpl = async () => {
        await connectTTSSocket(handleTTSResponse);
    };

    // --- Interaction & Idle Handlers ---

    function resetIdleTimer() {
        if (idleTimer) clearTimeout(idleTimer);
        // Only trigger idle if ENABLED, and not already speaking or loading
        if (
            $settings.enableIdleTrigger &&
            !isSpeaking &&
            !isLoading &&
            !showChat
        ) {
            idleTimer = setTimeout(() => {
                console.log("💤 Triggering Idle...");
                send("<idle>");
            }, IDLE_TIMEOUT);
        }
    }

    // 지속시간
    const INTERACTION_TIMEOUT = 3000;

    let interactionTimer: any;

    function handleInteraction(e: CustomEvent) {
        console.log("👆 Interaction:", e.detail);
        resetIdleTimer();

        if (interactionTimer) clearTimeout(interactionTimer);
        interactionTimer = setTimeout(() => {
            if ($settings.enableInteractionTrigger && !isLoading) {
                send("<interaction>" + JSON.stringify(e.detail));
            }
        }, INTERACTION_TIMEOUT);
    }

    function handleInteractionEnd() {
        console.log("👇 Interaction End");
        if (interactionTimer) clearTimeout(interactionTimer);
    }

    // Global activity listeners
    function onUserActivity() {
        resetIdleTimer();
    }

    let removeListener: () => void;

    onMount(async () => {
        const handleAffection = (e: CustomEvent) => {
            if (e.detail?.score !== undefined) {
                affectionScore = e.detail.score;
            }
        };
        window.addEventListener(
            "affection-update",
            handleAffection as EventListener,
        );
        removeListener = () =>
            window.removeEventListener(
                "affection-update",
                handleAffection as EventListener,
            );

        const sessionId = $page.url.searchParams.get("c");
        lastSessionId = sessionId;
        $messages = [];
        if (sessionId) {
            persona = null;
            connectTTSImpl();
        }

        window.addEventListener("mousemove", onUserActivity);
        window.addEventListener("keydown", onUserActivity);
        window.addEventListener("click", onUserActivity);
        window.addEventListener("touchstart", onUserActivity);
        resetIdleTimer();

        // [Mobile Keyboard Fix]
        if (typeof window !== "undefined" && window.visualViewport) {
            viewportHeight = window.visualViewport.height;
            const handleResize = () => {
                if (window.visualViewport) {
                    viewportHeight = window.visualViewport.height;
                    // iOS scroll fix: sometimes it scrolls the body
                    if (document.body.scrollTop !== 0) {
                        document.body.scrollTop = 0;
                    }
                }
            };
            window.visualViewport.addEventListener("resize", handleResize);
            window.visualViewport.addEventListener("scroll", handleResize);

            removeListener = () => {
                window.removeEventListener(
                    "affection-update",
                    handleAffection as EventListener,
                );
                window.visualViewport?.removeEventListener("resize", handleResize);
                window.visualViewport?.removeEventListener("scroll", handleResize);
            };
        } else {
             // Fallback for environments without visualViewport
             viewportHeight = window.innerHeight;
        }
    });

    onDestroy(() => {
        if (idleTimer) clearTimeout(idleTimer);
        window.removeEventListener("mousemove", onUserActivity);
        window.removeEventListener("keydown", onUserActivity);
        window.removeEventListener("click", onUserActivity);
        window.removeEventListener("touchstart", onUserActivity);
        removeListener();
    });

    let error_showSpeech = false;
</script>

<main>
    <div
        class="vignette-overlay vignette-black"
        style="opacity: {blackOpacity};"
    ></div>
    <div
        class="vignette-overlay vignette-pink"
        style="opacity: {pinkOpacity};"
    ></div>
    {#if persona}
        <div class="live2d-wrapper">
            {#if persona.live2d_model_url}
                <Live2DViewer
                    bind:this={Viewer}
                    modelUrl={persona.live2d_model_url}
                    startVoiceUrl={isStartSpeech ? persona.start_voice_url : ""}
                    bind:closeupScale
                    bind:closeupOffset
                    bind:isCloseup
                    backgroundImage={persona.static_portrait_url ||
                        "/chat_bg.png"}
                    scale={0.2}
                    {expressionMap}
                    {hitMotionMap}
                    {persona}
                    on:interaction={handleInteraction}
                    on:interactionEnd={handleInteractionEnd}
                    bind:error_showSpeech
                    bind:autonomy
                />
            {:else}
                <div class="error-message">No Model URL</div>
            {/if}
        </div>

        <div class="chat-overlay">
            <div
                class="chat-content"
                style:height={viewportHeight ? `${viewportHeight}px` : "100%"}
            >
                <ChatWindow {showChat} {isLoading} />
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
            impl_connectTTS={connectTTSImpl}
            impl_disconnectTTS={disconnectTTSSocket}
            impl_changeCamera={() => Viewer?.toggleCamera()}
            bind:closeupScale
            bind:closeupOffset
            bind:isCloseup
            {affectionScore}
        />

        <ThoughtBubble
            text={thought1}
            visible={showThought1}
            customStyle="top: 5vh; left: 50%; transform: translateX(-50%); z-index: 20;"
            onEnded={handleThoughtEnded}
        />
        <ThoughtBubble
            text={thought2}
            visible={showThought2}
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
                    showDebugUI = !showDebugUI;
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
        height: 100vh; /* Fallback */
        height: 100dvh;
        overflow: hidden;
    }

    @media (display-mode: standalone) {
        main {
            height: 100vh;
        }
        .chat-overlay {
            height: 100vh;
        }
    }

    .vignette-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 100;
        transition: opacity 1.5s ease-in-out;
    }

    .vignette-black {
        background: radial-gradient(
            circle at center,
            transparent 30%,
            rgba(0, 0, 0, 0.4) 80%,
            rgba(0, 0, 0, 0.95) 150%
        );
        mix-blend-mode: multiply; /* Horror vibe */
    }

    .vignette-pink {
        background: radial-gradient(
            circle at center,
            transparent 30%,
            rgba(255, 182, 193, 0.4) 80%,
            rgba(255, 105, 180, 0.9) 150%
        );
        mix-blend-mode: screen; /* Romantic glow */
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
        height: 100vh; /* Fallback */
        height: 100dvh;
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

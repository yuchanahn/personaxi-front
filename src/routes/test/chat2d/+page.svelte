<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import ChatWindow2D from "$lib/components/chat/ChatWindow2D.svelte";
    import { messages, type Message } from "$lib/stores/messages";
    import type { Persona } from "$lib/types";

    const mockPersona: Persona = {
        id: "test-chat2d-persona",
        owner_id: [],
        name: "아리 베일",
        personaType: "2D",
        contentType: "character",
        instructions: [
            "Stay in character as Ari Vale.",
            "Use <say> for spoken dialogue.",
        ],
        promptExamples: [],
        tags: [],
        feedback: { view: 0 },
        voice_id: "",
        vrm_url: "",
        portrait_url: "https://picsum.photos/seed/personaxi-portrait/800/1200",
        static_portrait_url:
            "https://picsum.photos/seed/personaxi-portrait/800/1200",
        image_metadatas: [
            {
                url: "https://picsum.photos/seed/personaxi-scene-1/1280/720",
                static_url:
                    "https://picsum.photos/seed/personaxi-scene-1/1280/720",
                description: "비 오는 역 플랫폼의 야간 장면",
                type: "image",
            },
            {
                url: "https://picsum.photos/seed/personaxi-scene-2/1280/720",
                static_url:
                    "https://picsum.photos/seed/personaxi-scene-2/1280/720",
                description: "창가에 기대 선 인물의 측면 구도",
                type: "image",
            },
            {
                url: "https://picsum.photos/seed/personaxi-scene-3/1024/1024",
                static_url:
                    "https://picsum.photos/seed/personaxi-scene-3/1024/1024",
                description: "클로즈업 감정 장면",
                type: "image",
            },
        ],
        image_count: 3,
        visibility: "private",
        created_at: "",
        updated_at: "",
        creator_name: "Test",
        one_liner: "기억을 친밀함으로, 친밀함을 영향력으로 바꾸는 여자.",
        first_scene:
            "<img 0>\n빗소리가 플랫폼 지붕을 두드리고, 네온이 젖은 바닥 위로 길게 번진다.\n\n<say speaker=\"{{char}}\">왔네. 생각보다 늦었어.</say>\n\n그녀는 차분한 시선으로 당신을 위아래로 훑고는, 아주 느린 미소를 짓는다.\n\n<say speaker=\"{{char}}\">그래도 괜찮아. 아직은 화낼 정도까진 아니니까.</say>",
        greeting: "왔네. 이번엔 어디까지 버틸 수 있을까?",
        likes_count: 0,
        dislikes_count: 0,
        chat_count: 0,
        variables: [
            {
                name: "affection",
                var_type: "number",
                default_value: "42",
                description: "호감도",
            },
            {
                name: "tension",
                var_type: "number",
                default_value: "63",
                description: "긴장감",
            },
            {
                name: "trust",
                var_type: "number",
                default_value: "21",
                description: "신뢰도",
            },
        ],
        status_template:
            "<div class='status-strip'><span>affection {{affection}}</span><span>tension {{tension}}</span><span>trust {{trust}}</span></div>",
        status_template_css:
            ".status-strip{display:flex;gap:8px;flex-wrap:wrap}.status-strip span{padding:6px 10px;border-radius:999px;background:#1f2937;color:#f9fafb;font-size:12px}",
        interactiveUIEnabled: true,
    };

    let autoScroll = true;
    let showImage = true;
    let showBackground = false;
    let showVariableStatus = true;
    let showRatioOptions = false;
    let isLoading = false;
    let customPrompt = "";
    let streamChunkSize = 14;
    let streamIntervalMs = 90;
    let streamFinalizeDelayMs = 450;
    let streamIncludeSceneImages = true;
    let streamIncludeGeneratedImage = false;
    let streamIncludeVars = true;
    let streamUseHtmlBlock = true;
    let streamUseNarration = true;
    let streamUseDialogue = true;
    let streamTimer: ReturnType<typeof setTimeout> | null = null;
    let streamStepTimer: ReturnType<typeof setInterval> | null = null;

    function createFirstSceneMessage(): Message {
        return {
            role: "assistant",
            content: "<first_scene>",
            done: true,
            key: `first-scene-${Date.now()}`,
        };
    }

    function clearStreamTimers() {
        if (streamTimer) clearTimeout(streamTimer);
        if (streamStepTimer) clearInterval(streamStepTimer);
        streamTimer = null;
        streamStepTimer = null;
        isLoading = false;
    }

    function setMessageList(list: Message[]) {
        clearStreamTimers();
        messages.set(list);
    }

    function resetScene() {
        setMessageList([createFirstSceneMessage()]);
    }

    function injectCase(kind: string) {
        const base: Message[] = [
            createFirstSceneMessage(),
            {
                role: "user",
                content: "지금 상황 테스트 좀 해볼게.",
                done: true,
                key: `user-${Date.now()}`,
            },
        ];

        if (kind === "dialogue") {
            setMessageList([
                ...base,
                {
                    role: "assistant",
                    content:
                        "플랫폼 위 공기가 차갑게 식어 있다.\n\n<say speaker=\"{{char}}\">좋아. 이건 순수 대화형 케이스야.</say>\n\n<say speaker=\"{{char}}\">중간에 서술이 끼고, 다시 대사가 나와야 해.</say>",
                    done: true,
                    key: `assistant-${Date.now()}`,
                },
            ]);
            return;
        }

        if (kind === "images") {
            setMessageList([
                ...base,
                {
                    role: "assistant",
                    content:
                        "<img 0>\n빗물 자국이 유리창을 타고 길게 흘러내린다.\n\n<say speaker=\"{{char}}\">첫 번째 이미지는 여기서 바뀌어야 하고.</say>\n\n<img 1>\n그녀가 몸을 돌려 창가 쪽으로 반 걸음 옮긴다.\n\n<say speaker=\"{{char}}\">두 번째 장면 전환도 자연스러워야 해.</say>",
                    done: true,
                    key: `assistant-${Date.now()}`,
                },
            ]);
            return;
        }

        if (kind === "markdown-image") {
            setMessageList([
                ...base,
                {
                    role: "assistant",
                    content:
                        "<say speaker=\"{{char}}\">이건 생성된 상황 이미지가 마크다운으로 붙는 케이스.</say>\n\n![Situation Image](https://picsum.photos/seed/personaxi-generated/1024/1024)\n\n장면 이미지가 실제 로드된 뒤 스크롤이 끝까지 붙는지 확인.",
                    done: true,
                    key: `assistant-${Date.now()}`,
                },
            ]);
            return;
        }

        if (kind === "vars") {
            setMessageList([
                ...base,
                {
                    role: "assistant",
                    content:
                        "<say speaker=\"{{char}}\">이 케이스는 변수 상태 패널이 응답 종료 후에만 보여야 해.</say>\n\n<vars>\naffection=57\ntension=68\ntrust=29\n</vars>",
                    done: true,
                    key: `assistant-${Date.now()}`,
                },
            ]);
            return;
        }

        if (kind === "html") {
            setMessageList([
                ...base,
                {
                    role: "assistant",
                    content:
                        "<style>.test-card{padding:14px;border-radius:16px;background:linear-gradient(135deg,#111827,#1f2937);color:#f9fafb;border:1px solid rgba(255,255,255,.1)}.test-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.test-pill{padding:8px 10px;border-radius:999px;background:#374151;text-align:center;font-size:12px}</style><div class=\"test-card\"><strong>HTML/CSS 인터랙티브 블록</strong><p>스타일 블록이 먼저 오고, 카드가 렌더되어야 함.</p><div class=\"test-grid\"><div class=\"test-pill\">scene</div><div class=\"test-pill\">choice</div></div></div><say speaker=\"{{char}}\">그리고 뒤에 일반 대사도 이어져야 해.</say>",
                    done: true,
                    key: `assistant-${Date.now()}`,
                },
            ]);
            return;
        }
    }

    function simulateStream(raw: string) {
        clearStreamTimers();
        const assistantKey = `assistant-stream-${Date.now()}`;
        messages.set([
            createFirstSceneMessage(),
            {
                role: "user",
                content: "스트리밍 동작 테스트.",
                done: true,
                key: `user-${Date.now()}`,
            },
            {
                role: "assistant",
                content: "",
                done: false,
                key: assistantKey,
            },
        ]);

        isLoading = true;
        let sentLength = 0;

        streamStepTimer = setInterval(() => {
            sentLength = Math.min(raw.length, sentLength + streamChunkSize);
            const next = raw.slice(0, sentLength);

            messages.update((current) => {
                const updated = [...current];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                    updated[updated.length - 1] = {
                        ...last,
                        content: next,
                        done: false,
                    };
                }
                return updated;
            });

            if (sentLength >= raw.length) {
                if (streamStepTimer) clearInterval(streamStepTimer);
                streamStepTimer = null;
                streamTimer = setTimeout(() => {
                    messages.update((current) => {
                        const updated = [...current];
                        const last = updated[updated.length - 1];
                        if (last?.role === "assistant") {
                            updated[updated.length - 1] = {
                                ...last,
                                content: raw,
                                done: true,
                            };
                        }
                        return updated;
                    });
                    isLoading = false;
                    streamTimer = null;
                }, streamFinalizeDelayMs);
            }
        }, streamIntervalMs);
    }

    function buildStreamDialoguePayload() {
        const parts: string[] = [];

        if (streamIncludeSceneImages) {
            parts.push("<img 0>");
        }

        if (streamUseNarration) {
            parts.push(
                "젖은 플랫폼 위 공기가 천천히 내려앉고, 네온이 빗물 위로 길게 번진다.",
            );
        }

        if (streamUseDialogue) {
            parts.push(
                "<say speaker=\"{{char}}\">좋아. 이제 <say> 태그 스트리밍이 깨지지 않아야 해.</say>",
            );
        }

        if (streamUseNarration) {
            parts.push(
                "그녀는 시선을 낮게 깔고 당신의 반응을 확인하듯 한 박자 쉬어 간다.",
            );
        }

        if (streamIncludeSceneImages) {
            parts.push("<img 1>");
        }

        if (streamUseDialogue) {
            parts.push(
                "<say speaker=\"{{char}}\">중간 대사, 서술, 이미지 전환, 마지막 대사가 순서대로 보이면 된다.</say>",
            );
        }

        if (streamIncludeGeneratedImage) {
            parts.push(
                "![Situation Image](https://picsum.photos/seed/personaxi-generated-stream/1024/1024)",
            );
        }

        if (streamIncludeVars) {
            parts.push("<vars>\naffection=61\ntension=70\ntrust=33\n</vars>");
        }

        return parts.join("\n\n");
    }

    function buildStreamInteractivePayload() {
        const parts: string[] = [];

        if (streamUseHtmlBlock) {
            parts.push(
                "<style>.sim-card{padding:16px;border-radius:18px;background:#0f172a;color:white;border:1px solid rgba(255,255,255,.1)}.sim-row{display:flex;gap:8px;margin-top:12px}.sim-chip{padding:7px 10px;border-radius:999px;background:#334155;font-size:12px}</style><div class=\"sim-card\"><strong>스트리밍 HTML/CSS 블록</strong><p>전체가 올 때까지 멈춘 것처럼 보이면 안 된다.</p><div class=\"sim-row\"><div class=\"sim-chip\">alpha</div><div class=\"sim-chip\">beta</div></div></div>",
            );
        }

        if (streamIncludeSceneImages) {
            parts.push("<img 2>");
        }

        if (streamUseDialogue) {
            parts.push(
                "<say speaker=\"{{char}}\">HTML 다음에 대사가 이어질 때도 스크롤이 튀면 안 돼.</say>",
            );
        }

        if (streamUseNarration) {
            parts.push("장면이 조금 더 천천히 닫히고, 말풍선은 그 아래에서 이어진다.");
        }

        if (streamIncludeGeneratedImage) {
            parts.push(
                "![Situation Image](https://picsum.photos/seed/personaxi-html-generated/1200/800)",
            );
        }

        if (streamIncludeVars) {
            parts.push("<vars>\naffection=67\ntension=58\ntrust=41\n</vars>");
        }

        return parts.join("\n\n");
    }

    function simulateDialogueStream() {
        simulateStream(buildStreamDialoguePayload());
    }

    function simulateInteractiveStream() {
        simulateStream(buildStreamInteractivePayload());
    }

    function sendUserEcho() {
        const text = customPrompt.trim();
        if (!text) return;

        clearStreamTimers();
        messages.update((current) => [
            ...current,
            {
                role: "user",
                content: text,
                done: true,
                key: `user-${Date.now()}`,
            },
            {
                role: "assistant",
                content: `<say speaker="{{char}}">좋아. 방금 네가 입력한 문장을 기준으로 말풍선만 바로 붙여볼게.</say>\n\n${text}`,
                done: true,
                key: `assistant-${Date.now()}`,
            },
        ]);
        customPrompt = "";
    }

    onMount(() => {
        resetScene();
    });

    onDestroy(() => {
        clearStreamTimers();
    });
</script>

<svelte:head>
    <title>ChatWindow2D Test</title>
</svelte:head>

<div class="test-shell">
    <aside class="control-panel">
        <h1>ChatWindow2D Test</h1>
        <p class="intro">
            토큰 없이 2D 채팅 렌더, 스트림, 이미지, 변수 패널, HTML/CSS
            케이스를 바로 확인하는 테스트 페이지.
        </p>

        <section class="group">
            <h2>Quick Cases</h2>
            <div class="button-grid">
                <button on:click={resetScene}>Reset First Scene</button>
                <button on:click={() => injectCase("dialogue")}>Dialogue + Narration</button>
                <button on:click={() => injectCase("images")}>Image Tags</button>
                <button on:click={() => injectCase("markdown-image")}>Markdown Image</button>
                <button on:click={() => injectCase("vars")}>Vars Panel</button>
                <button on:click={() => injectCase("html")}>HTML / CSS Block</button>
            </div>
        </section>

        <section class="group">
            <h2>Stream Simulation</h2>
            <div class="button-grid">
                <button on:click={simulateDialogueStream}>Stream Dialogue</button>
                <button on:click={simulateInteractiveStream}>Stream HTML/CSS</button>
            </div>
        </section>

        <section class="group">
            <h2>Stream Controls</h2>
            <div class="range-stack">
                <label class="range-label">
                    <span>Chunk Size</span>
                    <strong>{streamChunkSize}</strong>
                </label>
                <input type="range" min="1" max="80" step="1" bind:value={streamChunkSize} />

                <label class="range-label">
                    <span>Tick Interval (ms)</span>
                    <strong>{streamIntervalMs}</strong>
                </label>
                <input type="range" min="20" max="400" step="10" bind:value={streamIntervalMs} />

                <label class="range-label">
                    <span>Finalize Delay (ms)</span>
                    <strong>{streamFinalizeDelayMs}</strong>
                </label>
                <input type="range" min="0" max="1500" step="50" bind:value={streamFinalizeDelayMs} />
            </div>

            <div class="toggle-stack">
                <label><input type="checkbox" bind:checked={streamUseDialogue} /> Dialogue</label>
                <label><input type="checkbox" bind:checked={streamUseNarration} /> Narration</label>
                <label><input type="checkbox" bind:checked={streamUseHtmlBlock} /> HTML/CSS Block</label>
                <label><input type="checkbox" bind:checked={streamIncludeSceneImages} /> Scene Images</label>
                <label><input type="checkbox" bind:checked={streamIncludeGeneratedImage} /> Generated Image</label>
                <label><input type="checkbox" bind:checked={streamIncludeVars} /> Vars Payload</label>
            </div>
        </section>

        <section class="group">
            <h2>Options</h2>
            <label><input type="checkbox" bind:checked={autoScroll} /> Auto Scroll</label>
            <label><input type="checkbox" bind:checked={showImage} /> Show Images</label>
            <label><input type="checkbox" bind:checked={showBackground} /> Background Mode</label>
            <label><input type="checkbox" bind:checked={showVariableStatus} /> Variable Panel</label>
        </section>

        <section class="group">
            <h2>User Input Echo</h2>
            <textarea
                bind:value={customPrompt}
                rows="4"
                placeholder="유저 메시지를 즉시 넣고 바로 assistant 응답도 확인"
            ></textarea>
            <button class="wide" on:click={sendUserEcho}>Append User + Assistant</button>
        </section>
    </aside>

    <main class="preview-panel">
        <div class="preview-frame">
            <ChatWindow2D
                {isLoading}
                persona={mockPersona}
                {showImage}
                {autoScroll}
                {showBackground}
                {showVariableStatus}
                bind:showRatioOptions
                SendMessage={() => {}}
            />
        </div>
    </main>
</div>

<style>
    .test-shell {
        height: 100vh;
        display: grid;
        grid-template-columns: 360px minmax(0, 1fr);
        background: #0b1020;
        color: #e5e7eb;
        overflow: hidden;
    }

    .control-panel {
        padding: 20px;
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        background: #111827;
        overflow-y: auto;
    }

    .preview-panel {
        min-height: 100vh;
        height: 100vh;
        background:
            radial-gradient(circle at top, rgba(59, 130, 246, 0.12), transparent 30%),
            #0b1020;
        overflow: hidden;
    }

    .preview-frame {
        height: 100vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .preview-frame :global(.chat-window) {
        flex: 1;
        height: 100vh;
        max-width: 960px;
        margin: 0 auto;
        padding-top: 28px;
        padding-bottom: 140px;
    }

    h1 {
        margin: 0 0 8px;
        font-size: 1.4rem;
    }

    h2 {
        margin: 0 0 10px;
        font-size: 0.95rem;
        color: #f3f4f6;
    }

    .intro {
        margin: 0 0 18px;
        color: #9ca3af;
        line-height: 1.5;
        font-size: 0.92rem;
    }

    .group {
        margin-bottom: 18px;
        padding: 14px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .button-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }

    button {
        appearance: none;
        border: 0;
        border-radius: 12px;
        padding: 11px 12px;
        background: #2563eb;
        color: white;
        font: inherit;
        cursor: pointer;
    }

    button:hover {
        background: #1d4ed8;
    }

    .wide {
        width: 100%;
        margin-top: 10px;
    }

    .range-stack {
        display: grid;
        gap: 10px;
    }

    .range-label {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: -2px;
        font-size: 0.86rem;
    }

    .range-label strong {
        color: #93c5fd;
        font-size: 0.84rem;
    }

    input[type="range"] {
        width: 100%;
    }

    .toggle-stack {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 10px;
        margin-top: 14px;
    }

    label {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        color: #d1d5db;
        font-size: 0.92rem;
    }

    textarea {
        width: 100%;
        resize: vertical;
        min-height: 90px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: #0f172a;
        color: white;
        padding: 12px;
        font: inherit;
        box-sizing: border-box;
    }

    @media (max-width: 980px) {
        .test-shell {
            height: auto;
            min-height: 100vh;
            grid-template-columns: 1fr;
            overflow: visible;
        }

        .control-panel {
            border-right: 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .preview-panel {
            min-height: 70vh;
            height: auto;
            overflow: visible;
        }

        .preview-frame {
            height: auto;
            min-height: 70vh;
        }

        .preview-frame :global(.chat-window) {
            height: auto;
            min-height: 70vh;
            padding-bottom: 120px;
        }
    }
</style>

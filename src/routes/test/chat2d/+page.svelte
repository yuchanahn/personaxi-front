<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import ChatWindow2DTest from "$lib/components/chat/ChatWindow2DTest.svelte";
    import { messages, type Message } from "$lib/stores/messages";
    import type { Persona } from "$lib/types";

    const basePersona: Persona = {
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
        chat_style_css: "",
    };

    const sharedCssPresets = {
        none: "",
        dialogue:
            ".message :global(.chat-bubble){font-size:1.03rem;line-height:1.82;letter-spacing:-0.01em}.message :global(.speaker-name){font-weight:700}",
        narration:
            ".narration-block{font-size:1.02rem;line-height:1.92;font-style:italic;letter-spacing:-0.01em}.narration-block p{margin:0 0 0.9rem}",
        noir: ".message :global(.chat-bubble){border-radius:18px;backdrop-filter:blur(10px)}.narration-block{font-family:Georgia,serif;line-height:1.9}.message :global(.chat-bubble-content p){margin:0}",
        saju: '@import url("https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap");.message,.narration-block{font-family:"Gowun Batang","Batang",serif}.message :global(.chat-bubble){border-radius:20px}.narration-block{line-height:1.9}',
    } satisfies Record<string, string>;

    let autoScroll = true;
    let showImage = true;
    let showBackground = false;
    let showVariableStatus = true;
    let showRatioOptions = false;
    let isLoading = false;
    let customPrompt = "";
    let customAssistantOutput = "";
    const customAssistantPlaceholder =
        '<say speaker="{{char}}">직접 붙여넣은 출력 테스트</say>\n\n<p>plain html 단락</p>\n\n<div class="card">ui block</div>';
    let sharedCssDraft = "";
    let selectedCssPreset: keyof typeof sharedCssPresets = "none";
    let showCustomAssistantModal = false;
    let showSharedCssModal = false;
    let streamFeedCharsPerTick = 14;
    let streamFeedTickMs = 90;
    let streamDoneDelayMs = 450;
    let typingCharsPerSecond = 12;
    let useRuntimeTypingSpeed = false;
    let streamIncludeSceneImages = true;
    let streamIncludeGeneratedImage = false;
    let streamIncludeVars = true;
    let streamUseHtmlBlock = true;
    let streamUseNarration = true;
    let streamUseDialogue = true;
    let streamTimer: ReturnType<typeof setTimeout> | null = null;
    let streamStepTimer: ReturnType<typeof setInterval> | null = null;
    let interactionSubmitCount = 0;
    let previewPersona: Persona = {
        ...basePersona,
        chat_style_css: sharedCssDraft,
    };

    $: previewPersona = {
        ...basePersona,
        chat_style_css: sharedCssDraft,
    };

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
        if (kind === "dialogue") {
            simulateStream(
                "플랫폼 위 공기가 차갑게 식어 있다.\n\n<say speaker=\"{{char}}\">좋아. 이건 순수 대화형 케이스야.</say>\n\n<say speaker=\"{{char}}\">중간에 서술이 끼고, 다시 대사가 나와야 해.</say>",
                "지금 상황 테스트 좀 해볼게.",
            );
            return;
        }

        if (kind === "images") {
            simulateStream(
                "<img 0>\n빗물 자국이 유리창을 타고 길게 흘러내린다.\n\n<say speaker=\"{{char}}\">첫 번째 이미지는 여기서 바뀌어야 하고.</say>\n\n<img 1>\n그녀가 몸을 돌려 창가 쪽으로 반 걸음 옮긴다.\n\n<say speaker=\"{{char}}\">두 번째 장면 전환도 자연스러워야 해.</say>",
                "이미지 전환 테스트.",
            );
            return;
        }

        if (kind === "markdown-image") {
            simulateStream(
                "<say speaker=\"{{char}}\">이건 생성된 상황 이미지가 마크다운으로 붙는 케이스.</say>\n\n![Situation Image](https://picsum.photos/seed/personaxi-generated/1024/1024)\n\n장면 이미지가 실제 로드된 뒤 스크롤이 끝까지 붙는지 확인.",
                "생성 이미지 출력 테스트.",
            );
            return;
        }

        if (kind === "vars") {
            simulateStream(
                "<say speaker=\"{{char}}\">이 케이스는 변수 상태 패널이 응답 종료 후에만 보여야 해.</say>\n\n<vars>\naffection=57\ntension=68\ntrust=29\n</vars>",
                "변수 패널 타이밍 테스트.",
            );
            return;
        }

        if (kind === "html") {
            simulateStream(
                "<style>.test-card{padding:14px;border-radius:16px;background:linear-gradient(135deg,#111827,#1f2937);color:#f9fafb;border:1px solid rgba(255,255,255,.1)}.test-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.test-pill{padding:8px 10px;border-radius:999px;background:#374151;text-align:center;font-size:12px}</style><div class=\"test-card\"><strong>HTML/CSS 인터랙티브 블록</strong><p>스타일 블록이 먼저 오고, 카드가 렌더되어야 함.</p><div class=\"test-grid\"><div class=\"test-pill\">scene</div><div class=\"test-pill\">choice</div></div></div><say speaker=\"{{char}}\">그리고 뒤에 일반 대사도 이어져야 해.</say>",
                "HTML/CSS 블록 스트림 테스트.",
            );
            return;
        }

        if (kind === "html-dialogue-mix") {
            simulateStream(
                "<p>첫 서술은 그냥 일반 HTML 단락이다.</p>\n\n<say speaker=\"{{char}}\">여기서부터는 일반 대사 타이핑이 다시 자연스러워야 해.</say>\n\n<div class=\"test-card\"><strong>작은 카드 블록</strong><p>이 구간만 덩어리로 보여도 된다.</p></div>\n\n<say speaker=\"{{char}}\">그리고 다시 대사로 복귀해야 한다.</say>",
                "HTML과 일반 대사 혼합 테스트.",
            );
            return;
        }

        if (kind === "broken-html-tail") {
            simulateStream(
                "<say speaker=\"{{char}}\">불완전 HTML 꼬리 테스트.</say>\n\n<div class=\"test-card\"><strong>여기까진 정상</strong><p>뒤에 깨진 꼬리가 와도 안내만 무한히 뜨면 안 된다.</p></div>\n\n<div class=\"half-card\"",
                "깨진 HTML 꼬리 테스트.",
            );
            return;
        }

        if (kind === "broken-paragraph-tail") {
            simulateStream(
                "<p>첫 문단은 정상적으로 시작한다. 그리고 뒤쪽에서 태그가 살짝 잘리더라도, 일반 HTML 서술이면 브라우저가 최대한 관대하게 처리하는지 보고 싶다.</p>\n\n<p class=\"note-frag\">이 문단은 끝이 잘린 채로 멈춘",
                "깨진 문단 꼬리 테스트.",
            );
            return;
        }

        if (kind === "broken-say-tail") {
            simulateStream(
                "<say speaker=\"{{char}}\">여기까지는 정상 대사다.</say>\n\n<say speaker=\"{{char}}\">이 다음 대사는 태그가 덜 닫힌 채로 끊겨",
                "깨진 say 꼬리 테스트.",
            );
            return;
        }

        if (kind === "broken-style-tail") {
            simulateStream(
                "<style>.frag-card{padding:14px;border-radius:16px;background:#1f2937;color:#f9fafb}.frag-pill{display:inline-block;padding:6px 10px;border-radius:999px;background:#374151}</style><div class=\"frag-card\"><strong>정상 스타일 블록</strong><p>여기까진 렌더돼야 한다.</p></div>\n\n<style>.half-style{padding:12px;color:#fff;background:linear-gradient(135deg,#4338ca,#7c3aed)",
                "깨진 style 꼬리 테스트.",
            );
            return;
        }

        if (kind === "broken-interactive-tail") {
            simulateStream(
                "<div class=\"game-ui-group\" data-group=\"broken-one\"><div class=\"fortune-box\"><p>첫 버튼은 정상이다.</p><button class=\"game-choice fortune-btn\" data-role=\"state-choice\" data-id=\"topic\" data-action=\"select-option\" data-value=\"love\">연애</button></div></div>\n\n<div class=\"game-ui-group\" data-group=\"broken-two\"><button class=\"game-choice fortune-btn\" data-role=\"state-choice\" data-id=\"route\"",
                "깨진 인터랙티브 꼬리 테스트.",
            );
            return;
        }

        if (kind === "broken-mixed-stack") {
            simulateStream(
                "<p>첫 서술은 정상이다.</p>\n\n<div class=\"test-card\"><strong>중간 카드</strong><p>이 카드는 일반 div 기반이라 텍스트처럼 흘러가도 된다.</p></div>\n\n<say speaker=\"{{char}}\">여기서 다시 대사로 붙는다.</say>\n\n<div class=\"game-ui-group\" data-group=\"mix-frag\"><button class=\"game-choice\" data-role=\"state-choice\" data-id=\"pick\" data-action=\"select-option\" data-value=\"A\">A</button><button class=\"game-choice\" data-role=\"state-choice\" data-id=\"pick\"",
                "혼합형 깨짐 테스트.",
            );
            return;
        }

        if (kind === "interactive-single") {
            simulateStream(
                "<div class=\"game-ui-group\" data-group=\"single-fortune\"><style>.fortune-box{padding:16px;border-radius:18px;background:#111827;color:#f9fafb;border:1px solid rgba(255,255,255,.12)}.fortune-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.fortune-btn{padding:8px 12px;border-radius:999px;background:#7c3aed;color:white;border:0}.fortune-btn.selected{outline:2px solid #f5d0fe;transform:translateY(-1px)}.fortune-input{width:100%;margin-top:10px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:#0f172a;color:#fff;box-sizing:border-box}.game-validation-message{margin-top:10px;color:#fca5a5;font-size:13px}</style><div class=\"fortune-box\"><strong>단일 그룹 테스트</strong><p>선택 버튼은 상태만 저장하고, 마지막 버튼이 실제 제출을 수행해야 한다.</p><div class=\"fortune-row\"><button class=\"game-choice fortune-btn\" data-role=\"state-choice\" data-required=\"true\" data-required-message=\"주제를 먼저 선택해주세요.\" data-id=\"topic\" data-action=\"select-option\" data-value=\"love\">연애</button><button class=\"game-choice fortune-btn\" data-role=\"state-choice\" data-required=\"true\" data-required-message=\"주제를 먼저 선택해주세요.\" data-id=\"topic\" data-action=\"select-option\" data-value=\"career\">직업</button></div><input class=\"game-input fortune-input\" data-id=\"memo\" data-required=\"true\" data-required-message=\"메모를 입력해주세요.\" placeholder=\"메모\" /><div class=\"fortune-row\"><button class=\"game-choice fortune-btn\" data-role=\"submit-action\" data-id=\"fortune_start\" data-action=\"select-option\" data-value=\"RUN\">풀이 시작</button></div></div></div>",
                "단일 인터랙티브 그룹 테스트.",
            );
            return;
        }

        if (kind === "interactive-multi") {
            simulateStream(
                "<style>.group-grid{display:grid;gap:14px}.group-card{padding:16px;border-radius:18px;background:#0f172a;color:#f8fafc;border:1px solid rgba(255,255,255,.08)}.group-title{margin:0 0 8px;font-size:15px;font-weight:700}.group-row{display:flex;gap:8px;flex-wrap:wrap}.group-btn{padding:8px 12px;border-radius:999px;background:#2563eb;color:#fff;border:0}.group-btn.selected{outline:2px solid #bfdbfe}.group-input{width:100%;margin-top:10px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:#111827;color:#fff;box-sizing:border-box}.group-counter{margin-top:10px;font-size:13px;color:#93c5fd}.game-validation-message{margin-top:10px;color:#fca5a5;font-size:13px}</style><div class=\"group-grid\"><div class=\"game-ui-group group-card\" data-group=\"route-a\"><p class=\"group-title\">A 그룹 선택 + 실행</p><div class=\"group-row\"><button class=\"game-choice group-btn\" data-role=\"state-choice\" data-required=\"true\" data-required-message=\"A 그룹 선택이 필요합니다.\" data-id=\"route_a\" data-action=\"select-option\" data-value=\"alpha\">alpha</button><button class=\"game-choice group-btn\" data-role=\"state-choice\" data-required=\"true\" data-required-message=\"A 그룹 선택이 필요합니다.\" data-id=\"route_a\" data-action=\"select-option\" data-value=\"beta\">beta</button></div><div class=\"group-row\" style=\"margin-top:10px\"><button class=\"game-choice group-btn\" data-role=\"submit-action\" data-id=\"route_a_run\" data-action=\"select-option\" data-value=\"run_a\">A 실행</button></div></div><div class=\"game-ui-group group-card\" data-group=\"route-b\"><p class=\"group-title\">B 그룹 선택 + 입력 + 실행</p><div class=\"group-row\"><button class=\"game-choice group-btn\" data-role=\"state-choice\" data-required=\"true\" data-required-message=\"B 그룹 방향을 먼저 고르세요.\" data-id=\"route_b\" data-action=\"select-option\" data-value=\"left\">left</button><button class=\"game-choice group-btn\" data-role=\"state-choice\" data-required=\"true\" data-required-message=\"B 그룹 방향을 먼저 고르세요.\" data-id=\"route_b\" data-action=\"select-option\" data-value=\"right\">right</button></div><input class=\"game-input group-input\" data-id=\"route_b_note\" data-required=\"true\" data-required-message=\"B 그룹 메모를 입력하세요.\" placeholder=\"이 그룹 메모\" /><div class=\"group-row\" style=\"margin-top:10px\"><button class=\"game-choice group-btn\" data-role=\"submit-action\" data-id=\"route_b_run\" data-action=\"select-option\" data-value=\"run_b\">B 실행</button></div></div></div><say speaker=\"{{char}}\">두 그룹이 서로 섞이면 안 된다.</say>",
                "복수 인터랙티브 그룹 테스트.",
            );
            return;
        }
    }

    function appendInteractiveResult(payload: string) {
        interactionSubmitCount += 1;
        messages.update((current) => [
            ...current,
            {
                role: "user",
                content: payload,
                done: true,
                key: `user-interactive-${Date.now()}-${interactionSubmitCount}`,
            },
            {
                role: "assistant",
                content: `<say speaker="{{char}}">interactive payload ${interactionSubmitCount} 수신 완료.</say>\n\n\`\`\`text\n${payload}\n\`\`\``,
                done: true,
                key: `assistant-interactive-${Date.now()}-${interactionSubmitCount}`,
            },
        ]);
    }

    function simulateStream(raw: string, userText = "스트리밍 동작 테스트.") {
        clearStreamTimers();
        const assistantKey = `assistant-stream-${Date.now()}`;
        messages.set([
            createFirstSceneMessage(),
            {
                role: "user",
                content: userText,
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
            sentLength = Math.min(raw.length, sentLength + streamFeedCharsPerTick);
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
                }, streamDoneDelayMs);
            }
        }, streamFeedTickMs);
    }

    function appendCustomAssistantOutput(asStream: boolean) {
        const raw = customAssistantOutput.trim();
        if (!raw) return;

        clearStreamTimers();
        const assistantKey = `assistant-custom-${Date.now()}`;

        messages.update((current) => [
            ...current,
            {
                role: "assistant",
                content: asStream ? "" : raw,
                done: !asStream,
                key: assistantKey,
            },
        ]);

        if (!asStream) {
            customAssistantOutput = "";
            return;
        }

        isLoading = true;
        let sentLength = 0;

        streamStepTimer = setInterval(() => {
            sentLength = Math.min(raw.length, sentLength + streamFeedCharsPerTick);
            const next = raw.slice(0, sentLength);

            messages.update((current) =>
                current.map((msg) =>
                    msg.key === assistantKey
                        ? {
                              ...msg,
                              content: next,
                              done: false,
                          }
                        : msg,
                ),
            );

            if (sentLength >= raw.length) {
                if (streamStepTimer) clearInterval(streamStepTimer);
                streamStepTimer = null;
                streamTimer = setTimeout(() => {
                    messages.update((current) =>
                        current.map((msg) =>
                            msg.key === assistantKey
                                ? {
                                      ...msg,
                                      content: raw,
                                      done: true,
                                  }
                                : msg,
                        ),
                    );
                    isLoading = false;
                    streamTimer = null;
                    customAssistantOutput = "";
                    showCustomAssistantModal = false;
                }, streamDoneDelayMs);
            }
        }, streamFeedTickMs);
    }

    function applySharedCssPreset(preset: keyof typeof sharedCssPresets) {
        selectedCssPreset = preset;
        sharedCssDraft = sharedCssPresets[preset];
    }

    function resetSharedCssDraft() {
        selectedCssPreset = "none";
        sharedCssDraft = "";
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

    function applyStreamPreset(kind: "slow" | "balanced" | "burst") {
        if (kind === "slow") {
            streamFeedCharsPerTick = 5;
            streamFeedTickMs = 180;
            streamDoneDelayMs = 700;
            typingCharsPerSecond = 6;
            return;
        }

        if (kind === "burst") {
            streamFeedCharsPerTick = 40;
            streamFeedTickMs = 45;
            streamDoneDelayMs = 120;
            typingCharsPerSecond = 18;
            return;
        }

        streamFeedCharsPerTick = 14;
        streamFeedTickMs = 90;
        streamDoneDelayMs = 450;
        typingCharsPerSecond = 12;
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
                <button on:click={() => injectCase("html-dialogue-mix")}>HTML + Dialogue Mix</button>
                <button on:click={() => injectCase("broken-html-tail")}>Broken HTML Tail</button>
                <button on:click={() => injectCase("broken-paragraph-tail")}>Broken Paragraph Tail</button>
                <button on:click={() => injectCase("broken-say-tail")}>Broken Say Tail</button>
                <button on:click={() => injectCase("broken-style-tail")}>Broken Style Tail</button>
                <button on:click={() => injectCase("broken-interactive-tail")}>Broken Interactive Tail</button>
                <button on:click={() => injectCase("broken-mixed-stack")}>Broken Mixed Stack</button>
                <button on:click={() => injectCase("interactive-single")}>Interactive Single</button>
                <button on:click={() => injectCase("interactive-multi")}>Interactive Multi</button>
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
            <p class="helper-text">
                위 두 값은 실제 스트림이 얼마나 자주, 몇 글자씩 들어오는지입니다.
                아래 타이핑 속도는 화면에 한 글자씩 보이는 속도입니다.
            </p>
            <div class="button-grid preset-grid">
                <button on:click={() => applyStreamPreset("slow")}>느린 응답</button>
                <button on:click={() => applyStreamPreset("balanced")}>보통</button>
                <button on:click={() => applyStreamPreset("burst")}>청크 몰림</button>
            </div>
            <div class="range-stack">
                <label class="range-label" for="stream-feed-size">
                    <span>실제 스트림 청크 크기</span>
                    <strong>{streamFeedCharsPerTick}자</strong>
                </label>
                <input id="stream-feed-size" type="range" min="1" max="80" step="1" bind:value={streamFeedCharsPerTick} />

                <label class="range-label" for="stream-feed-interval">
                    <span>실제 스트림 청크 간격</span>
                    <strong>{streamFeedTickMs}ms</strong>
                </label>
                <input id="stream-feed-interval" type="range" min="20" max="400" step="10" bind:value={streamFeedTickMs} />

                <label class="range-label" for="typing-cps">
                    <span>화면 타이핑 속도</span>
                    <strong>{useRuntimeTypingSpeed ? "실서비스 자동" : `초당 ${typingCharsPerSecond}자`}</strong>
                </label>
                <input id="typing-cps" type="range" min="1" max="30" step="1" bind:value={typingCharsPerSecond} disabled={useRuntimeTypingSpeed} />

                <label class="inline-toggle">
                    <input type="checkbox" bind:checked={useRuntimeTypingSpeed} />
                    실서비스 자동 속도 사용
                </label>

                <label class="range-label" for="stream-done-delay">
                    <span>마지막 완료 신호 지연</span>
                    <strong>{streamDoneDelayMs}ms</strong>
                </label>
                <input id="stream-done-delay" type="range" min="0" max="1500" step="50" bind:value={streamDoneDelayMs} />
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

        <section class="group">
            <h2>Custom Assistant Output</h2>
            <p class="helper-text">
                직접 붙여넣은 assistant 출력 결과를 모달에서 넣고, 스트림 또는
                완료 메시지로 테스트합니다.
            </p>
            <div class="button-grid single-col">
                <button on:click={() => (showCustomAssistantModal = true)}>
                    Open Custom Assistant Modal
                </button>
            </div>
        </section>

        <section class="group">
            <h2>Shared CSS Preview</h2>
            <p class="helper-text">
                미리 정의한 shared CSS를 선택하거나 직접 수정해서 테스트 채팅창에
                바로 반영합니다.
            </p>
            <div class="button-grid single-col">
                <button on:click={() => (showSharedCssModal = true)}>
                    Open Shared CSS Modal
                </button>
            </div>
        </section>
    </aside>

    <main class="preview-panel">
        <div class="preview-frame">
            <ChatWindow2DTest
                {isLoading}
                persona={previewPersona}
                {showImage}
                {autoScroll}
                {showBackground}
                {showVariableStatus}
                typingCharsPerSecond={useRuntimeTypingSpeed ? 58 : typingCharsPerSecond}
                SendMessage={appendInteractiveResult}
            />
        </div>
    </main>
</div>

{#if showCustomAssistantModal}
    <div
        class="test-modal-overlay"
        role="presentation"
        on:click={() => (showCustomAssistantModal = false)}
    >
        <div
            class="test-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Custom assistant output"
            on:click={(e) => e.stopPropagation()}
        >
            <div class="test-modal-header">
                <h2>Custom Assistant Output</h2>
                <button
                    class="modal-close"
                    type="button"
                    on:click={() => (showCustomAssistantModal = false)}
                >
                    x
                </button>
            </div>
            <p class="helper-text">
                assistant 최종 출력 결과를 그대로 붙여넣고, 스트림 또는 즉시 완료
                형태로 추가합니다.
            </p>
            <textarea
                bind:value={customAssistantOutput}
                rows="14"
                placeholder={customAssistantPlaceholder}
            ></textarea>
            <div class="button-grid single-col modal-actions">
                <button on:click={() => appendCustomAssistantOutput(true)}>
                    Stream Custom Assistant
                </button>
                <button on:click={() => appendCustomAssistantOutput(false)}>
                    Append Custom Assistant
                </button>
            </div>
        </div>
    </div>
{/if}

{#if showSharedCssModal}
    <div
        class="test-modal-overlay"
        role="presentation"
        on:click={() => (showSharedCssModal = false)}
    >
        <div
            class="test-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Shared CSS preview"
            on:click={(e) => e.stopPropagation()}
        >
            <div class="test-modal-header">
                <h2>Shared CSS Preview</h2>
                <button
                    class="modal-close"
                    type="button"
                    on:click={() => (showSharedCssModal = false)}
                >
                    x
                </button>
            </div>
            <p class="helper-text">
                아래 CSS는 테스트 채팅창의 `persona.chat_style_css`로 바로
                적용됩니다.
            </p>
            <div class="button-grid preset-grid modal-preset-grid">
                <button on:click={() => applySharedCssPreset("none")}>Clear</button>
                <button on:click={() => applySharedCssPreset("dialogue")}>
                    Dialogue
                </button>
                <button on:click={() => applySharedCssPreset("narration")}>
                    Narration
                </button>
                <button on:click={() => applySharedCssPreset("noir")}>Noir</button>
                <button on:click={() => applySharedCssPreset("saju")}>Saju</button>
            </div>
            <textarea bind:value={sharedCssDraft} rows="14"></textarea>
            <div class="button-grid modal-preset-grid">
                <button on:click={resetSharedCssDraft}>Reset CSS</button>
                <button on:click={() => (showSharedCssModal = false)}>
                    Close
                </button>
            </div>
        </div>
    </div>
{/if}

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

    .helper-text {
        margin: 0 0 12px;
        color: #9ca3af;
        line-height: 1.5;
        font-size: 0.86rem;
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

    .preset-grid {
        margin-bottom: 12px;
    }

    .single-col {
        grid-template-columns: 1fr;
        margin-top: 10px;
    }

    .test-modal-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(3, 7, 18, 0.72);
        backdrop-filter: blur(8px);
        z-index: 60;
    }

    .test-modal {
        width: min(860px, 100%);
        max-height: min(88vh, 920px);
        overflow: auto;
        padding: 18px;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: #111827;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
    }

    .test-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
    }

    .test-modal-header h2 {
        margin: 0;
    }

    .modal-close {
        width: 38px;
        min-width: 38px;
        height: 38px;
        padding: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
    }

    .modal-actions,
    .modal-preset-grid {
        margin-top: 12px;
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

    .inline-toggle {
        margin-top: 2px;
        margin-bottom: 0;
        color: #9ca3af;
        font-size: 0.86rem;
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

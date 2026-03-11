<script lang="ts">
    export let text: string = "";
    export let visible: boolean = false;
    export let customStyle: string = "";
    export let speed: number = 30;

    export let onEnded: () => void = () => {};

    import { onDestroy } from "svelte";

    let displayedText: string = "";
    let isTyping: boolean = false;
    let typeTimeout: any;
    let sanitizedText: string = "";

    // 상태 추적용 변수
    let lastTriggeredText: string = "";
    let wasVisible: boolean = false;

    function sanitizeThoughtText(raw: string): string {
        return raw
            .replace(/\[[^\]]+\]/g, "")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/[ \t]{2,}/g, " ")
            .trim();
    }

    $: sanitizedText = sanitizeThoughtText(text);

    // 반응형 로직 개선: 조건문을 훨씬 강력하게 변경
    $: {
        // 1. 보여달라고 요청이 왔고(visible), 텍스트가 있을 때
        if (visible && sanitizedText) {
            // A. 텍스트가 아예 바뀌었거나
            // B. 방금 막 visible이 true가 되었을 때 (이전 프레임엔 안 보였음)
            // -> 이 경우 무조건 타이핑 새로 시작
            if (sanitizedText !== lastTriggeredText || !wasVisible) {
                startTypewriter(sanitizedText);
            }
            wasVisible = true;
        }
        // 2. 숨겨달라고 요청이 왔을 때
        else if (!visible) {
            wasVisible = false;
            // 타이핑도 다 끝났다면 내용을 비워둠 (다음 등장을 위해 깔끔하게)
            if (!isTyping) {
                displayedText = "";
            }
        }
    }

    function splitSentences(text: string): string[] {
        // 1. 문장 부호(. ? ! ~ 。 ？ ！) 또는 줄바꿈을 기준으로 1차 분할
        const regex = /([^.?!~。？！\n]+[.?!~。？！\n]*)/g;
        const matches = text.match(regex);
        if (!matches) return [text];

        const rawChunks = matches
            .map((m) => m.trim())
            .filter((m) => m.length > 0);
        const merged: string[] = [];
        let buffer = "";

        // 2. 너무 짧은 문장은 다음 문장과 합치기 (최소 10글자 기준)
        for (const chunk of rawChunks) {
            if (buffer) {
                buffer += " " + chunk;
            } else {
                buffer = chunk;
            }

            // 버퍼가 충분히 길면 확정 (10글자 미만이면 다음 문장과 합침)
            if (buffer.length >= 10) {
                merged.push(buffer);
                buffer = "";
            }
        }

        // 남은 버퍼 처리
        if (buffer) {
            merged.push(buffer);
        }

        return merged;
    }

    function startTypewriter(fullText: string) {
        clearTimeout(typeTimeout);
        isTyping = true;
        lastTriggeredText = fullText;

        const sentences = splitSentences(fullText);
        let currentIndex = 0;

        const loop = () => {
            // 강제 종료 조건
            if (!visible && !wasVisible) {
                isTyping = false;
                return;
            }

            if (currentIndex >= sentences.length) {
                isTyping = false;
                onEnded();
                return;
            }

            const chunk = sentences[currentIndex];
            displayedText = chunk;

            // 읽는 시간 계산 (자막 리듬감)
            // 기본 1.2초 + 글자당 0.12초
            const duration = Math.max(1200, chunk.length * 120);

            currentIndex++;
            typeTimeout = setTimeout(loop, duration);
        };

        loop();
    }

    onDestroy(() => {
        clearTimeout(typeTimeout);
    });
</script>

{#if (visible || isTyping) && sanitizedText}
    <div class="thought-bubble-wrapper" style={customStyle}>
        <div class="thought-bubble">
            <div class="glow-effect"></div>
            <div class="content-row">
                <span class="icon">💭</span>
                <p>{displayedText}</p>
            </div>
        </div>
        <div class="bubble-tail"></div>
        <div class="bubble-tail-small"></div>
    </div>
{/if}

<style>
    /* CSS 디자인은 완벽하므로 그대로 유지합니다 */
    .thought-bubble-wrapper {
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        width: max-content;
        max-width: 80vw;
        bottom: 120px;

        animation:
            elastic-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
            float-bob 3s ease-in-out infinite 0.5s;
    }

    .thought-bubble {
        position: relative;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.75);
        backdrop-filter: blur(16px) saturate(180%);
        -webkit-backdrop-filter: blur(16px) saturate(180%);
        border-radius: 28px;
        border: 1px solid rgba(255, 255, 255, 0.8);
        border-bottom: 1px solid rgba(255, 255, 255, 0.4);
        padding: 1rem 1.75rem;
        box-shadow:
            0 10px 30px -5px rgba(0, 0, 0, 0.1),
            0 4px 10px -2px rgba(0, 0, 0, 0.05),
            inset 0 0 0 1px rgba(255, 255, 255, 0.5);
    }

    .glow-effect {
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: radial-gradient(
            circle at 50% 50%,
            rgba(255, 255, 255, 0.8) 0%,
            transparent 60%
        );
        opacity: 0.6;
        pointer-events: none;
    }

    .content-row {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 1;
    }

    .icon {
        font-size: 1.5rem;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
        animation: pulse-icon 2s infinite ease-in-out;
    }

    p {
        margin: 0;
        white-space: pre-wrap;
        color: #2d3436;
        font-size: 1.05rem;
        font-weight: 600;
        line-height: 1.5;
        letter-spacing: -0.01em;
        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8);
        min-width: 10px;
    }

    .bubble-tail {
        width: 12px;
        height: 12px;
        background: rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(16px);
        border-radius: 50%;
        margin-top: 6px;
        margin-left: -20px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.6);
    }

    .bubble-tail-small {
        width: 8px;
        height: 8px;
        background: rgba(255, 255, 255, 0.5);
        backdrop-filter: blur(16px);
        border-radius: 50%;
        margin-top: 4px;
        margin-left: -35px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    @keyframes elastic-pop {
        0% {
            opacity: 0;
            transform: translateX(-50%) scale(0.6) translateY(40px);
        }
        100% {
            opacity: 1;
            transform: translateX(-50%) scale(1) translateY(0);
        }
    }
    @keyframes float-bob {
        0%,
        100% {
            transform: translateX(-50%) translateY(0);
        }
        50% {
            transform: translateX(-50%) translateY(-8px);
        }
    }
    @keyframes pulse-icon {
        0%,
        100% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.1);
        }
    }
    @keyframes blink {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0;
        }
    }
</style>

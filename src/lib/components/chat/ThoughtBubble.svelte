<script lang="ts">
    export let text: string = "";
    export let visible: boolean = false;
    export let customStyle: string = "";
    export let speed: number = 30;

    export let onEnded: () => void = () => {};

    import { onMount, onDestroy } from "svelte";

    let displayedText: string = "";
    let isTyping: boolean = false;
    let typeTimeout: any;

    // 상태 추적용 변수
    let lastTriggeredText: string = "";
    let wasVisible: boolean = false;

    // 반응형 로직 개선: 조건문을 훨씬 강력하게 변경
    $: {
        // 1. 보여달라고 요청이 왔고(visible), 텍스트가 있을 때
        if (visible && text) {
            // A. 텍스트가 아예 바뀌었거나
            // B. 방금 막 visible이 true가 되었을 때 (이전 프레임엔 안 보였음)
            // -> 이 경우 무조건 타이핑 새로 시작
            if (text !== lastTriggeredText || !wasVisible) {
                startTypewriter(text);
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

    function startTypewriter(fullText: string) {
        clearTimeout(typeTimeout); // 기존 예약된 타이핑 올킬

        isTyping = true;
        displayedText = ""; // 즉시 비움 (잔상 제거)
        lastTriggeredText = fullText; // 현재 작업 중인 텍스트 기록

        let i = 0;

        const typeNextChar = () => {
            // visible이 false로 바뀌었어도, 타이핑 중이면 끝까지 수행함
            if (i < fullText.length) {
                displayedText = fullText.slice(0, i + 1);
                i++;
                typeTimeout = setTimeout(typeNextChar, speed);
            } else {
                isTyping = false; // 타이핑 종료 선언 -> 이때 visible이 false라면 말풍선 사라짐
                onEnded();
            }
        };

        typeNextChar(); // 대기 없이 즉시 실행
    }

    onDestroy(() => {
        clearTimeout(typeTimeout);
    });
</script>

{#if (visible || isTyping) && text}
    <div class="thought-bubble-wrapper" style={customStyle}>
        <div class="thought-bubble">
            <div class="glow-effect"></div>
            <div class="content-row">
                <span class="icon">💭</span>
                <p>
                    {displayedText}
                    {#if isTyping}<span class="cursor">|</span>{/if}
                </p>
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
        font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI",
            Roboto, sans-serif;
        font-size: 1.05rem;
        font-weight: 600;
        line-height: 1.5;
        letter-spacing: -0.01em;
        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8);
        min-width: 10px;
    }

    .cursor {
        display: inline-block;
        color: #0984e3;
        font-weight: 400;
        margin-left: 2px;
        animation: blink 0.8s infinite;
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

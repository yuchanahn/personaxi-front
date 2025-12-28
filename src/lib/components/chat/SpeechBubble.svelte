<script lang="ts">
    import { settings } from "$lib/stores/settings";
    import { onDestroy } from "svelte";

    export let text: string = "";
    export let visible: boolean = false;

    // 타이핑
    export let speed: number = 28; // 기본 글자 속도
    export let pausePunct: number = 140; // 문장부호 추가 딜레이
    export let holdMs: number = 1400; // 끝난 뒤 유지 시간
    export let onEnded: () => void = () => {};

    // UI 옵션
    export let variant: "light" | "dark" | "neon" =
        $settings.theme === "dark" ? "dark" : "light";
    export let position: "bottom" | "top" = "bottom";
    export let x: number = 50; // left: 50% 같은 의미 (vw 기준)
    export let y: number = 140; // bottom/top px
    export let maxWidth: string = "78vw";
    export let customStyle: string = "";
    export let showCaret: boolean = true;

    // 내부 상태
    let displayedText = "";
    let speakerName = "";
    let isTyping = false;

    let typeTimeout: ReturnType<typeof setTimeout> | null = null;
    let endTimeout: ReturnType<typeof setTimeout> | null = null;

    let lastTriggeredText = "";
    let wasVisible = false;

    // 입력 포맷: speaker="..." + <dialogue>...</dialogue>
    const speakerRegex = /speaker=["']([^"']*)["']/;
    const contentRegex = /<dialogue[^>]*>([\s\S]*?)<\/dialogue>/;

    $: {
        // visible로 켜질 때만 "새 텍스트"를 트리거
        if (visible && text) {
            if (text !== lastTriggeredText || !wasVisible) {
                parseAndStart(text);
            }
            wasVisible = true;
        } else if (!visible) {
            wasVisible = false;

            // 타이핑 중이 아니면 깔끔히 비움
            if (!isTyping) {
                displayedText = "";
                speakerName = "";
            }
            // 화면에서 숨겨졌으면 예약된 onEnded 호출도 취소
            clearTimers();
        }
    }

    function clearTimers() {
        if (typeTimeout) clearTimeout(typeTimeout);
        if (endTimeout) clearTimeout(endTimeout);
        typeTimeout = null;
        endTimeout = null;
    }

    function parseAndStart(rawText: string) {
        clearTimers();

        const nameMatch = rawText.match(speakerRegex);
        speakerName = nameMatch ? nameMatch[1].trim() : "";

        const contentMatch = rawText.match(contentRegex);
        let cleanText = (contentMatch ? contentMatch[1] : rawText).trim();

        startTypewriter(cleanText, rawText);
    }

    function startTypewriter(cleanText: string, rawText: string) {
        isTyping = true;
        displayedText = "";
        lastTriggeredText = rawText;

        let i = 0;

        const tick = () => {
            if (!visible && !wasVisible) return; // 혹시 모를 유령 타이핑 방지

            if (i < cleanText.length) {
                displayedText = cleanText.slice(0, i + 1);
                const char = cleanText[i];
                i++;

                let delay = speed;

                // 문장부호/줄바꿈에서 더 오래 멈추기
                if ([".", "?", "!", "\n", ",", "…"].includes(char))
                    delay += pausePunct;
                // 공백은 살짝 빠르게
                if (char === " ") delay = Math.max(8, Math.floor(speed * 0.55));

                typeTimeout = setTimeout(tick, delay);
            } else {
                isTyping = false;
                // 끝난 뒤 잠깐 보여주고 콜백
                endTimeout = setTimeout(() => {
                    // 중간에 숨겨졌으면 호출하지 않음
                    if (visible || wasVisible) onEnded();
                }, holdMs);
            }
        };

        tick();
    }

    onDestroy(() => clearTimers());

    // 위치 스타일
    $: posStyle =
        position === "bottom"
            ? `left:${x}vw; bottom:${y}px;`
            : `left:${x}vw; top:${y}px;`;

    $: variantClass = `variant-${variant}`;
</script>

{#if (visible || isTyping) && text}
    <div
        class={`bubble-wrap ${variantClass} ${position === "top" ? "pos-top" : "pos-bottom"}`}
        style={`${posStyle} max-width:${maxWidth}; ${customStyle}`}
        aria-live="polite"
        aria-atomic="true"
    >
        {#if speakerName}
            <div class="speaker-badge" title={speakerName}>
                <span class="dot" />
                <span class="name">{speakerName}</span>
            </div>
        {/if}

        <div class="bubble">
            <div class="bubble-inner">
                <p class="text">
                    {displayedText}{#if showCaret && isTyping}<span
                            class="caret"
                            aria-hidden="true">▍</span
                        >{/if}
                </p>
            </div>
        </div>
    </div>
{/if}

<style>
    /* ---- 레이아웃 ---- */
    .bubble-wrap {
        position: fixed;
        z-index: 9999;
        transform: translateX(-50%);
        pointer-events: none;
        width: max-content;

        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;

        animation: in 220ms cubic-bezier(0.2, 1, 0.2, 1) both;
    }

    /* 위쪽에 표시할 때 꼬리 방향 반대로 */
    .pos-top .bubble::after {
        top: -10px;
        bottom: auto;
        transform: translateX(-50%) rotate(180deg);
        filter: drop-shadow(0 -10px 18px rgba(0, 0, 0, 0.18));
    }

    /* ---- 화자 뱃지 ---- */
    .speaker-badge {
        pointer-events: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;

        padding: 6px 12px;
        border-radius: 999px;

        font-size: 0.9rem;
        font-weight: 700;
        letter-spacing: 0.2px;

        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);

        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.22);
    }

    .speaker-badge .dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        opacity: 0.9;
    }

    .speaker-badge .name {
        max-width: 42vw;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* ---- 말풍선 ---- */
    .bubble {
        position: relative;
        width: 100%;
        border-radius: 22px;

        /* 그라데이션 보더 느낌 */
        padding: 1px;
        box-shadow:
            0 22px 60px rgba(0, 0, 0, 0.22),
            0 2px 10px rgba(0, 0, 0, 0.1);
    }

    .bubble-inner {
        border-radius: 21px;
        padding: 14px 18px;

        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.14);

        /* 살짝 “유리” 느낌 */
        background: radial-gradient(
                1200px 140px at 50% -40px,
                rgba(255, 255, 255, 0.45),
                rgba(255, 255, 255, 0)
            ),
            linear-gradient(
                180deg,
                rgba(255, 255, 255, 0.68),
                rgba(255, 255, 255, 0.46)
            );
    }

    /* 꼬리(별도 SVG 없이) */
    .bubble::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: -10px;
        transform: translateX(-50%);

        width: 18px;
        height: 12px;
        background: inherit; /* 바깥 gradient 패딩층을 따라가게 */
        border-radius: 0 0 12px 12px;

        /* clip-path로 꼬리 모양 */
        clip-path: polygon(0% 0%, 100% 0%, 50% 100%);
        filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.18));
    }

    .text {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.55;
        font-size: 1.08rem;
        font-weight: 650;
    }

    /* 캐럿(타이핑 느낌 강화) */
    .caret {
        display: inline-block;
        transform: translateY(1px);
        animation: blink 900ms steps(1) infinite;
    }

    /* ---- Variants ---- */
    .variant-light .bubble {
        background: linear-gradient(
            90deg,
            rgba(59, 130, 246, 0.55),
            rgba(236, 72, 153, 0.45),
            rgba(16, 185, 129, 0.35)
        );
    }
    .variant-light .text {
        color: rgba(10, 10, 12, 0.92);
    }
    .variant-light .speaker-badge {
        background: linear-gradient(
            90deg,
            rgba(59, 130, 246, 0.65),
            rgba(236, 72, 153, 0.55)
        );
        color: rgba(255, 255, 255, 0.95);
    }
    .variant-light .speaker-badge .dot {
        background: rgba(255, 255, 255, 0.9);
    }

    .variant-dark .bubble {
        background: linear-gradient(
            90deg,
            rgba(148, 163, 184, 0.28),
            rgba(99, 102, 241, 0.22),
            rgba(236, 72, 153, 0.18)
        );
    }
    .variant-dark .bubble-inner {
        background: radial-gradient(
                1200px 140px at 50% -40px,
                rgba(255, 255, 255, 0.1),
                rgba(255, 255, 255, 0)
            ),
            linear-gradient(
                180deg,
                rgba(17, 24, 39, 0.78),
                rgba(17, 24, 39, 0.6)
            );
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .variant-dark .text {
        color: rgba(255, 255, 255, 0.9);
    }
    .variant-dark .speaker-badge {
        background: linear-gradient(
            90deg,
            rgba(99, 102, 241, 0.62),
            rgba(236, 72, 153, 0.5)
        );
        color: rgba(255, 255, 255, 0.92);
    }
    .variant-dark .speaker-badge .dot {
        background: rgba(255, 255, 255, 0.82);
    }

    .variant-neon .bubble {
        background: linear-gradient(
            90deg,
            rgba(34, 211, 238, 0.65),
            rgba(168, 85, 247, 0.55),
            rgba(251, 191, 36, 0.45)
        );
    }
    .variant-neon .bubble-inner {
        background: radial-gradient(
                900px 160px at 50% -40px,
                rgba(255, 255, 255, 0.3),
                rgba(255, 255, 255, 0)
            ),
            linear-gradient(180deg, rgba(2, 6, 23, 0.7), rgba(2, 6, 23, 0.56));
        border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .variant-neon .text {
        color: rgba(255, 255, 255, 0.92);
    }
    .variant-neon .speaker-badge {
        background: linear-gradient(
            90deg,
            rgba(34, 211, 238, 0.45),
            rgba(168, 85, 247, 0.42)
        );
        color: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(34, 211, 238, 0.2);
    }
    .variant-neon .speaker-badge .dot {
        background: rgba(34, 211, 238, 0.9);
    }

    /* ---- 애니메이션 ---- */
    @keyframes in {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px) scale(0.98);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
        }
    }
    @keyframes blink {
        0%,
        49% {
            opacity: 1;
        }
        50%,
        100% {
            opacity: 0;
        }
    }

    /* 모션 싫어하는 사용자 배려 */
    @media (prefers-reduced-motion: reduce) {
        .bubble-wrap {
            animation: none;
        }
        .caret {
            animation: none;
            opacity: 1;
        }
    }
</style>

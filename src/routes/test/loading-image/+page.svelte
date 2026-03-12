<script lang="ts">
    import NeuronIcon from "$lib/components/icons/NeuronIcon.svelte";
    import Icon from "@iconify/svelte";

    type Candidate = {
        id: number;
        name: string;
        note: string;
        tone: string;
    };

    const candidates: Candidate[] = [
        {
            id: 1,
            name: "Signal Orb",
            note: "무난한 브랜드 카드",
            tone: "clean",
        },
        {
            id: 2,
            name: "Cinema Gate",
            note: "영상 시작 전 대기실 느낌",
            tone: "cinema",
        },
        {
            id: 3,
            name: "Scanline Core",
            note: "조금 더 SF스럽게",
            tone: "scanline",
        },
        {
            id: 4,
            name: "Soft Pulse",
            note: "가장 덜 자극적인 타입",
            tone: "soft",
        },
        {
            id: 5,
            name: "Stage Light",
            note: "라이브/버튜버 쪽 분위기",
            tone: "stage",
        },
        {
            id: 6,
            name: "Glass Dock",
            note: "조금 더 앱 UI 느낌",
            tone: "glass",
        },
        {
            id: 7,
            name: "Poster Vault",
            note: "카드형, 텍스트 강조",
            tone: "poster",
        },
        {
            id: 8,
            name: "Minimal Wire",
            note: "로고만 남긴 절제형",
            tone: "minimal",
        },
    ];
</script>

<svelte:head>
    <title>Loading Image Test</title>
</svelte:head>

<div class="page">
    <header class="hero">
        <p class="eyebrow">PersonaXi Test</p>
        <h1>Loading Card Candidates</h1>
        <p class="intro">
            비디오 에셋 로딩 전 카드 후보입니다. 번호만 집어서 말하면 바로
            반영하기 쉽게 만들어뒀습니다.
        </p>
    </header>

    <section class="grid">
        {#each candidates as candidate}
            <article class="panel">
                <div class="panel-head">
                    <div>
                        <span class="index">#{candidate.id}</span>
                        <h2>{candidate.name}</h2>
                    </div>
                    <p>{candidate.note}</p>
                </div>

                <div class={`preview ${candidate.tone}`}>
                    {#if candidate.tone === "clean"}
                        <div class="orb">
                            <NeuronIcon size={38} color="currentColor" />
                        </div>
                        <div class="copy">
                            <strong>PersonaXi</strong>
                            <span>Loading scene...</span>
                        </div>
                        <div class="bars"><span></span><span></span><span></span></div>
                    {:else if candidate.tone === "cinema"}
                        <div class="frame-top"></div>
                        <div class="cinema-center">
                            <div class="halo"></div>
                            <Icon icon="ph:play-fill" width="26" />
                        </div>
                        <div class="copy">
                            <strong>Scene Buffering</strong>
                            <span>Preparing motion and audio</span>
                        </div>
                    {:else if candidate.tone === "scanline"}
                        <div class="scan-orb">
                            <NeuronIcon size={34} color="currentColor" variant="double" />
                        </div>
                        <div class="copy">
                            <strong>Initializing Layer</strong>
                            <span>Streaming visual data</span>
                        </div>
                        <div class="meter"><i></i></div>
                    {:else if candidate.tone === "soft"}
                        <div class="soft-ring">
                            <div class="dot"></div>
                        </div>
                        <div class="copy">
                            <strong>Loading...</strong>
                            <span>Please wait a moment</span>
                        </div>
                    {:else if candidate.tone === "stage"}
                        <div class="stage-lights">
                            <span></span><span></span><span></span>
                        </div>
                        <div class="stage-badge">
                            <NeuronIcon size={34} color="currentColor" />
                        </div>
                        <div class="copy">
                            <strong>Entering Stage</strong>
                            <span>Lights, motion, expression</span>
                        </div>
                    {:else if candidate.tone === "glass"}
                        <div class="glass-chip">
                            <NeuronIcon size={28} color="currentColor" />
                            <span>PersonaXi</span>
                        </div>
                        <div class="glass-wave"></div>
                        <div class="copy">
                            <strong>Preparing Preview</strong>
                            <span>Rendering media layer</span>
                        </div>
                    {:else if candidate.tone === "poster"}
                        <div class="poster-box">
                            <div class="poster-mark">PXI</div>
                            <div class="copy">
                                <strong>Loading Asset</strong>
                                <span>video / motion / voice</span>
                            </div>
                        </div>
                    {:else if candidate.tone === "minimal"}
                        <div class="minimal-core">
                            <NeuronIcon size={42} color="currentColor" variant="simple" />
                        </div>
                        <div class="minimal-line"></div>
                        <div class="copy">
                            <strong>PersonaXi</strong>
                        </div>
                    {/if}
                </div>
            </article>
        {/each}
    </section>
</div>

<style>
    :global(body) {
        background:
            radial-gradient(circle at top, rgba(255, 210, 96, 0.08), transparent 28%),
            #07090f;
    }

    .page {
        min-height: 100vh;
        color: var(--foreground);
        padding: 32px;
        box-sizing: border-box;
    }

    .hero {
        max-width: 900px;
        margin: 0 auto 28px auto;
    }

    .eyebrow {
        margin: 0 0 8px 0;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.75rem;
        color: color-mix(in srgb, var(--primary) 75%, white 25%);
    }

    h1 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3.2rem);
        line-height: 1;
    }

    .intro {
        margin: 12px 0 0 0;
        max-width: 720px;
        color: var(--muted-foreground);
        font-size: 0.98rem;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 18px;
        max-width: 1400px;
        margin: 0 auto;
    }

    .panel {
        background: color-mix(in srgb, var(--card) 86%, black 14%);
        border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.22);
    }

    .panel-head {
        padding: 16px 16px 10px 16px;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
    }

    .panel-head h2 {
        margin: 4px 0 0 0;
        font-size: 1.05rem;
    }

    .panel-head p {
        margin: 4px 0 0 0;
        color: var(--muted-foreground);
        font-size: 0.8rem;
        text-align: right;
    }

    .index {
        display: inline-flex;
        padding: 3px 8px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 18%, transparent);
        color: color-mix(in srgb, var(--primary) 85%, white 15%);
        font-size: 0.74rem;
        font-weight: 700;
    }

    .preview {
        aspect-ratio: 9 / 11;
        margin: 0 16px 16px 16px;
        border-radius: 20px;
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 14px;
        padding: 20px;
        box-sizing: border-box;
        text-align: center;
    }

    .copy {
        display: flex;
        flex-direction: column;
        gap: 4px;
        position: relative;
        z-index: 2;
    }

    .copy strong {
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: 0.02em;
    }

    .copy span {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.72);
    }

    .clean {
        color: #f7f3ea;
        background:
            radial-gradient(circle at 50% 18%, rgba(255, 177, 66, 0.2), transparent 28%),
            linear-gradient(180deg, #171c27 0%, #0d1018 100%);
    }

    .orb,
    .scan-orb,
    .stage-badge,
    .minimal-core {
        width: 72px;
        height: 72px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        z-index: 2;
    }

    .orb {
        color: #ffbf57;
        background: rgba(255, 191, 87, 0.08);
        border: 1px solid rgba(255, 191, 87, 0.22);
        box-shadow: 0 16px 40px rgba(255, 191, 87, 0.12);
    }

    .bars {
        display: flex;
        gap: 6px;
        position: relative;
        z-index: 2;
    }

    .bars span {
        width: 24px;
        height: 4px;
        border-radius: 999px;
        background: rgba(255, 191, 87, 0.7);
        animation: pulseBar 1.2s ease-in-out infinite;
    }

    .bars span:nth-child(2) { animation-delay: 0.15s; }
    .bars span:nth-child(3) { animation-delay: 0.3s; }

    .cinema {
        color: #fff7e6;
        background:
            linear-gradient(180deg, rgba(255,255,255,0.04), transparent 18%),
            linear-gradient(180deg, #0e0d0d 0%, #161016 100%);
    }

    .frame-top {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 12px;
        background: repeating-linear-gradient(
            90deg,
            rgba(255,255,255,0.1) 0 14px,
            rgba(255,255,255,0.03) 14px 28px
        );
    }

    .cinema-center {
        position: relative;
        width: 82px;
        height: 82px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffd36a;
        background: rgba(255, 211, 106, 0.08);
        border: 1px solid rgba(255, 211, 106, 0.18);
    }

    .halo {
        position: absolute;
        inset: -14px;
        border-radius: 999px;
        border: 1px solid rgba(255, 211, 106, 0.15);
        animation: slowSpin 5s linear infinite;
    }

    .scanline {
        color: #d7fbff;
        background:
            repeating-linear-gradient(
                180deg,
                rgba(149, 240, 255, 0.045) 0 2px,
                transparent 2px 6px
            ),
            linear-gradient(180deg, #07161b 0%, #091016 100%);
    }

    .scan-orb {
        color: #7ef0ff;
        background: rgba(126, 240, 255, 0.08);
        border: 1px solid rgba(126, 240, 255, 0.22);
    }

    .meter {
        width: 120px;
        height: 7px;
        border-radius: 999px;
        background: rgba(255,255,255,0.08);
        overflow: hidden;
        position: relative;
        z-index: 2;
    }

    .meter i {
        display: block;
        width: 45%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #56f0ff, #c5fdff);
        animation: scanMove 1.6s ease-in-out infinite;
    }

    .soft {
        color: #fff;
        background:
            radial-gradient(circle at 50% 24%, rgba(255,255,255,0.14), transparent 22%),
            linear-gradient(180deg, #26213a 0%, #171425 100%);
    }

    .soft-ring {
        width: 82px;
        height: 82px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.18);
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .soft-ring .dot {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: #fff3d2;
        animation: breathe 1.8s ease-in-out infinite;
    }

    .stage {
        color: #fff7ed;
        background:
            radial-gradient(circle at 50% -8%, rgba(255, 149, 77, 0.25), transparent 30%),
            linear-gradient(180deg, #1d1013 0%, #0d0910 100%);
    }

    .stage-lights {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .stage-lights span {
        position: absolute;
        top: -10%;
        width: 42%;
        height: 55%;
        filter: blur(18px);
        opacity: 0.34;
        background: linear-gradient(180deg, rgba(255, 183, 77, 0.55), transparent 80%);
        clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
    }

    .stage-lights span:nth-child(1) { left: -4%; }
    .stage-lights span:nth-child(2) { left: 29%; }
    .stage-lights span:nth-child(3) { right: -4%; }

    .stage-badge {
        color: #ffbf74;
        background: rgba(255, 191, 116, 0.08);
        border: 1px solid rgba(255, 191, 116, 0.2);
    }

    .glass {
        color: #eef6ff;
        background:
            linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03)),
            linear-gradient(180deg, #111a26 0%, #091018 100%);
    }

    .glass-chip {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        backdrop-filter: blur(12px);
        position: relative;
        z-index: 2;
    }

    .glass-chip span {
        font-size: 0.92rem;
        font-weight: 700;
    }

    .glass-wave {
        width: 140px;
        height: 56px;
        border-radius: 999px;
        background:
            radial-gradient(circle at 20% 50%, rgba(104, 204, 255, 0.3), transparent 36%),
            radial-gradient(circle at 80% 50%, rgba(255, 255, 255, 0.16), transparent 30%);
        animation: drift 2.8s ease-in-out infinite;
    }

    .poster {
        color: #fff8e7;
        background:
            linear-gradient(180deg, rgba(255,195,97,0.08), transparent 18%),
            linear-gradient(180deg, #17110f 0%, #0d0a0b 100%);
    }

    .poster-box {
        width: 100%;
        max-width: 220px;
        border: 1px solid rgba(255, 205, 112, 0.18);
        border-radius: 18px;
        padding: 20px 16px;
        background: rgba(255, 255, 255, 0.03);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
    }

    .poster-mark {
        display: inline-flex;
        margin-bottom: 14px;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.18em;
        color: #ffc76d;
    }

    .minimal {
        color: #f2f5ff;
        background: linear-gradient(180deg, #111319 0%, #08090d 100%);
    }

    .minimal-core {
        color: rgba(255,255,255,0.92);
    }

    .minimal-line {
        width: 72px;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
    }

    @keyframes pulseBar {
        0%, 100% { opacity: 0.36; transform: scaleX(0.88); }
        50% { opacity: 1; transform: scaleX(1); }
    }

    @keyframes slowSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    @keyframes scanMove {
        0% { transform: translateX(-14px); width: 32%; }
        50% { transform: translateX(46px); width: 54%; }
        100% { transform: translateX(-14px); width: 32%; }
    }

    @keyframes breathe {
        0%, 100% { transform: scale(0.72); opacity: 0.42; }
        50% { transform: scale(1); opacity: 1; }
    }

    @keyframes drift {
        0%, 100% { transform: translateX(-8px); opacity: 0.6; }
        50% { transform: translateX(8px); opacity: 1; }
    }

    @media (max-width: 720px) {
        .page {
            padding: 20px 14px;
        }

        .grid {
            grid-template-columns: 1fr;
        }
    }
</style>

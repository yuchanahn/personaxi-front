<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Icon from "@iconify/svelte";

    export let score: number = 0;

    const clamp = (v: number, min: number, max: number) =>
        Math.max(min, Math.min(max, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // --- SVG ring ---
    const R = 28;
    const CIRC = 2 * Math.PI * R;

    // --- Motion preference ---
    let reduceMotion = false;
    let media: MediaQueryList | null = null;

    // --- 3D tilt + glare (smoothed) ---
    let hostEl: HTMLDivElement | null = null;
    let tiltX = 0,
        tiltY = 0,
        targetTiltX = 0,
        targetTiltY = 0;
    let glareX = 50,
        glareY = 50,
        targetGlareX = 50,
        targetGlareY = 50;
    let rafTilt = 0;

    // --- score transitions ---
    let prevScore = score;
    let pulse = false;
    let shake = false;
    let pulseTimer: ReturnType<typeof setTimeout> | null = null;
    let shakeTimer: ReturnType<typeof setTimeout> | null = null;

    // --- colors computed in TS (NOT css vars inside svg) ---
    let activeColor = "#9ca3af";
    let glowColor = "#cbd5e1";
    let gradA = "#e5e7eb";
    let gradB = "#f472b6";
    let gradC = "#ef4444";
    let gradId = "aff-grad";

    // --- heartbeat ---
    let beatDur = 1200;
    let beatScale = 1.08;

    // --- particles ---
    type Particle = {
        id: number;
        x: number;
        y: number;
        size: number;
        rot: number;
        icon: string;
        expires: number;
    };
    let particles: Particle[] = [];
    let nextParticleId = 0;
    let rafCleanup = 0;

    const ICONS = [
        "ph:heart-fill",
        "ph:sparkle",
        "ph:sparkle-fill",
        "ph:star-four-fill",
    ];

    function hexToRgb(hex: string) {
        const h = hex.replace("#", "");
        const full =
            h.length === 3
                ? h
                      .split("")
                      .map((c) => c + c)
                      .join("")
                : h;
        const n = parseInt(full, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function rgbToHex(r: number, g: number, b: number) {
        const to = (x: number) =>
            clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0");
        return `#${to(r)}${to(g)}${to(b)}`;
    }
    function mixHex(a: string, b: string, t: number) {
        const A = hexToRgb(a),
            B = hexToRgb(b);
        return rgbToHex(
            lerp(A.r, B.r, t),
            lerp(A.g, B.g, t),
            lerp(A.b, B.b, t),
        );
    }

    // Gray -> Pink -> Red continuous ramp
    function getColorContinuous(s: number) {
        const t = clamp(s, 0, 100) / 100;
        const c0 = "#9ca3af";
        const c1 = "#f472b6";
        const c2 = "#ef4444";
        if (t <= 0.55) return mixHex(c0, c1, t / 0.55);
        return mixHex(c1, c2, (t - 0.55) / 0.45);
    }

    function updateVisualsFromScore() {
        const t = clamp(score, 0, 100) / 100;

        activeColor = getColorContinuous(score);
        glowColor = mixHex(activeColor, "#ffffff", 0.45);

        // SVG gradient stops: computed colors (robust)
        gradA = mixHex(activeColor, "#ffffff", 0.55);
        gradB = activeColor;
        gradC = mixHex(activeColor, "#000000", 0.18);

        beatDur = Math.round(lerp(1400, 820, t));
        beatScale = lerp(1.03, 1.12, t);
    }

    function firePulse() {
        pulse = true;
        if (pulseTimer) clearTimeout(pulseTimer);
        pulseTimer = setTimeout(() => (pulse = false), 560);
    }

    function fireShake() {
        shake = true;
        if (shakeTimer) clearTimeout(shakeTimer);
        shakeTimer = setTimeout(() => (shake = false), 340);
    }

    function spawnParticle() {
        const id = nextParticleId++;
        const x = (Math.random() - 0.5) * 96;
        const y = (Math.random() - 0.5) * 56;
        const size = 10 + Math.random() * 16;
        const rot = (Math.random() - 0.5) * 40;
        const icon =
            ICONS[Math.floor(Math.random() * ICONS.length)] ?? "ph:heart-fill";
        const ttl = 950;
        particles = [
            ...particles,
            { id, x, y, size, rot, icon, expires: Date.now() + ttl },
        ];
    }

    function startCleanupLoop() {
        if (rafCleanup) return;
        const tick = () => {
            const now = Date.now();
            if (particles.length) {
                const next = particles.filter((p) => p.expires > now);
                if (next.length !== particles.length) particles = next;
            }
            rafCleanup = requestAnimationFrame(tick);
        };
        rafCleanup = requestAnimationFrame(tick);
    }

    function triggerParticles(amount: number) {
        const count = clamp(Math.round(amount), 1, 12);
        for (let i = 0; i < count; i++) spawnParticle();
        startCleanupLoop();
    }

    function ensureTiltLoop() {
        if (rafTilt) return;
        const tick = () => {
            tiltX = lerp(tiltX, targetTiltX, 0.12);
            tiltY = lerp(tiltY, targetTiltY, 0.12);
            glareX = lerp(glareX, targetGlareX, 0.12);
            glareY = lerp(glareY, targetGlareY, 0.12);

            const near =
                Math.abs(tiltX - targetTiltX) < 0.02 &&
                Math.abs(tiltY - targetTiltY) < 0.02 &&
                Math.abs(glareX - targetGlareX) < 0.2 &&
                Math.abs(glareY - targetGlareY) < 0.2;

            if (near && targetTiltX === 0 && targetTiltY === 0) {
                rafTilt = 0;
                return;
            }
            rafTilt = requestAnimationFrame(tick);
        };
        rafTilt = requestAnimationFrame(tick);
    }

    function onPointerMove(e: PointerEvent) {
        if (!hostEl || reduceMotion) return;
        const rect = hostEl.getBoundingClientRect();
        const px = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        const py = clamp((e.clientY - rect.top) / rect.height, 0, 1);

        const maxTilt = 7;
        targetTiltY = lerp(-maxTilt, maxTilt, px);
        targetTiltX = lerp(maxTilt, -maxTilt, py);

        targetGlareX = px * 100;
        targetGlareY = py * 100;

        ensureTiltLoop();
    }

    function onPointerLeave() {
        if (reduceMotion) return;
        targetTiltX = 0;
        targetTiltY = 0;
        targetGlareX = 50;
        targetGlareY = 50;
        ensureTiltLoop();
    }

    // score change effects
    $: if (score !== prevScore) {
        const d = score - prevScore;
        if (d > 0) {
            triggerParticles(d);
            firePulse();
        } else {
            fireShake();
        }
        prevScore = score;
    }

    $: visualScore = score <= 0 ? 1 : score;

    $: {
        const t = clamp(visualScore, 0, 100) / 100;

        activeColor = getColorContinuous(visualScore);
        glowColor = mixHex(activeColor, "#ffffff", 0.45);

        gradA = mixHex(activeColor, "#ffffff", 0.55);
        gradB = activeColor;
        gradC = mixHex(activeColor, "#000000", 0.18);

        beatDur = Math.round(lerp(1400, 820, t));
        beatScale = lerp(1.03, 1.12, t);
    }

    onMount(() => {
        gradId = `aff-grad-${Math.random().toString(16).slice(2)}`;

        media = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
        const apply = () => {
            reduceMotion = !!media?.matches;
        };
        apply();
        const handler = () => apply();
        media?.addEventListener?.("change", handler);
        reduceMotion = false;
        return () => media?.removeEventListener?.("change", handler);
    });

    onDestroy(() => {
        if (pulseTimer) clearTimeout(pulseTimer);
        if (shakeTimer) clearTimeout(shakeTimer);
        if (rafCleanup) cancelAnimationFrame(rafCleanup);
        if (rafTilt) cancelAnimationFrame(rafTilt);
    });
</script>

<div
    bind:this={hostEl}
    class="affection-container"
    class:pulse
    class:shake
    on:pointermove={onPointerMove}
    on:pointerleave={onPointerLeave}
    style="
    --rx:{tiltX}deg;
    --ry:{tiltY}deg;
    --glare-x:{glareX}%;
    --glare-y:{glareY}%;
    --beat-dur:{beatDur}ms;
    --beat-scale:{beatScale};
  "
>
    <div class="pulse-ring"></div>
    <div class="glare"></div>

    <div class="heart-wrapper" style="color:{activeColor}">
        <div class="heart-core">
            <Icon icon="ph:heart-fill" width="28" height="28" />
        </div>

        {#each particles as p (p.id)}
            <div
                class="particle"
                style="
          left: calc(50% + {p.x}px);
          top: calc(50% + {p.y}px);
          font-size: {p.size}px;
          transform: translate(-50%, -50%) rotate({p.rot}deg);
          color:{activeColor};
        "
            >
                <Icon icon={p.icon} />
            </div>
        {/each}
    </div>

    <div class="progress-ring">
        <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            style="overflow:visible"
        >
            <defs>
                <linearGradient id={gradId} x1="10%" y1="10%" x2="90%" y2="90%">
                    <stop offset="0%" stop-color={gradA} stop-opacity="0.95" />
                    <stop offset="50%" stop-color={gradB} stop-opacity="0.95" />
                    <stop
                        offset="100%"
                        stop-color={gradC}
                        stop-opacity="0.90"
                    />
                </linearGradient>
            </defs>

            <circle
                class="track"
                cx="32"
                cy="32"
                r={R}
                fill="none"
                stroke-width="4"
            />

            <circle
                class="progress"
                cx="32"
                cy="32"
                r={R}
                fill="none"
                stroke-width="4"
                stroke={"url(#" + gradId + ")"}
                stroke-dasharray={CIRC}
                stroke-dashoffset={CIRC -
                    (CIRC * clamp(visualScore, 0, 100)) / 100}
                transform="rotate(-90 32 32)"
                style="filter: drop-shadow(0 0 6px {glowColor});"
            />
        </svg>
    </div>

    <div class="score-badge" style="background-color:{activeColor}">
        {clamp(score, 0, 100)}
    </div>
</div>

<!-- <div class="debug-controls">
    <button on:click={() => (score = Math.max(0, score - 10))}>
        -10 (Shake)
    </button>
    <button on:click={() => (score = Math.min(100, score + 10))}>
        +10 (Pulse)
    </button>
</div> -->

<style>
    .debug-controls {
        position: absolute;
        top: 110%;
        display: flex;
        gap: 0.5rem;
        white-space: nowrap;
    }
    .debug-controls button {
        background: #333;
        color: #fff;
        border: 1px solid #555;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 12px;
        border-radius: 4px;
    }
    .debug-controls button:active {
        background: #555;
    }

    .affection-container {
        position: relative;
        width: 64px;
        height: 64px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: rgba(18, 18, 18, 0.62);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow:
            0 10px 22px rgba(0, 0, 0, 0.42),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);

        transform: perspective(700px) rotateX(var(--rx)) rotateY(var(--ry))
            translateZ(0);
        transition: transform 160ms cubic-bezier(0.2, 0.9, 0.2, 1);
        will-change: transform;
        user-select: none;
    }

    .pulse-ring {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        opacity: 0;
        pointer-events: none;
        z-index: 1;
        background: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.24) 0%,
            transparent 68%
        );
    }
    .affection-container.pulse .pulse-ring {
        animation: pulse-ring 560ms ease-out;
    }
    @keyframes pulse-ring {
        0% {
            transform: scale(0.84);
            opacity: 0.85;
        }
        100% {
            transform: scale(1.55);
            opacity: 0;
        }
    }

    .affection-container.shake {
        animation: micro-shake 320ms ease-in-out;
    }
    @keyframes micro-shake {
        0% {
            transform: perspective(700px) rotateX(var(--rx)) rotateY(var(--ry))
                translateZ(0) translateX(0);
        }
        25% {
            transform: perspective(700px) rotateX(var(--rx)) rotateY(var(--ry))
                translateZ(0) translateX(-1.5px);
        }
        50% {
            transform: perspective(700px) rotateX(var(--rx)) rotateY(var(--ry))
                translateZ(0) translateX(1.5px);
        }
        75% {
            transform: perspective(700px) rotateX(var(--rx)) rotateY(var(--ry))
                translateZ(0) translateX(-1px);
        }
        100% {
            transform: perspective(700px) rotateX(var(--rx)) rotateY(var(--ry))
                translateZ(0) translateX(0);
        }
    }

    .glare {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        z-index: 2;
        background: radial-gradient(
            circle at var(--glare-x) var(--glare-y),
            rgba(255, 255, 255, 0.16),
            transparent 52%
        );
        mix-blend-mode: screen;
        opacity: 0.9;
    }

    .heart-wrapper {
        position: relative;
        z-index: 4;
        width: 64px;
        height: 64px;
        display: grid;
        place-items: center;
        filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35));
    }

    .heart-core {
        display: grid;
        place-items: center;
        animation: beat var(--beat-dur) ease-in-out infinite;
        transform-origin: center;
    }
    @keyframes beat {
        0% {
            transform: scale(1);
        }
        18% {
            transform: scale(var(--beat-scale));
        }
        32% {
            transform: scale(1);
        }
        100% {
            transform: scale(1);
        }
    }

    .particle {
        position: absolute;
        z-index: 10;
        pointer-events: none;
        opacity: 0;
        animation: particle-pop 950ms cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
        filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.12));
    }
    @keyframes particle-pop {
        0% {
            opacity: 0;
            transform: translate(-50%, -35%) scale(0.7);
        }
        18% {
            opacity: 0.95;
            transform: translate(-50%, -55%) scale(1.05);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, -95%) scale(0.85);
        }
    }

    .progress-ring {
        position: absolute;
        inset: 0;
        z-index: 3;
        pointer-events: none;
    }
    .track {
        stroke: rgba(255, 255, 255, 0.1);
    }
    .progress {
        stroke-linecap: round;
        transition: stroke-dashoffset 820ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .score-badge {
        position: absolute;
        bottom: -10px;
        z-index: 5;
        font-size: 11px;
        font-weight: 900;
        color: rgba(255, 255, 255, 0.95);
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
        min-width: 22px;
        text-align: center;
    }
</style>

<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Icon from "@iconify/svelte";

    export let score: number = 0;

    const clamp = (v: number, min: number, max: number) =>
        Math.max(min, Math.min(max, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // --- Motion preference ---
    let reduceMotion = false;

    // --- score transitions ---
    let prevScore = score;
    let pulse = false;
    let shake = false;
    let pulseTimer: ReturnType<typeof setTimeout> | null = null;
    let shakeTimer: ReturnType<typeof setTimeout> | null = null;

    // --- colors ---
    let activeColor = "#9ca3af";
    let glowColor = "#cbd5e1";

    // --- particles ---
    type Particle = {
        id: number;
        x: number;
        y: number;
        size: number;
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

    function getColorContinuous(s: number) {
        const t = clamp(s, 0, 100) / 100;
        const c0 = "#9ca3af";
        const c1 = "#f472b6";
        const c2 = "#ef4444";
        if (t <= 0.55) return mixHex(c0, c1, t / 0.55);
        return mixHex(c1, c2, (t - 0.55) / 0.45);
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
        const x = (Math.random() - 0.5) * 24;
        const y = -(Math.random() * 80 + 20); // float upward
        const size = 8 + Math.random() * 12;
        const icon =
            ICONS[Math.floor(Math.random() * ICONS.length)] ?? "ph:heart-fill";
        const ttl = 950;
        particles = [
            ...particles,
            { id, x, y, size, icon, expires: Date.now() + ttl },
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
        const count = clamp(Math.round(amount), 1, 8);
        for (let i = 0; i < count; i++) spawnParticle();
        startCleanupLoop();
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
        activeColor = getColorContinuous(visualScore);
        glowColor = mixHex(activeColor, "#ffffff", 0.45);
    }

    onMount(() => {
        const media =
            window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
        reduceMotion = !!media?.matches;
        const handler = () => {
            reduceMotion = !!media?.matches;
        };
        media?.addEventListener?.("change", handler);
        return () => media?.removeEventListener?.("change", handler);
    });

    onDestroy(() => {
        if (pulseTimer) clearTimeout(pulseTimer);
        if (shakeTimer) clearTimeout(shakeTimer);
        if (rafCleanup) cancelAnimationFrame(rafCleanup);
    });
</script>

<div class="gauge-container" class:pulse class:shake>
    <!-- Heart icon at top -->
    <div class="heart-icon" style="color:{activeColor}">
        <Icon icon="ph:heart-fill" width="16" height="16" />
    </div>

    <!-- Vertical bar track -->
    <div class="bar-track">
        <div
            class="bar-fill"
            style="
                height: {clamp(visualScore, 0, 100)}%;
                background: linear-gradient(to top, {mixHex(
                activeColor,
                '#000000',
                0.15,
            )}, {activeColor}, {mixHex(activeColor, '#ffffff', 0.3)});
                box-shadow: 0 0 8px {glowColor}, 0 0 16px {mixHex(
                activeColor,
                '#000000',
                0.3,
            )};
            "
        ></div>
    </div>

    <!-- Score number at bottom -->
    <div class="score-label" style="color:{activeColor}">
        {clamp(score, 0, 100)}
    </div>

    <!-- Particles -->
    {#each particles as p (p.id)}
        <div
            class="particle"
            style="
                left: calc(50% + {p.x}px);
                bottom: calc({clamp(visualScore, 0, 100)}% + 20px);
                font-size: {p.size}px;
                color: {activeColor};
                --py: {p.y}px;
            "
        >
            <Icon icon={p.icon} />
        </div>
    {/each}
</div>

<style>
    .gauge-container {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        width: 28px;
        height: 140px;
        user-select: none;
    }

    .gauge-container.pulse .bar-fill {
        animation: bar-pulse 560ms ease-out;
    }
    @keyframes bar-pulse {
        0% {
            filter: brightness(1);
        }
        40% {
            filter: brightness(1.5);
        }
        100% {
            filter: brightness(1);
        }
    }

    .gauge-container.shake {
        animation: micro-shake 320ms ease-in-out;
    }
    @keyframes micro-shake {
        0% {
            transform: translateX(0);
        }
        25% {
            transform: translateX(-2px);
        }
        50% {
            transform: translateX(2px);
        }
        75% {
            transform: translateX(-1px);
        }
        100% {
            transform: translateX(0);
        }
    }

    .heart-icon {
        display: grid;
        place-items: center;
        filter: drop-shadow(0 0 4px currentColor);
        flex-shrink: 0;
    }

    .bar-track {
        position: relative;
        width: 6px;
        flex: 1;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.06);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
    }

    .bar-fill {
        width: 100%;
        border-radius: 999px;
        transition:
            height 820ms cubic-bezier(0.22, 1, 0.36, 1),
            background 400ms ease,
            box-shadow 400ms ease;
        min-height: 2px;
    }

    .score-label {
        font-size: 10px;
        font-weight: 800;
        text-align: center;
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
    }

    .particle {
        position: absolute;
        z-index: 10;
        pointer-events: none;
        opacity: 0;
        animation: particle-float 950ms cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
        filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.15));
    }
    @keyframes particle-float {
        0% {
            opacity: 0;
            transform: translate(-50%, 0) scale(0.5);
        }
        20% {
            opacity: 0.9;
            transform: translate(-50%, -10px) scale(1.05);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, var(--py)) scale(0.7);
        }
    }
</style>

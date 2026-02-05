<script lang="ts">
    import { onMount } from "svelte";

    let debugInfo = "";
    let strategy:
        | "default"
        | "fixed-body"
        | "visual-viewport"
        | "force-scroll"
        | "counter-transform" = "default";

    let initialWindowHeight = 0; // Fixed Base Height
    let windowHeight = 0;
    let viewportHeight = 0;
    let scrollY = 0;

    let vvHeight = 0;
    let vvOffsetTop = 0;
    let vvPageTop = 0;

    function updateDebug() {
        if (typeof window !== "undefined") {
            windowHeight = window.innerHeight;
            scrollY = window.scrollY;
            if (window.visualViewport) {
                vvHeight = window.visualViewport.height;
                vvOffsetTop = window.visualViewport.offsetTop;
                vvPageTop = window.visualViewport.pageTop;
            }
            viewportHeight = window.visualViewport
                ? window.visualViewport.height
                : window.innerHeight;

            debugInfo = JSON.stringify(
                {
                    initH: initialWindowHeight,
                    winH: windowHeight,
                    vvH: vvHeight,
                    vvTop: vvOffsetTop,
                    vvPageTop: vvPageTop,
                    scrollY: scrollY.toFixed(0),
                    strategy,
                },
                null,
                2,
            );

            if (strategy === "force-scroll") {
                if (window.scrollY !== 0) {
                    window.scrollTo(0, 0);
                }
            }
        }
    }

    onMount(() => {
        initialWindowHeight = window.innerHeight; // Capture on load
        updateDebug();

        window.addEventListener("resize", updateDebug);
        window.addEventListener("scroll", updateDebug);
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", updateDebug);
            window.visualViewport.addEventListener("scroll", updateDebug);
        }

        // Try VirtualKeyboard API (Android)
        if ("virtualKeyboard" in navigator) {
            (navigator as any).virtualKeyboard.overlaysContent = true;
        }

        return () => {
            window.removeEventListener("resize", updateDebug);
            window.removeEventListener("scroll", updateDebug);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener(
                    "resize",
                    updateDebug,
                );
                window.visualViewport.removeEventListener(
                    "scroll",
                    updateDebug,
                );
            }
            unlockBody();
        };
    });

    function lockBody() {
        document.body.style.position = "fixed";
        document.body.style.width = "100%";
        document.body.style.height = "100%";
        document.body.style.overflow = "hidden";
    }

    function unlockBody() {
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.height = "";
        document.body.style.overflow = "";
    }

    function setStrategy(s: any) {
        strategy = s;
        if (s === "fixed-body") {
            lockBody();
        } else {
            unlockBody();
        }
        updateDebug();
        if (s === "force-scroll") {
            window.scrollTo(0, 0);
        }
    }
</script>

<!-- Background Layer -->
<!-- V4: Apply Transform for Counter-Transform strategy -->
<div
    class="bg"
    style:height={initialWindowHeight ? `${initialWindowHeight}px` : "100dvh"}
    style:transform={strategy === "counter-transform"
        ? `translateY(${vvOffsetTop}px)`
        : "none"}
>
    <!-- Background is chat_bg.png via CSS -->
</div>

<!-- UI Layer -->
<div
    class="ui-layer"
    style:height={strategy === "visual-viewport" ||
    strategy === "force-scroll" ||
    strategy === "counter-transform"
        ? `${vvHeight}px`
        : "100dvh"}
    style:top={strategy === "visual-viewport" ||
    strategy === "force-scroll" ||
    strategy === "counter-transform"
        ? `${vvOffsetTop}px`
        : "0"}
>
    <div class="header">
        <h1>Keyboard Test V4</h1>
        <pre class="debug">{debugInfo}</pre>
        <div class="controls-row">
            <button
                class:active={strategy === "default"}
                on:click={() => setStrategy("default")}>Default</button
            >
            <button
                class:active={strategy === "fixed-body"}
                on:click={() => setStrategy("fixed-body")}>BodyLock</button
            >
            <button
                class:active={strategy === "visual-viewport"}
                on:click={() => setStrategy("visual-viewport")}>VV Only</button
            >
        </div>
        <div class="controls-row">
            <button
                class:active={strategy === "force-scroll"}
                on:click={() => setStrategy("force-scroll")}>ForceScroll</button
            >
            <button
                class:active={strategy === "counter-transform"}
                on:click={() => setStrategy("counter-transform")}
                >CounterTF</button
            >
        </div>
    </div>

    <div class="spacer"></div>

    <div class="footer">
        <input
            type="text"
            placeholder="Click to test keyboard..."
            on:focus={() => setTimeout(() => updateDebug(), 100)}
        />
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        /* overscroll-behavior: none; */
    }
    .bg {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100dvh;
        z-index: 0;
        background-image: url("/chat_bg.png");
        background-size: cover;
        background-position: center bottom;
        background-repeat: no-repeat;
        overflow: hidden;
        will-change: transform; /* V4 optimization */
    }

    .ui-layer {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100dvh;
        z-index: 10;
        display: flex;
        flex-direction: column;
        pointer-events: none;
        border: 2px solid rgba(0, 0, 255, 0.3);
        box-sizing: border-box;
    }

    .ui-layer > * {
        pointer-events: auto;
    }

    .header {
        background: rgba(255, 255, 255, 0.9);
        padding: 5px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    .debug {
        font-size: 9px;
        font-family: monospace;
        background: #eee;
        padding: 3px;
        margin: 3px 0;
        border-radius: 4px;
        white-space: pre-wrap;
    }
    .controls-row {
        display: flex;
        gap: 3px;
        margin-bottom: 3px;
    }
    button {
        flex: 1;
        padding: 6px;
        border: 1px solid #ccc;
        background: white;
        border-radius: 4px;
        font-size: 11px;
    }
    button.active {
        background: #007bff;
        color: white;
        border-color: #0056b3;
    }

    .spacer {
        flex: 1;
    }

    .footer {
        padding: 10px;
        background: white;
        border-top: 1px solid #ccc;
        background: rgba(255, 255, 255, 0.9);
    }
    input {
        width: 100%;
        padding: 15px;
        font-size: 16px;
        border: 2px solid #ddd;
        border-radius: 8px;
        box-sizing: border-box;
    }
    input:focus {
        border-color: #007bff;
        outline: none;
    }
</style>

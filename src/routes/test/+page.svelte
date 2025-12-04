<script lang="ts">
    import Live2DViewer from "$lib/components/live2d/Live2DViewer.svelte";

    // Public Live2D Model for testing (Hiyori)
    const TEST_MODEL_URL =
        "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json";
</script>

<main
    style="width: 100vw; height: 100vh; background: #333; display: flex; flex-direction: column; align-items: center; justify-content: center;"
>
    <h1 style="color: white; position: absolute; top: 20px; z-index: 10;">
        📱 Mobile Live2D Test
    </h1>

    <div style="width: 100%; height: 80%; position: relative;">
        <Live2DViewer modelUrl={TEST_MODEL_URL} scale={0.3} />
    </div>

    <div
        style="position: absolute; bottom: 20px; color: #aaa; text-align: center;"
    >
        <p>If you see the character above, Live2D is working.</p>
        <p>Check the debug panel for errors.</p>
    </div>
</main>

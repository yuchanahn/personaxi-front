export const LIVE2D_SCRIPTS = [
    "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
    "https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js",
    "https://cdn.jsdelivr.net/npm/pixi.js@7/dist/pixi.min.js",
    // "https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js", // Duplicate removed
    "https://cdn.jsdelivr.net/gh/RaSan147/pixi-live2d-display@v0.5.0-ls-8/dist/index.min.js"
];

let scriptsLoaded = false;

export function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

export async function loadLive2DScripts(): Promise<void> {
    if (scriptsLoaded) return;

    for (const src of LIVE2D_SCRIPTS) {
        await loadScript(src);
    }

    // Wait for global variables to be available
    await waitForGlobals();
    scriptsLoaded = true;
}

function waitForGlobals(): Promise<void> {
    return new Promise((resolve) => {
        const check = () => {
            if (
                typeof (window as any).PIXI !== "undefined" &&
                typeof (window as any).PIXI.live2d !== "undefined" &&
                typeof (window as any).Live2D !== "undefined" &&
                typeof (window as any).Live2D.init === "function" &&
                typeof (window as any).Live2DCubismCore !== "undefined"
            ) {
                resolve();
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    });
}

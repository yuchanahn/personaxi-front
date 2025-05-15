import { Viewer } from './core/viewer'

export function test(canvas: HTMLCanvasElement) {
    const viewer = new Viewer(canvas);

    viewer.loadModel('./AvatarSample_B.vrm');
    viewer.start();

    // drag & drop
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        viewer.loadModel(url);
    });

}
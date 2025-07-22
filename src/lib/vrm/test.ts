import { VRM_URL } from '$lib/constants';
import type { Persona } from '$lib/types';
import { Model } from './core/model';
import { Viewer } from './core/viewer'

let current_model: Model | null = null
let viewer: Viewer | null = null


export function getViewer(): Viewer | null {
    return viewer;
}

export function test(canvas: HTMLCanvasElement, persona: Persona) {

    if (current_model) {
        //current_model.unloadVrm();
    }
    if (viewer) {
        viewer.stop();
    }

    viewer = new Viewer(canvas);

    let m = viewer.loadModel(`${VRM_URL}${persona.owner_id[0]}/${persona.id}.vrm`);
    m.then(m => {
        current_model = m;
        if (viewer) viewer.start();
    })
    return m;
}

export function get_model_head_position(): { x: number, y: number } | null {
    if (!current_model) {
        console.warn("No model loaded");
        return null;
    }

    return viewer?.getHeadPointInUI() || null;
}

export function unload() {
    if (current_model) {
        viewer?.stop();
        //current_model.unloadVrm();
    }
}
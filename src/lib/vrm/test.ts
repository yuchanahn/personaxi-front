import type { Persona } from '$lib/types';
import { Model } from './core/model';
import { Viewer } from './core/viewer'

let current_model: Model | null = null
let viewer: Viewer | null = null

export function test(canvas: HTMLCanvasElement, persona: Persona) {

    if (current_model) {
        current_model.unloadVrm();
    }
    if (viewer) {
        viewer.stop();
    }

    viewer = new Viewer(canvas);
    let m = viewer.loadModel(`https://uohepkqmwbstbmnkoqju.supabase.co/storage/v1/object/public/vrm-models/${persona.owner_id}/${persona.id}.vrm`);
    m.then(m => {
        current_model = m;
        if (viewer) viewer.start();
    })
    return m;
}

export function unload() {
    if (current_model) {
        current_model.unloadVrm();
    }
}
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createVRMLoader } from '../loaders/vrmLoader';
import { loadMixamoAnimation } from '../animation/mixamo_animation';
import { VRM } from '@pixiv/three-vrm';
import * as THREE from 'three/webgpu';
import { base } from '$app/paths';

export class Model {
    public gltf: GLTF | null = null;
    public vrm: VRM | null = null;

    private mixer?: THREE.AnimationMixer;

    async load(url: string): Promise<VRM | null> {
        const loader = createVRMLoader();
        const gltf = await loader.loadAsync(url);
        this.gltf = gltf;
        this.vrm = gltf.userData.vrm;
        if (!this.vrm) {
            console.error('VRM load failed!');
            return null;
        }
        
        return this.vrm;
    }

    public async initAnimations(vrm: VRM) {
        this.mixer = new THREE.AnimationMixer(vrm.scene);

        const idleAnim = await loadMixamoAnimation(base + '/animations/Idle_nomal.fbx', vrm);
        const action = this.mixer?.clipAction(idleAnim);
        if (!action) {
            console.error('Failed to load animation');
            return;
        }

        action.enabled = true
        action.setEffectiveTimeScale(1)
        action.setEffectiveWeight(1)
        action.time = 0

        action.reset().play();

        this.mixer?.update(0);
    }

    update(delta: number) {
        if (!this.gltf) return;

        const mtoon = (this.gltf.userData as any).vrmMToonMaterials;
        if (Array.isArray(mtoon)) {
            for (const mat of mtoon) mat.update(delta);
        }

        this.mixer?.update(delta);
        this.vrm?.update(delta)
    }

    dispose(scene: THREE.Scene) {
        if (!this.gltf) return;
        scene.remove(this.gltf.scene);
    }
}

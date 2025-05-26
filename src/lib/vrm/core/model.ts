import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createVRMLoader } from '../loaders/vrmLoader';
import { loadMixamoAnimation } from '../animation/mixamo_animation';
import { MToonMaterial, VRM, VRMUtils } from '@pixiv/three-vrm';
import * as THREE from 'three/webgpu';
import { base } from '$app/paths';
import { LipSync } from '../lip_sync/lip_sync';
import { ExpressionController } from '../emote_controller/expression_controller';
import type { MToonNodeMaterial } from '@pixiv/three-vrm-materials-mtoon/nodes';
import { uniform, add, mul, positionLocal, normalLocal } from 'three/webgpu';


// 윤곽선용 NodeMaterial 생성
function createOutlineMaterial(_outlineWidth: number, _outlineColor: THREE.Color) {
    const outlineWidth = uniform(_outlineWidth);
    const outlineColor = uniform(_outlineColor);

    const material = new THREE.NodeMaterial();
    material.side = THREE.BackSide;

    // 버텍스: 노멀 방향으로 확장
    const expandedPosition = add(positionLocal, mul(normalLocal, outlineWidth));
    material.positionNode = expandedPosition;

    // 프래그먼트: 윤곽선 색상
    material.colorNode = outlineColor;

    return material;
}

// VRM에 윤곽선 적용 (메시별 설정)
export function addOutlineToVRM(vrm: VRM) {
    const meshes: THREE.SkinnedMesh[] = [];

    // SkinnedMesh 수집
    vrm.scene.traverse((object) => {
        if (object.type === 'SkinnedMesh') {
            meshes.push(object as THREE.SkinnedMesh);
        }
    });

    meshes.forEach((object) => {
        // 메시 이름으로 구분
        let outlineWidth = 0.0015;
        let outlineColor = new THREE.Color(0, 0, 0);

        if (
            object.name === "Face_(merged)(Clone)" ||
            object.name === "Face_(merged)(Clone)_1" ||
            object.name === "Face_(merged)(Clone)_2" ||
            object.name === "Face_(merged)(Clone)_3" ||
            object.name === "Face_(merged)(Clone)_4" ||
            object.name === "Face_(merged)(Clone)_5" ||
            object.name === "Face_(merged)(Clone)_6" ||

            //object.name.includes("Body_(merged)") ||
            //object.name.includes("Body_(merged)_1") ||
            //object.name.includes("Body_(merged)_2") ||
            //object.name.includes("Body_(merged)_3") ||
            //
            //object.name.includes("Hair001_(merged)") ||
            //object.name.includes("Hair001_(merged)_1") ||
            //object.name.includes("Hair001_(merged)_2") ||
            //object.name.includes("Hair001_(merged)_3") ||
            //object.name.includes("Hair001_(merged)_4") ||
            //object.name.includes("Hair001_(merged)_5") ||

            object.name.includes("END")

        ) {
            return;
        }

        // 윤곽선용 SkinnedMesh 생성
        const outlineMaterial = createOutlineMaterial(outlineWidth, outlineColor);
        const outlineMesh = new THREE.SkinnedMesh(object.geometry, outlineMaterial);
        outlineMesh.scale.multiplyScalar(1.01);

        // 스키닝 데이터 복사
        outlineMesh.skeleton = object.skeleton;
        outlineMesh.bindMatrix.copy(object.bindMatrix);
        outlineMesh.bind(object.skeleton, outlineMesh.bindMatrix);

        object.add(outlineMesh);
    });
}


export class Model {
    public gltf: GLTF | null = null;
    public vrm: VRM | null = null;
    private expressionController?: ExpressionController
    private lipSync: LipSync

    private mixer?: THREE.AnimationMixer;
    private actions: { [key: string]: THREE.AnimationAction } | null = null;


    constructor() {
        this.lipSync = new LipSync(new AudioContext())
    }

    async load(url: string, camera: THREE.Object3D): Promise<VRM | null> {
        const loader = createVRMLoader();
        let gltf: GLTF;

        try {
            gltf = await loader.loadAsync(url);
        } catch (err) {
            gltf = await loader.loadAsync("./AvatarSample_B.vrm");
            console.log("load defualt vrm model...")
        }

        this.gltf = gltf;
        this.vrm = gltf.userData.vrm;
        if (!this.vrm) {
            console.error('VRM load failed!');
            return null;
        }
        this.expressionController = new ExpressionController(this.vrm, camera);
        //this.expressionController.playEmotion([{ key: "surprise", value: 1 }]);
        addOutlineToVRM(this.vrm)
        return this.vrm;
    }

    public Emotion(key: string) {
        this.expressionController?.playEmotion([{ key: key, value: 1 }])
    }

    /*
    $files = Get-ChildItem -Path "C:\\YuChan\\PersonaXi\\personaxi-front\\static\\animations" | Select-Object -ExpandProperty Name
    $files | ConvertTo-Json
    */

    public async loadAnimations(vrm: VRM) {
        const res = await fetch('/personaxi-front/anims.json')
        const data = await res.json()

        for (const name of data) {
            loadMixamoAnimation(base + `/animations/${name}`, vrm).then((anim) => {
                if (this.actions == null) {
                    this.actions = {}
                }
                if (this.actions && this.mixer) {
                    this.actions = {
                        ...this.actions,
                        [name]: this.mixer.clipAction(anim),
                    }
                    console.log('load animation :', name)
                }
            })
        }

    }


    public async initAnimations(vrm: VRM) {
        this.mixer = new THREE.AnimationMixer(vrm.scene);
        this.loadAnimations(vrm)
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

    public async speak(buffer: ArrayBuffer) {
        await new Promise((resolve) => {
            this.lipSync.playFromArrayBuffer(buffer, () => {
                resolve(true)
            })
        })
    }

    public unloadVrm() {
        if (this.vrm) {
            VRMUtils.deepDispose(this.vrm.scene)
            this.vrm = null
        }
    }

    update(delta: number) {
        if (!this.gltf) return;

        const { volume } = this.lipSync.update()
        this.expressionController?.lipSync('aa', volume)
        this.expressionController?.update(delta)

        const mtoon = (this.gltf.userData as any).vrmMToonMaterials;

        if (Array.isArray(mtoon)) {
            for (const mat of mtoon as MToonNodeMaterial[]) {
                mat.update(delta);
            }
        }

        this.mixer?.update(delta);
        this.vrm?.update(delta)
    }

    dispose(scene: THREE.Scene) {
        if (!this.gltf) return;
        scene.remove(this.gltf.scene);
    }
}

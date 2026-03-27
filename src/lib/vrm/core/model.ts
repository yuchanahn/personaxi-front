// Model.ts – three.js VRM controller (2.1 SpringBone + 2.2 스프링 보간 적용)
// Author: (graphics programmer style)
// -----------------------------------------------------------------------------

import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createVRMLoader } from '../loaders/vrmLoader';
import { loadMixamoAnimation } from '../animation/mixamo_animation';
import { VRM, VRMUtils } from '@pixiv/three-vrm';
import * as THREE from 'three/webgpu';
import { base } from '$app/paths';
import { LipSync } from '../lip_sync/lip_sync';
import { ExpressionController } from '../emote_controller/expression_controller';
import { CharacterStateManager } from '../fsm/StateManager';
import { stripRootMotion } from '../utils/AnimationHelpers';
import { HitReactionController } from './HitReactionController';
import { addSpark } from "$lib/vrm/stores";
import {
    VRM_INITIAL_PRELOAD_ANIMATION_NAMES,
    normalizeAnimationName,
    resolveAnimationAssetPath,
} from '../animation/vrmAnimationCatalog';


//------------------------------------------------------------------
// 물리 보조 함수 – 선형 스프링-댐퍼 적분 (Semi-implicit Euler)
//------------------------------------------------------------------
function integrateSpring(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    target: THREE.Vector3,
    stiffness: number,
    damping: number,
    dt: number,
) {
    // F = -k(x - x0) - c v
    const accel = new THREE.Vector3()
        .subVectors(target, pos)
        .multiplyScalar(stiffness)
        .addScaledVector(vel, -damping);

    vel.addScaledVector(accel, dt);
    pos.addScaledVector(vel, dt);
}


// ---------------------------------------------

export interface HitConfig {
    rotImpulseHead: number;   // rad/s
    halfRotHead: number;   // sec
    rotImpulseBody: number;
    halfRotBody: number;
    rotImpulseLimb: number;
    halfRotLimb: number;
}


//------------------------------------------------------------------
// 메인 클래스
//------------------------------------------------------------------
export class Model {
    private readonly lookAtEnabled = false;

    public cfg: HitConfig = {           // 🔹 기본값
        rotImpulseHead: 15,
        halfRotHead: 0.25,
        rotImpulseBody: 12,
        halfRotBody: 0.25,
        rotImpulseLimb: 10,
        halfRotLimb: 0.30,
    };

    public gltf: GLTF | null = null;
    public vrm: VRM | null = null;

    private expressionController?: ExpressionController;
    private lipSync: LipSync;

    private springManager?: any;
    public stateManager?: CharacterStateManager;

    // LookAt 스프링 변수
    private lookPos = new THREE.Vector3();
    private lookVel = new THREE.Vector3();
    private lookTarget = new THREE.Object3D();
    private gazeGoal = new THREE.Object3D();

    private lookStiffness = 120; // k
    private lookDamping = 25;    // c

    // Hit reaction
    private camera!: THREE.PerspectiveCamera;
    private hitReactionController?: HitReactionController;

    // 기타
    public mixer?: THREE.AnimationMixer;
    public actions: Record<string, THREE.AnimationAction> = {};
    private animationLoadPromises = new Map<string, Promise<THREE.AnimationAction | null>>();
    private failedAnimations = new Set<string>();


    private lookAtTarget = new THREE.Object3D();
    private lookAtGoal = new THREE.Object3D();

    private eyeGazeTimer = 0;     // 경과 시간
    private nextGazeChangeTime = 0;     // 다음 시선 변경 시점
    private gazeMoveSpeed = 1.0;   // 시선 이동 속도
    private isFollowingMouse = false; // 마우스 추적 모드 여부

    constructor() {
        this.lipSync = new LipSync(new AudioContext());
    }

    private canvas: HTMLCanvasElement | null = null;
    private static vrmBinaryCache = new Map<string, ArrayBuffer>();

    public setCanvas(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }


    //----------------------------------------------------------------
    // 로드
    //----------------------------------------------------------------
    async load(
        url: string,
        camera: THREE.PerspectiveCamera,
        onProgress?: (phase: 'network' | 'decrypt' | 'parse', progress: number) => void,
    ): Promise<VRM | null> {
        this.camera = camera;
        const loader = createVRMLoader();

        try {
            let vrmBuffer: ArrayBuffer | null = null;

            const cached = Model.vrmBinaryCache.get(url);
            if (cached) {
                onProgress?.('network', 1);
                vrmBuffer = cached.slice(0);
            } else {
                onProgress?.('network', 0);
                const res = await fetch(url);
                if (!res.ok) throw new Error("Failed to fetch VRM file");

                const totalLength = Number(res.headers.get("content-length") || "0");
                if (!res.body || totalLength <= 0) {
                    vrmBuffer = await res.arrayBuffer();
                    onProgress?.('network', 1);
                } else {
                    const reader = res.body.getReader();
                    const chunks: Uint8Array[] = [];
                    let received = 0;

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        if (value) {
                            chunks.push(value);
                            received += value.length;
                            onProgress?.('network', Math.min(1, received / totalLength));
                        }
                    }

                    const merged = new Uint8Array(received);
                    let offset = 0;
                    for (const chunk of chunks) {
                        merged.set(chunk, offset);
                        offset += chunk.length;
                    }
                    vrmBuffer = merged.buffer;
                }

                if (!vrmBuffer) throw new Error("Failed to read VRM buffer");

                const header = String.fromCharCode(...new Uint8Array(vrmBuffer.slice(0, 4)));
                if (header !== "glTF") {
                    onProgress?.('decrypt', 0.2);
                    const cryptoModule = await import("$lib/utils/crypto");
                    const decrypted = await cryptoModule.xorEncryptDecrypt(vrmBuffer);
                    onProgress?.('decrypt', 1);
                    vrmBuffer = decrypted;
                } else {
                    onProgress?.('decrypt', 1);
                }

                Model.vrmBinaryCache.set(url, vrmBuffer.slice(0));
            }

            onProgress?.('parse', 0.1);
            this.gltf = await loader.parseAsync(vrmBuffer, '');
            onProgress?.('parse', 1);
        } catch (e) {
            console.warn('VRM load failed (or was decrypted incorrectly). Fallback to sample model.', e);
            this.gltf = await loader.loadAsync('./AvatarSample_B.vrm');
            onProgress?.('parse', 1);
        }

        this.vrm = this.gltf.userData.vrm;
        if (!this.vrm) return null;

        // SpringBone 2.1 ------------------------------------------------
        this.springManager = this.vrm.springBoneManager;
        this.springManager?.reset();

        // LookAt 세팅 ----------------------------------------------------
        if (this.lookAtEnabled) {
            this.vrm.scene.add(this.lookTarget);
            this.vrm.scene.add(this.gazeGoal);
            this.vrm.lookAt!.target = this.lookTarget;
            this.vrm.lookAt!.autoUpdate = true;
        } else {
            this.vrm.lookAt!.autoUpdate = false;
        }

        this.stateManager = new CharacterStateManager(this, this.vrm);

        this.expressionController = new ExpressionController(this.vrm, camera);
        this.setupLookAt()
        this.hitReactionController = new HitReactionController({
            vrm: this.vrm,
            camera,
            getCanvas: () => this.canvas,
            getConfig: () => this.cfg,
            startMouseFollowing: () => this.startMouseFollowing(),
            stopMouseFollowing: () => this.stopMouseFollowing(true),
            spawnSpark: addSpark,
        });


        return this.vrm;
    }

    //----------------------------------------------------------------
    // 애니메이션 로딩
    //----------------------------------------------------------------
    async initAnimations() {
        if (!this.vrm) return;
        this.mixer = new THREE.AnimationMixer(this.vrm.scene);

        this.actions = {};
        this.animationLoadPromises.clear();
        this.failedAnimations.clear();

        await Promise.all(VRM_INITIAL_PRELOAD_ANIMATION_NAMES.map((name) => this.ensureAnimationLoaded(name)));
        this.stateManager?.setState(this.stateManager.getCurrentState(), true);


        //const idle = await loadMixamoAnimation(base + '/animations/Breathing Idle.fbx', this.vrm);
        //const idle1 = await loadMixamoAnimation(base + '/animations/Breathing Idle1.fbx', this.vrm);
        //const idle2 = await loadMixamoAnimation(base + '/animations/Breathing Idle2.fbx', this.vrm);
        //
        //
        //
        //const act = this.mixer.clipAction(idle);
        //const act1 = this.mixer.clipAction(idle1);
        //const act2 = this.mixer.clipAction(idle2);
        //
        //this.actions = { ...this.actions, ["Breathing Idle.fbx"]: act };
        //this.actions = { ...this.actions, ["Breathing Idle1.fbx"]: act1 };
        //this.actions = { ...this.actions, ["Breathing Idle2.fbx"]: act2 };

        //act.play();
    }


    /*
        $files = Get-ChildItem -Path "C:\\YuChan\\PersonaXi\\personaxi-front\\static\\animations" | Select-Object -ExpandProperty Name
        $files | ConvertTo-Json
    */
    public async loadAnimations(vrm: VRM) {
        const res = await fetch('/anims.json');
        const data = await res.json();

        for (const name of data) {
            loadMixamoAnimation(base + `/animations/${name}`, vrm).then((anim) => {
                if (this.actions == null) this.actions = {};
                if (this.actions && this.mixer) {
                    this.actions = { ...this.actions, [name]: this.mixer.clipAction(anim) };
                    console.log('load animation :', name);
                }
            });
        }
    }



    public Emotion(key: string, value: number = 1) {
        this.expressionController?.playEmotion([{ key: key, value: value }])
    }


    private setupLookAt() {
        if (!this.lookAtEnabled || !this.vrm?.lookAt) return;
        if (this.vrm.lookAt) {
            this.vrm.scene.add(this.lookAtTarget);
            this.vrm.scene.add(this.lookAtGoal);
            const head = this.vrm.humanoid.getRawBoneNode("head");
            const originalApply = this.vrm.lookAt.applier.applyYawPitch;

            this.vrm.lookAt.applier.applyYawPitch = function (yaw, pitch) {
                originalApply.call(this, yaw, pitch);
                if (!head) return;

                const yawThreshold = 5.0;
                const pitchThreshold = 7.0;
                const headFollowFactor = 1.6;
                const smoothFactor = 0.2;

                let headYaw = 0;
                if (Math.abs(yaw) > yawThreshold) {
                    headYaw = (yaw - Math.sign(yaw) * yawThreshold) * headFollowFactor;
                }
                let headPitch = 0;
                if (Math.abs(pitch) > pitchThreshold) {
                    headPitch = (pitch - Math.sign(pitch) * pitchThreshold) * headFollowFactor;
                }

                const headTargetRotation = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(
                        headPitch * THREE.MathUtils.DEG2RAD,
                        headYaw * THREE.MathUtils.DEG2RAD,
                        0,
                        'YXZ'
                    )
                );
                const finalTargetQuaternion = head.quaternion.clone().multiply(headTargetRotation);
                head.quaternion.slerp(finalTargetQuaternion, smoothFactor);
            };

            this.lookAtTarget.position.set(0, 0, 0);
            this.vrm.lookAt.target = this.lookAtTarget;
            this.vrm.lookAt.autoUpdate = true;
        }

        // 첫 번째 시선 목표 생성
        this.changeGaze();
    }

    // ③ 시선 이동·마우스 추적 관련 퍼블릭 메서드
    public changeGaze(range: { x: number; y: number; z: number } = { x: 1.5, y: 0.8, z: 1.0 }) {
        if (!this.lookAtEnabled) return;
        this.nextGazeChangeTime = 2.0 + Math.random() * 5.0; // 2~7초 사이
        this.eyeGazeTimer = 0;
        this.gazeMoveSpeed = 10 + Math.random() * 5;    // 10~15
        this.lookAtGoal.position.set(
            (Math.random() - 0.5) * range.x,
            (Math.random() - 0.5) * range.y + 1.0,
            Math.random() * range.z + 0.5
        );
    }

    public startMouseFollowing() {
        if (!this.lookAtEnabled) return;
        this.isFollowingMouse = true;
        this.gazeMoveSpeed = 20.0; // 더 빠르게
    }

    public stopMouseFollowing(returnToCenter: boolean = false) {
        if (!this.lookAtEnabled) return;
        this.isFollowingMouse = false;
        if (returnToCenter) {
            this.eyeGazeTimer = 0;
            this.nextGazeChangeTime = 2.0 + Math.random() * 5.0;
            this.gazeMoveSpeed = 12.0;
            this.lookAtGoal.position.set(0, 1.0, 1.0);
        }
    }

    public updateMouseGaze(mouseX: number, mouseY: number) {
        if (!this.lookAtEnabled) return;
        if (!this.isFollowingMouse) return;
        this.lookAtGoal.position.set(mouseX * 2.0, -mouseY * 1.0 + 1.0, 1.0);
    }

    mouseFollowTimer: any | null = null;

    //----------------------------------------------------------------
    // 마우스 타격 (충돌 위치에 따라 회전 방향 결정)
    //----------------------------------------------------------------
    hitByMouse(nx: number, ny: number, strength = 1) {
        this.hitReactionController?.handlePointerHit(nx, ny, strength);
    }


    public async speak(buffer: ArrayBuffer) {
        await new Promise((resolve) => {
            this.lipSync.playFromArrayBuffer(buffer, () => resolve(true));
        });
    }

    resetHitSprings() {
        this.hitReactionController?.reset();
    }


    applyHitSprings(dt: number) {
        this.hitReactionController?.afterBaseUpdate(dt);
    }

    fps = 0
    DEBUG_MODE = false

    //----------------------------------------------------------------
    public doGesture(gestureName: string) {
        this.stateManager?.triggerGesture(gestureName);
    }

    public async ensureAnimationLoaded(name: string): Promise<THREE.AnimationAction | null> {
        if (!this.vrm || !this.mixer) return null;

        const normalizedName = normalizeAnimationName(name);
        if (this.actions[normalizedName]) {
            return this.actions[normalizedName];
        }

        if (this.failedAnimations.has(normalizedName)) {
            return null;
        }

        const pendingLoad = this.animationLoadPromises.get(normalizedName);
        if (pendingLoad) {
            return pendingLoad;
        }

        const assetPath = resolveAnimationAssetPath(name);
        const loadPromise = loadMixamoAnimation(assetPath, this.vrm)
            .then((clip) => {
                stripRootMotion(clip);
                const action = this.mixer!.clipAction(clip);
                this.actions[normalizedName] = action;
                return action;
            })
            .catch((error) => {
                this.failedAnimations.add(normalizedName);
                console.warn(`[VRM] Failed to load animation: ${assetPath}`, error);
                return null;
            })
            .finally(() => {
                this.animationLoadPromises.delete(normalizedName);
            });

        this.animationLoadPromises.set(normalizedName, loadPromise);
        return loadPromise;
    }

    // 매 프레임 업데이트
    //----------------------------------------------------------------
    update(dt: number) {
        if (!this.vrm) return;
        this.hitReactionController?.beforeBaseUpdate();

        // 2.2 LookAt 스프링 보간 --------------------------------------
        if (this.lookAtEnabled) {
            integrateSpring(
                this.lookPos,
                this.lookVel,
                this.gazeGoal.position,
                this.lookStiffness,
                this.lookDamping,
                dt,
            );
            this.lookTarget.position.copy(this.lookPos);

            // 눈 트래킹 ---------------------------------------------------
            this.eyeGazeTimer += dt;
            if (!this.isFollowingMouse && this.eyeGazeTimer > this.nextGazeChangeTime) {
                this.changeGaze()
            }
            const dist = this.lookAtTarget.position.distanceTo(this.lookAtGoal.position);
            if (dist > 0.01) {
                this.lookAtTarget.position.lerp(this.lookAtGoal.position, dt * this.gazeMoveSpeed);
            }
        }
        // -----------------------------------------------------------------------------


        // 기타 ---------------------------------------------------------
        const vol = this.lipSync.update().volume;
        this.expressionController?.lipSync('aa', vol);
        this.expressionController?.update(dt);


        this.mixer?.update(dt);
        this.vrm.update(dt);
        this.stateManager?.update(dt);
        this.applyHitSprings(dt);

        this.fps += dt

        if (this.DEBUG_MODE && this.fps > 1) {
            this.fps = 0
            console.log("DEBUG INFO: ", this.stateManager?.getDebugInfo())
        }
    }

    //----------------------------------------------------------------
    // 해제
    //----------------------------------------------------------------
    dispose() {
        if (this.mouseFollowTimer) {
            clearTimeout(this.mouseFollowTimer);
            this.mouseFollowTimer = null;
        }
        this.hitReactionController?.dispose();
        this.hitReactionController = undefined;
        this.stateManager?.stop(0.2);
        this.mixer?.stopAllAction();
        if (this.vrm?.scene) this.mixer?.uncacheRoot(this.vrm.scene);
        this.mixer = undefined;
        this.actions = {};

        if (!this.vrm) return;

        try {
            VRMUtils.deepDispose(this.vrm.scene);
        } catch (e) {
            console.error(e);
        }

        this.vrm = null;
    }

}

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
import { isSettledPos, isSettledRot, springPos, springQuat } from '../utils/springParams';
import { addSpark } from "$lib/vrm/stores";
import { CharacterStateManager } from '../fsm/StateManager';
import { stripRootMotion } from '../utils/AnimationHelpers';


//------------------------------------------------------------------
// 타입 보조                                                         
//------------------------------------------------------------------
type HitBoneState = {
    bone: THREE.Bone;
    originalPos: THREE.Vector3;
    originalQuat: THREE.Quaternion;
    velPos: THREE.Vector3;
    velRot: THREE.Vector3;
    halfPos: number;  // ← halflife(seconds)
    halfRot: number;
};


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
    private hitStates: HitBoneState[] = [];
    private camera!: THREE.PerspectiveCamera;
    private raycaster = new THREE.Raycaster();
    private hittableBones: THREE.Bone[] = [];

    // 기타
    public mixer?: THREE.AnimationMixer;
    public actions: Record<string, THREE.AnimationAction> = {};


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
        this.vrm.scene.add(this.lookTarget);
        this.vrm.scene.add(this.gazeGoal);
        this.vrm.lookAt!.target = this.lookTarget;
        //TODO:
        this.vrm.lookAt!.autoUpdate = true;

        this.stateManager = new CharacterStateManager(this, this.vrm);

        // 히트 초기화 ----------------------------------------------------
        const names = [
            'head', 'neck', 'upperChest', 'chest', 'spine',
            'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand',
            'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot'
        ];
        this.hittableBones = names
            .map(n => this.vrm!.humanoid.getRawBoneNode(n as any))
            .filter((b): b is THREE.Bone => !!b);

        this.expressionController = new ExpressionController(this.vrm, camera);
        this.setupLookAt()


        return this.vrm;
    }

    //----------------------------------------------------------------
    // 애니메이션 로딩
    //----------------------------------------------------------------
    async initAnimations() {
        if (!this.vrm) return;
        this.mixer = new THREE.AnimationMixer(this.vrm.scene);

        const animNames = [
            'Acknowledging.fbx',
            'Agreeing.fbx',
            'Air Squat Bent Arms.fbx',
            'Angry Gesture.fbx',
            'Angry.fbx',
            'Arm Gesture.fbx',
            'Arm Stretching.fbx',
            'Arms Hip Hop Dance.fbx',
            'Bashful.fbx',
            'Being Cocky.fbx',
            'Bellydancing.fbx',
            'Blow A Kiss.fbx',
            'Bored.fbx',
            'Breathing Idle.fbx',
            'Breathing Idle1.fbx',
            'Breathing Idle2.fbx',
            'Chicken Dance.fbx',
            'Clapping.fbx',
            'Crawling.fbx',
            'Crying.fbx',
            'Dancing Twerk.fbx',
            'Dancing.fbx',
            'Dismissing Gesture.fbx',
            'Drunk Idle Variation.fbx',
            'Drunk Idle.fbx',
            'Dwarf Idle(1).fbx',
            'Dwarf Idle(2).fbx',
            'Dwarf Idle.fbx',
            'Fallen Idle.fbx',
            'Female Laying Pose.fbx',
            'Female Standing Pose.fbx',
            'Fist Pump.fbx',
            'Happy Idle(1).fbx',
            'Happy Idle.fbx',
            'Hard Head Nod.fbx',
            'Head Nod Yes.fbx',
            'Hokey Pokey.fbx',
            'Idle_nomal.fbx',
            'Injured Hurting Idle.fbx',
            'Injured Idle.fbx',
            'Jazz Dancing.fbx',
            'Joyful Jump.fbx',
            'Kick To The Groin.fbx',
            'Kiss.fbx',
            'Kneeling Idle.fbx',
            'Listening.fbx',
            'Looking Around.fbx',
            'Looking Behind.fbx',
            'Low Crawl.fbx',
            'Neck Stretching.fbx',
            'Neutral Idle.fbx',
            'No.fbx',
            'Old Man Idle.fbx',
            'Orc Idle(1).fbx',
            'Orc Idle.fbx',
            'Plotting.fbx',
            'Pointing.fbx',
            'Pouting.fbx',
            'Praying.fbx',
            'Quick Formal Bow.fbx',
            'Reacting.fbx',
            'Rumba Dancing.fbx',
            'Sad Idle(1).fbx',
            'Sad Idle.fbx',
            'Sarcastic Head Nod.fbx',
            'Shoulder Rubbing.fbx',
            'Shrugging.fbx',
            'Snake Hip Hop Dance.fbx',
            'Spank twice.fbx',
            'Standing Arguing.fbx',
            'Standing Greeting.fbx',
            'Standing Idle(1).fbx',
            'Step Hip Hop Dance.fbx',
            'Taken Hostage - Victim.fbx',
            'Talk femininely.fbx',
            'Talking.fbx',
            'Talking1.fbx',
            'Talking2.fbx',
            'Talking3.fbx',
            'Talking4.fbx',
            'Talking5.fbx',
            'Thankful.fbx',
            'Twist Dance.fbx',
            'Victory(1).fbx',
            'Victory.fbx',
            'Walking.fbx',
            'Waving(1).fbx',
            'Waving.fbx',
            'Wheelbarrow Idle.fbx',
            'Yawning.fbx',

            'base/Idle Base.fbx',
            'base/Arms crossed.fbx',
            'base/Hands on waist.fbx',

            'base/Looking Around.fbx',
            'base/Listening.fbx',
            'base/Listening2.fbx',
            'base/Listening Start.fbx',
            'base/Listening End.fbx',
            'base/talk1.fbx',
            'base/talk2.fbx',
            'base/talk3.fbx',
        ];

        this.actions = {};

        await Promise.all(
            animNames.map(async (name) => {
                const clip = await loadMixamoAnimation(`/animations/${name}`, this.vrm!);

                if (name.includes('/'))
                    name = name.split('/')[1];

                stripRootMotion(clip);

                const act = this.mixer!.clipAction(clip);


                this.actions[name] = act;
            })
        );


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
        if (!this.vrm?.lookAt) return;
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
        this.isFollowingMouse = true;
        this.gazeMoveSpeed = 20.0; // 더 빠르게
    }

    public stopMouseFollowing() {
        this.isFollowingMouse = false;
    }

    public updateMouseGaze(mouseX: number, mouseY: number) {
        if (!this.isFollowingMouse) return;
        this.lookAtGoal.position.set(mouseX * 2.0, -mouseY * 1.0 + 1.0, 1.0);
    }


    getHalfLifeParams(name: string) {
        const n = name.toLowerCase();
        if (n.includes('head') || n.includes('neck'))
            return { halfPos: 0, halfRot: this.cfg.halfRotHead };

        if (n.includes('chest') || n.includes('spine') || n.includes('upperchest'))
            return { halfPos: 0.25, halfRot: this.cfg.halfRotBody };

        return { halfPos: 0.25, halfRot: this.cfg.halfRotLimb };
    }


    // 1) 본 종류별로 반감기 지정
    getHalfLifeParams2(name: string) {
        const low = 0.18;          // 빠르게 복귀할 부위 (머리·목)
        const mid = 0.25;          // 기본
        const high = 0.35;         // 느리게 (다리 등)

        const n = name.toLowerCase();
        return {
            halfPos: n.includes('head') || n.includes('neck') ? 0 : mid,
            halfRot: n.includes('head') || n.includes('neck') ? low : mid
        };
    }


    mouseFollowTimer: any | null = null;

    //----------------------------------------------------------------
    // 마우스 타격 (충돌 위치에 따라 회전 방향 결정)
    //----------------------------------------------------------------
    hitByMouse(nx: number, ny: number, strength = 1) {
        // 0️⃣ 이전 타격 초기화 ------------------------------------------------
        this.resetHitSprings();

        // 1️⃣ 레이 발사 ------------------------------------------------------
        this.raycaster.setFromCamera({ x: nx, y: ny } as THREE.Vector2, this.camera);
        const ray = this.raycaster.ray;

        // 2️⃣ 맞은 본 찾기 (가장 가까운 본의 중심점 거리) ----------------------
        let closest: THREE.Bone | null = null;
        let minDist = Infinity;
        const tmp = new THREE.Vector3();

        for (const b of this.hittableBones) {
            b.getWorldPosition(tmp);
            const d = ray.distanceToPoint(tmp);
            if (d < 0.15 && d < minDist) { closest = b; minDist = d; }
        }
        if (!closest) return;



        // 3️⃣ 충돌 지점 및 토크 축 계산 --------------------------------------
        const bonePos = new THREE.Vector3();
        closest.getWorldPosition(bonePos);              // 본 중심 (월드)
        const hitPoint = new THREE.Vector3();
        ray.closestPointToPoint(bonePos, hitPoint);      // 레이–점 최근접점

        const ndc = hitPoint.clone().project(this.camera);   // NDC (-1~1)
        const rect = this.canvas!.getBoundingClientRect();
        const screenX = (ndc.x * 0.5 + 0.5) * rect.width + rect.left;
        const screenY = (-ndc.y * 0.5 + 0.5) * rect.height + rect.top;

        addSpark(screenX, screenY);    // 2) DOM 스파크 스폰 ‼️

        const r = hitPoint.clone().sub(bonePos);         // 중심 → 충돌점
        //const torqueAxis = new THREE.Vector3().crossVectors(r, ray.direction);
        const torqueAxis = new THREE.Vector3().crossVectors(ray.direction, r);

        // 레이 정면‑히트(외적≈0) 때는 기본 축으로
        if (torqueAxis.lengthSq() < 1e-6) {
            torqueAxis.set(0, 1, 0).cross(ray.direction);
        }
        torqueAxis.normalize();

        // 4️⃣ 파라미터 선택 (본 종류별) --------------------------------------
        const name = closest.name.toLowerCase();
        const rotImpulse =
            name.includes('head') || name.includes('neck') ? this.cfg.rotImpulseHead :
                name.includes('chest') || name.includes('spine') ? this.cfg.rotImpulseBody :
                    this.cfg.rotImpulseLimb;

        const { halfPos, halfRot } = this.getHalfLifeParams(closest.name);

        // 5️⃣ 선속도·각속도 ---------------------------------------------------
        const velPos = ray.direction.clone().multiplyScalar(0.6 * strength);
        const velRot = torqueAxis.multiplyScalar(rotImpulse * strength);

        // 6️⃣ hitState 등록 ---------------------------------------------------
        this.hitStates.push({
            bone: closest,
            originalPos: closest.position.clone(),
            originalQuat: closest.quaternion.clone(),
            velPos,
            velRot,
            halfPos,
            halfRot
        });

        this.startMouseFollowing();
        //3초간 마우스 팔로우
        if (this.mouseFollowTimer) clearTimeout(this.mouseFollowTimer);
        this.mouseFollowTimer = setTimeout(() => {
            this.stopMouseFollowing();
        }, 3000);
    }


    public async speak(buffer: ArrayBuffer) {
        await new Promise((resolve) => {
            this.lipSync.playFromArrayBuffer(buffer, () => resolve(true));
        });
    }

    resetHitSprings() {
        for (const st of this.hitStates) {
            st.bone.position.copy(st.originalPos);
            st.bone.quaternion.copy(st.originalQuat);
            st.bone.updateMatrixWorld(true);
        }
        this.hitStates.length = 0;          // 배열 완전 비우기
        this.hitStates = [];
    }


    applyHitSprings(dt: number) {
        // --- Hit reaction 스프링 ---------------------------------
        for (let i = this.hitStates.length - 1; i >= 0; --i) {
            const st = this.hitStates[i];
            springPos(st.bone.position, st.velPos, st.originalPos, st.halfPos, dt);
            springQuat(st.bone.quaternion, st.velRot, st.originalQuat, st.halfRot, dt);
            st.bone.updateMatrixWorld(true);   // ← 반드시

            // update 루프에서
            if (isSettledPos(st) && isSettledRot(st)) {
                st.bone.position.copy(st.originalPos);
                st.bone.quaternion.copy(st.originalQuat);
                this.hitStates.splice(i, 1);
            }

        }
    }

    fps = 0
    DEBUG_MODE = false

    //----------------------------------------------------------------
    public doGesture(gestureName: string) {
        this.stateManager?.triggerGesture(gestureName);
    }

    // 매 프레임 업데이트
    //----------------------------------------------------------------
    update(dt: number) {
        if (!this.vrm) return;

        // 2.2 LookAt 스프링 보간 --------------------------------------
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

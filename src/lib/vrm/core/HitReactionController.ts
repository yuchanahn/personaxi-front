import { VRM } from '@pixiv/three-vrm';
import * as THREE from 'three/webgpu';

type HitReactionConfig = {
    rotImpulseHead: number;
    halfRotHead: number;
    rotImpulseBody: number;
    halfRotBody: number;
    rotImpulseLimb: number;
    halfRotLimb: number;
};

type HitReactionState = {
    bone: THREE.Bone;
    rotationOffset: THREE.Quaternion;
    targetRotation: THREE.Quaternion;
    appliedRotation: THREE.Quaternion;
    halfRot: number;
    maxAngle: number;
    phase: 'impact' | 'recover';
};

type HitReactionControllerOptions = {
    vrm: VRM;
    camera: THREE.PerspectiveCamera;
    getCanvas: () => HTMLCanvasElement | null;
    getConfig: () => HitReactionConfig;
    startMouseFollowing: () => void;
    stopMouseFollowing: () => void;
    spawnSpark?: (x: number, y: number) => void;
};

const IDENTITY_QUATERNION = new THREE.Quaternion();

export class HitReactionController {
    private readonly vrm: VRM;
    private readonly camera: THREE.PerspectiveCamera;
    private readonly getCanvas: () => HTMLCanvasElement | null;
    private readonly getConfig: () => HitReactionConfig;
    private readonly startMouseFollowing: () => void;
    private readonly stopMouseFollowing: () => void;
    private readonly spawnSpark?: (x: number, y: number) => void;

    private readonly raycaster = new THREE.Raycaster();
    private readonly hittableBones: THREE.Bone[];
    private readonly states = new Map<string, HitReactionState>();

    private mouseFollowTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(options: HitReactionControllerOptions) {
        this.vrm = options.vrm;
        this.camera = options.camera;
        this.getCanvas = options.getCanvas;
        this.getConfig = options.getConfig;
        this.startMouseFollowing = options.startMouseFollowing;
        this.stopMouseFollowing = options.stopMouseFollowing;
        this.spawnSpark = options.spawnSpark;

        const hittableBoneNames = [
            'head',
            'neck',
            'upperChest',
            'chest',
            'spine',
            'leftUpperArm',
            'leftLowerArm',
            'leftHand',
            'rightUpperArm',
            'rightLowerArm',
            'rightHand',
            'leftUpperLeg',
            'leftLowerLeg',
            'leftFoot',
            'rightUpperLeg',
            'rightLowerLeg',
            'rightFoot',
        ];

        this.hittableBones = hittableBoneNames
            .map((name) => this.vrm.humanoid.getRawBoneNode(name as any))
            .filter((bone): bone is THREE.Bone => !!bone);
    }

    public beforeBaseUpdate() {
        for (const state of this.states.values()) {
            this.removeAppliedOffset(state);
        }
    }

    public afterBaseUpdate(dt: number) {
        for (const [key, state] of this.states.entries()) {
            if (state.phase === 'impact') {
                const impactAlpha = 1 - Math.exp(-24 * dt);
                state.rotationOffset.slerp(state.targetRotation, impactAlpha);

                if (state.rotationOffset.angleTo(state.targetRotation) < 0.02) {
                    state.phase = 'recover';
                }
            } else {
                const recoverAlpha = 1 - Math.exp((-3 * Math.log(2) * dt) / Math.max(state.halfRot, 1e-3));
                state.rotationOffset.slerp(IDENTITY_QUATERNION, recoverAlpha);
            }

            this.clampRotationOffset(state);

            if (this.isSettled(state)) {
                state.rotationOffset.identity();
                state.appliedRotation.identity();
                this.states.delete(key);
                continue;
            }

            state.bone.quaternion.multiply(state.rotationOffset).normalize();
            state.appliedRotation.copy(state.rotationOffset);
            state.bone.updateMatrixWorld(true);
        }
    }

    public handlePointerHit(nx: number, ny: number, strength = 1) {
        this.reset();

        const canvas = this.getCanvas();
        if (!canvas) {
            return;
        }

        this.raycaster.setFromCamera({ x: nx, y: ny } as THREE.Vector2, this.camera);
        const ray = this.raycaster.ray;

        let closest: THREE.Bone | null = null;
        let minDist = Infinity;
        const worldPoint = new THREE.Vector3();

        for (const bone of this.hittableBones) {
            bone.getWorldPosition(worldPoint);
            const distance = ray.distanceToPoint(worldPoint);
            if (distance < 0.15 && distance < minDist) {
                closest = bone;
                minDist = distance;
            }
        }

        if (!closest) {
            return;
        }

        const bonePos = new THREE.Vector3();
        closest.getWorldPosition(bonePos);

        const hitPoint = new THREE.Vector3();
        ray.closestPointToPoint(bonePos, hitPoint);

        this.spawnSparkAtHitPoint(hitPoint, canvas);

        const centerToHit = hitPoint.clone().sub(bonePos);
        const torqueAxis = new THREE.Vector3().crossVectors(ray.direction, centerToHit);
        if (torqueAxis.lengthSq() < 1e-6) {
            torqueAxis.set(0, 1, 0).cross(ray.direction);
        }
        torqueAxis.normalize();

        const parentWorldQuaternion = new THREE.Quaternion();
        closest.parent?.getWorldQuaternion(parentWorldQuaternion);
        const localTorqueAxis = torqueAxis
            .clone()
            .applyQuaternion(parentWorldQuaternion.invert())
            .normalize();

        const { rotImpulse, halfRot, maxAngle, restrictRoll } = this.getReactionParams(closest.name);
        if (restrictRoll) {
            localTorqueAxis.z = 0;
            if (localTorqueAxis.lengthSq() < 1e-6) {
                localTorqueAxis.set(0, 1, 0);
            } else {
                localTorqueAxis.normalize();
            }
        }

        const impactAngle = Math.min(maxAngle, rotImpulse * Math.max(strength, 0.45) * 0.016);
        const state: HitReactionState = {
            bone: closest,
            rotationOffset: new THREE.Quaternion(),
            targetRotation: new THREE.Quaternion().setFromAxisAngle(localTorqueAxis, impactAngle),
            appliedRotation: new THREE.Quaternion(),
            halfRot,
            maxAngle,
            phase: 'impact',
        };

        this.states.set(closest.uuid, state);
        this.startMouseFollowing();
        this.armMouseFollowCooldown();
    }

    public reset() {
        for (const state of this.states.values()) {
            this.removeAppliedOffset(state);
        }

        this.states.clear();
        this.clearMouseFollowTimer();
        this.stopMouseFollowing();
    }

    public dispose() {
        this.reset();
    }

    private removeAppliedOffset(state: HitReactionState) {
        if (this.isIdentityRotation(state.appliedRotation)) {
            return;
        }

        state.bone.quaternion.multiply(state.appliedRotation.clone().invert()).normalize();
        state.bone.updateMatrixWorld(true);
        state.appliedRotation.identity();
    }

    private spawnSparkAtHitPoint(hitPoint: THREE.Vector3, canvas: HTMLCanvasElement) {
        if (!this.spawnSpark) {
            return;
        }

        const ndc = hitPoint.clone().project(this.camera);
        const rect = canvas.getBoundingClientRect();
        const screenX = (ndc.x * 0.5 + 0.5) * rect.width + rect.left;
        const screenY = (-ndc.y * 0.5 + 0.5) * rect.height + rect.top;
        this.spawnSpark(screenX, screenY);
    }

    private getReactionParams(boneName: string) {
        const config = this.getConfig();
        const lowerName = boneName.toLowerCase();

        if (lowerName.includes('head') || lowerName.includes('neck')) {
            return {
                rotImpulse: config.rotImpulseHead * 0.4,
                halfRot: config.halfRotHead,
                maxAngle: THREE.MathUtils.degToRad(26),
                restrictRoll: true,
            };
        }

        if (
            lowerName.includes('upperchest') ||
            lowerName.includes('chest') ||
            lowerName.includes('spine')
        ) {
            return {
                rotImpulse: config.rotImpulseBody * 0.55,
                halfRot: config.halfRotBody,
                maxAngle: THREE.MathUtils.degToRad(18),
                restrictRoll: true,
            };
        }

        return {
            rotImpulse: config.rotImpulseLimb * 0.7,
            halfRot: config.halfRotLimb,
            maxAngle: THREE.MathUtils.degToRad(32),
            restrictRoll: false,
        };
    }

    private clampRotationOffset(state: HitReactionState) {
        const angle = state.rotationOffset.angleTo(IDENTITY_QUATERNION);
        if (angle <= state.maxAngle) {
            return;
        }

        const sinHalf = Math.sqrt(Math.max(1 - state.rotationOffset.w * state.rotationOffset.w, 0));
        let axis = new THREE.Vector3(0, 1, 0);
        if (sinHalf > 1e-5) {
            axis = new THREE.Vector3(
                state.rotationOffset.x / sinHalf,
                state.rotationOffset.y / sinHalf,
                state.rotationOffset.z / sinHalf,
            ).normalize();
        }

        state.rotationOffset.setFromAxisAngle(axis, state.maxAngle);
    }

    private armMouseFollowCooldown() {
        this.clearMouseFollowTimer();
        this.mouseFollowTimer = setTimeout(() => {
            this.stopMouseFollowing();
            this.mouseFollowTimer = null;
        }, 3000);
    }

    private clearMouseFollowTimer() {
        if (this.mouseFollowTimer) {
            clearTimeout(this.mouseFollowTimer);
            this.mouseFollowTimer = null;
        }
    }

    private isIdentityRotation(quaternion: THREE.Quaternion) {
        return quaternion.angleTo(IDENTITY_QUATERNION) < 1e-5;
    }

    private isSettled(state: HitReactionState) {
        const angle = state.rotationOffset.angleTo(IDENTITY_QUATERNION);
        return state.phase === 'recover' && angle < 0.01;
    }
}

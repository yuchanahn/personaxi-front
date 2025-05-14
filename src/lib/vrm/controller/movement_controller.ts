import { Model } from "../model"
import { AnimController } from "../animation/anim_controller"
import * as THREE from "three"

export class MovementController {
    private _model: Model
    private _animController: AnimController

    private _target_position: THREE.Vector3 = new THREE.Vector3()
    private _current_position: THREE.Vector3 = new THREE.Vector3()

    private _prev_velocity: THREE.Vector3 = new THREE.Vector3()
    private _velocity: THREE.Vector3 = new THREE.Vector3()

    private _time: number = 0

    constructor(model: Model, animController: AnimController) {
        this._model = model
        this._animController = animController
    }

    public update(delta: number) {
        this._move(delta)

        //velocity 가 0이면 idle 0이 아니면 walk
        if (this._prev_velocity.length() === 0 && this._velocity.length() > 0) {
            this._animController.play('Walking', true)
        } else if (this._prev_velocity.length() > 0 && this._velocity.length() === 0) {
            this._animController.play('Idle_nomal', true)
        }
    }
    
    private _move(delta: number) {
        //모델이 타겟을 바라보고 타겟으로 이동
        const model = this._model.vrm?.scene
        if (model) {
            const pos = model.position.y
            model.lookAt(this._target_position.clone().setY(pos))

            this._prev_velocity.copy(this._velocity)
            const position = model.position
            if (position) {
                this._velocity = this._target_position.clone().sub(position).normalize().multiplyScalar(1)
                //this._model.vrm?.humanoid.getNormalizedBoneNode('hips')?.position.copy(this._current_position)
                // 충분히 가까워지면 멈춤
                if (position.distanceTo(this._target_position) < 0.1) {
                    this._velocity.set(0, 0, 0)
                }
                this._velocity.y = 0
                position.add(this._velocity.clone().multiplyScalar(delta))
            }
        }
    }

    public setPosition(position: THREE.Vector3) {
        this._current_position.copy(position)
    }

    public setTarget(target: THREE.Vector3) {
        this._target_position.copy(target)
    }
}

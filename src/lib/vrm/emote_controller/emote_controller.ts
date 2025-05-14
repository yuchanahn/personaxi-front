import * as THREE from 'three'
import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm'
import { ExpressionController } from './expression_controller'

export class EmoteController {
  private _expressionController: ExpressionController

  constructor(vrm: VRM, camera: THREE.Object3D) {
    this._expressionController = new ExpressionController(vrm, camera)
  }

  public playEmotion(emotions: { key: string; value: number }[]) {
    this._expressionController.playEmotion(emotions)
  }

  public lipSync(preset: VRMExpressionPresetName, value: number) {
    this._expressionController.lipSync(preset, value)
  }

  public update(delta: number) {
    this._expressionController.update(delta)
  }
}

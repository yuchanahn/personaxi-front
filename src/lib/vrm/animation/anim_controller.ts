import type { Model } from '../model'
import * as THREE from 'three'
export class AnimController {
  private _model?: Model
  constructor(model: Model) {
    this._model = model
  }

  public play(anim: string, loop: boolean = false, speed: number = 1) {
    this._currentAction = this._model?.actions.get(this._model?.anims[anim]!) ?? null
    if (loop) {
      this._currentAction?.setLoop(THREE.LoopRepeat, Infinity)
    } else {
      this._currentAction?.setLoop(THREE.LoopOnce, 0)
    }
    //this._currentAction!.timeScale = speed
    this._currentAction?.reset().play()
  }
  
  public test() {
    setTimeout(() => {
      this.play('Dancing')
      console.log('test')
    }, 5000)
  }

  public get animations() {
    return this._model?.anims
  }

  public actionName(action: THREE.AnimationAction): string {
    const key = Object.keys(this.animations!).find(
      (key) => this.animations![key] === action.getClip()
    )
    return key ?? ''
  }

  private _currentAction: THREE.AnimationAction | null = null
  private _prevAction: THREE.AnimationAction | null = null
  public update(delta: number) {
    if (this._prevAction !== this._currentAction && this._currentAction !== null) {
      this._currentAction!.enabled = true
      this._currentAction!.setEffectiveTimeScale(1)
      this._currentAction!.setEffectiveWeight(1)
      this._currentAction!.time = 0
      
      this._prevAction?.crossFadeTo(this._currentAction!, 0.3, true)

      console.log(
        'prev : ',
        this._prevAction ? this.actionName(this._prevAction!) : 'null',
        'next : ',
        this.actionName(this._currentAction!)
      )

      this._prevAction = this._currentAction
    }

    if (this._currentAction && this._currentAction !== this._model?.defaultAnimation) {
      if (this._currentAction.time + 0.3 >= this._currentAction.getClip().duration) {
        //this._currentAction.time = 0
        //this.play(this.actionName(this._model?.defaultAnimation!), true)
        console.log('set default animation')
      }
    }
  }
}

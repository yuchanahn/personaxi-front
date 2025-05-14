import { VRMExpressionManager } from '@pixiv/three-vrm'

export const BLINK_CLOSE_MAX = 0.12
export const BLINK_OPEN_MAX = 5

export class AutoBlink {
  private _expressionManager: VRMExpressionManager
  private _remainingTime: number
  private _isOpen: boolean
  private _isAutoBlink: boolean

  constructor(expressionManager: VRMExpressionManager) {
    this._expressionManager = expressionManager
    this._remainingTime = 0
    this._isAutoBlink = true
    this._isOpen = true
  }

  /**
   * @param isAuto
   * @returns remaining time until opening the eye
   */
  public setEnable(isAuto: boolean): number {
    this._isAutoBlink = isAuto
    return !this._isOpen ? this._remainingTime : 0
  }

  public update(delta: number) {
    if (this._remainingTime > 0) {
      this._remainingTime -= delta
      return
    }

    if (this._isOpen && this._isAutoBlink) {
      this.close()
      return
    }

    this.open()
  }

  private close() {
    this._isOpen = false
    this._remainingTime = BLINK_CLOSE_MAX
    this._expressionManager.setValue('blink', 1)
  }

  private open() {
    this._isOpen = true
    this._remainingTime = BLINK_OPEN_MAX
    this._expressionManager.setValue('blink', 0)
  }
}

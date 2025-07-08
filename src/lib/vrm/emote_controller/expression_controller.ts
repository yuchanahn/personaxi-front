import * as THREE from 'three'
import { VRM, VRMExpressionManager, VRMExpressionPresetName } from '@pixiv/three-vrm'
import { AutoLookAt } from './auto_look_at'
import { AutoBlink } from './auto_blink'

import { custom_expressions } from './custom_expression'
import { emotionExpressions } from './expressions'



export class ExpressionController {
  private _autoLookAt: AutoLookAt
  private _autoBlink?: AutoBlink
  private _expressionManager?: VRMExpressionManager
  private _currentLipSync: {
    preset: VRMExpressionPresetName
    value: number
  } | null

  private _currentExpressions: {
    key: string
    value: number
    target_value: number
    ease_time: number
  }[] = []

  constructor(vrm: VRM, camera: THREE.Object3D) {
    this._autoLookAt = new AutoLookAt(vrm, camera)
    this._autoLookAt.start()

    this._currentLipSync = null
    if (vrm.expressionManager) {
      this._expressionManager = vrm.expressionManager
      this._autoBlink = new AutoBlink(vrm.expressionManager)
    }

    const ignore_expressions = [
      'Fcl_MTH_A',
      'Fcl_MTH_I',
      'Fcl_MTH_U',
      'Fcl_MTH_E',
      'Fcl_MTH_O',
      'Fcl_MTH_Joy',
      'Fcl_MTH_Sorrow',
      'Fcl_MTH_Surprised',
    ]

    // 1. 전체 감정 데이터를 순회합니다.
    emotionExpressions.forEach(emotion => {
      // 2. 각 감정의 targets 배열을 순회합니다.
      emotion.targets.forEach(target => {
        // 3. targetName이 일치하는지 확인합니다.
        if (ignore_expressions.includes(target.targetName)) {
          // 4. 일치하면 weight를 0으로 설정합니다.
          //console.log(`Found and modified: ${emotion.name} -> ${target.targetName}`);
          target.weight = 0;
        }
      });
    });

    const expressions = custom_expressions(vrm, emotionExpressions)

    expressions.forEach((x) => {
      this._expressionManager?.registerExpression(x)
    })
  }

  /**
   * 이징 함수 (Ease-In-Out Sine)
   * @param t 진행률 (0 ~ 1)
   * @returns 이징이 적용된 값 : 0 ~ 1 사이의 값 1이면 최대값, 0이면 최소값
   */
  private _easeInOutSine(t: number): number {
    return 0.5 * (1 - Math.cos(Math.PI * t))
  }

  public playEmotion(emotions: { key: string; value: number }[]) {
    this._currentExpressions = this._currentExpressions.map((x) => {
      const y = emotions.find((y) => y.key === x.key)
      return {
        key: x.key,
        value: x.target_value,
        target_value: y?.value ?? 0,
        ease_time: 0
      }
    })
    //중복되지 않는 경우 추가
    emotions.forEach((x) => {
      if (this._currentExpressions.find((y) => y.key === x.key) === undefined) {
        this._currentExpressions.push({
          key: x.key,
          value: 0,
          target_value: x.value,
          ease_time: 0
        })
      }
    })
  }

  public lipSync(preset: VRMExpressionPresetName, value: number) {
    if (this._currentLipSync) {
      this._expressionManager?.setValue(this._currentLipSync.preset, 0)
    }
    this._currentLipSync = {
      preset,
      value
    }
  }

  private lerp(start: number, end: number, t: number): number {
    return start + t * (end - start)
  }

  public update(delta: number) {
    if (this._autoBlink) {
      this._autoBlink.update(delta)
    }

    this._currentExpressions.forEach((x) => {
      if (x.ease_time === 1) {
        return
      }
      x.ease_time = Math.min(x.ease_time + delta, 1)
      this._expressionManager?.setValue(
        x.key,
        this.lerp(x.value, x.target_value, this._easeInOutSine(x.ease_time))
      )
    })

    this._currentExpressions = this._currentExpressions.filter(
      (x) => x.target_value !== 0 || x.ease_time !== 1
    )

    if (this._currentLipSync) {
      const weight = this._currentLipSync.value * 0.5
      this._expressionManager?.setValue(this._currentLipSync.preset, weight)
    }
  }
}

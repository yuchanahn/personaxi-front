import * as THREE from 'three'
import { VRM, VRMExpression } from '@pixiv/three-vrm'

class VRMExpressionMorphTargetBind {
  public readonly primitives: THREE.Mesh[]
  public readonly index: number
  public readonly weight: number

  public constructor({
    primitives,
    index,
    weight
  }: {
    primitives: THREE.Mesh[]
    index: number
    weight: number
  }) {
    this.primitives = primitives
    this.index = index
    this.weight = weight
  }

  public applyWeight(weight: number): void {
    this.primitives.forEach((mesh) => {
      if (mesh.morphTargetInfluences?.[this.index] != null) {
        mesh.morphTargetInfluences[this.index] += this.weight * weight
      }
    })
  }

  public clearAppliedWeight(): void {
    this.primitives.forEach((mesh) => {
      if (mesh.morphTargetInfluences?.[this.index] != null) {
        mesh.morphTargetInfluences[this.index] = 0.0
      }
    })
  }
}

export function custom_expressions(
  vrm: VRM,
  expressionsData: Array<{ name: string; targets: Array<{ targetName: string; weight: number }> }>
): VRMExpression[] {
  const expressions: VRMExpression[] = []

  expressionsData.forEach(({ name, targets }) => {
    const expression = new VRMExpression(name)

    // Face 오브젝트 찾기
    const faceObject = vrm.scene.getObjectByName('Face')
    if (!faceObject) {
      console.warn('vrm.faceObjectNotFound')
      return
    }

    // Face 오브젝트의 프리미티브 가져오기
    const primitives = faceObject.children.filter(
      (child) => child instanceof THREE.Mesh
    ) as THREE.Mesh[]

    // SkinnedMesh에서 morphTargetDictionary 가져오기
    const skinnedMesh = faceObject.children[0] as THREE.SkinnedMesh
    const morphTargetDictionary = skinnedMesh.morphTargetDictionary

    if (!morphTargetDictionary) {
      console.warn('vrm.morphTargetDictionaryNotFound')
      return
    }

    // 여러 target을 바인드하는 부분
    targets.forEach(({ targetName, weight }) => {
      if (morphTargetDictionary[targetName] !== undefined) {
        expression.addBind(
          new VRMExpressionMorphTargetBind({
            primitives,
            index: morphTargetDictionary[targetName],
            weight
          })
        )
      } else {
        console.warn('vrm.targetNotFound', { values: { targetName } })
      }
    })

    expressions.push(expression) // expression을 배열에 추가
  })

  return expressions // 모든 Expression 객체를 배열로 반환
}

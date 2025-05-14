import * as THREE from 'three'
import { VRM } from '@pixiv/three-vrm'

export class AutoLookAt {
  private _vrm: VRM
  private _lookAtTarget: THREE.Object3D

  constructor(vrm: VRM, camera: THREE.Object3D) {
    this._vrm = vrm
    this._lookAtTarget = new THREE.Object3D()
    camera.add(this._lookAtTarget)
  }

  public start() {
    if (this._vrm.lookAt) {
      this._vrm.lookAt.target = this._lookAtTarget
    }
  }
}

import * as THREE from 'three'
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VrmAnimation } from './animation/animation'
import { LipSync } from './lip_sync/lip_sync'
import { EmoteController } from './emote_controller/emote_controller'

// WebGPU compatible material
import { MToonMaterialLoaderPlugin } from '@pixiv/three-vrm'
import { MToonNodeMaterial } from '@pixiv/three-vrm/nodes'
import { loadMixamoAnimation } from './animation/mixamo_animation'
import { base } from '$app/paths'
import { AnimController } from './animation/anim_controller'
import { MovementController } from './controller/movement_controller'
// GLTF Loader
const loader = new GLTFLoader()
loader.register((parser) => {
  const mtoonMaterialPlugin = new MToonMaterialLoaderPlugin(parser, {
    materialType: MToonNodeMaterial
  })
  return new VRMLoaderPlugin(parser, { mtoonMaterialPlugin })
})

export class Model {
  public vrm?: VRM | null
  public mixer?: THREE.AnimationMixer
  public emoteController?: EmoteController
  public animController?: AnimController
  public movementController?: MovementController
  public anims: { [key: string]: THREE.AnimationClip } = {}
  public actions: Map<THREE.AnimationClip, THREE.AnimationAction> = new Map()

  public defaultAnimation: THREE.AnimationAction | null = null
  private _prevAction: THREE.AnimationAction | null = null
  private _currentAction: THREE.AnimationAction | null = null

  private _lookAtTargetParent: THREE.Object3D
  private _lipSync: LipSync

  constructor(lookAtTargetParent: THREE.Object3D) {
    this._lookAtTargetParent = lookAtTargetParent
    this._lipSync = new LipSync(new AudioContext())
  }

  public async loadVrm(url: string): Promise<void> {
    const gltf = await loader.loadAsync(url)

    this.vrm = gltf.userData.vrm
    if (!this.vrm) {
      return Promise.reject(new Error('VRM load failed!'))
    }

    VRMUtils.rotateVRM0(this.vrm)
    this.vrm.scene.name = 'VRMRoot'
    this.vrm.scene.traverse((obj) => (obj.frustumCulled = false))
    this.mixer = new THREE.AnimationMixer(this.vrm.scene)
    this.emoteController = new EmoteController(this.vrm, this._lookAtTargetParent)
    this.animController = new AnimController(this)

    this.anims['Idle_nomal'] = await loadMixamoAnimation(
      base + '/animations/Idle_nomal.fbx',
      this.vrm
    )

    const animations: string[] = [
      
    ]

    for (const file of animations) {
      if (file !== 'Walking') continue
      const anim = await loadMixamoAnimation(base + `/animations/${file}.fbx`, this.vrm)
      this.anims[file] = anim
    }

    for (const key in this.anims) {
      this.actions.set(this.anims[key], this.mixer?.clipAction(this.anims[key])!)
    }

    this.defaultAnimation = this.actions.get(this.anims['Idle_nomal'])!
    this._prevAction = this.defaultAnimation
    this.animController?.play('Idle_nomal', true)
    this.animController?.test()
    this.movementController = new MovementController(this, this.animController)
  }

  public unloadVrm() {
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene)
      this.vrm = null
    }
  }

  public async playAnimation(vrmAnimation: VrmAnimation): Promise<void> {
    const { vrm, mixer } = this
    if (vrm == null || mixer == null) {
      throw new Error('You have to load VRM first')
    }

    const clip = vrmAnimation.createAnimationClip(vrm)
    const action = mixer.clipAction(clip)
    action.play()
  }

  public async playMixamoAnimation(
    clip: THREE.AnimationClip,
    loop: boolean = false
  ): Promise<void> {
    const { vrm, mixer } = this
    if (vrm == null || mixer == null) {
      throw new Error('You have to load VRM first')
    }

    const newAction = this.actions.get(clip)
    if (!newAction) return

    console.log('start action')

    newAction.reset().play()

    if (this._prevAction) {
      newAction.enabled = true
      newAction.setEffectiveTimeScale(1)
      newAction.setEffectiveWeight(1)
      newAction.time = 0

      this._prevAction.crossFadeTo(newAction, 1, true)
    }

    this._prevAction = newAction
    this._currentAction = newAction

    if (loop) return

    setTimeout(
      (self: Model) => {
        if (self.defaultAnimation) {
          //this.anims 에서 key값 찾아서 넣기
          const key = Object.keys(self.anims).find(
            (key) => self.anims[key] === self._currentAction?.getClip()
          )

          console.log('end action [', key, ']')

          self.defaultAnimation.play()

          self.defaultAnimation.enabled = true
          self.defaultAnimation.setEffectiveTimeScale(1)
          self.defaultAnimation.setEffectiveWeight(1)
          self.defaultAnimation.time = 0

          if (self._currentAction === self.defaultAnimation) return

          self._currentAction?.crossFadeTo(self.defaultAnimation, 1, true)
          self._prevAction = self.defaultAnimation
          self._currentAction = self.defaultAnimation
        }
      },
      clip.duration * 990,
      this
    )
  }

  public async speak(buffer: ArrayBuffer) {
    await new Promise((resolve) => {
      this._lipSync.playFromArrayBuffer(buffer, () => {
        resolve(true)
      })
    })
  }

  public update(delta: number): void {
    if (this.vrm) {
      const { volume } = this._lipSync.update()
      this.emoteController?.lipSync('aa', volume)
      this.emoteController?.update(delta)
      this.mixer?.update(delta)
      this.animController?.update(delta)
      this.movementController?.update(delta)
      this.vrm?.update(delta)
    }
  }
}

import * as THREE from 'three'
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { mixamoVRMRigMap } from './mixamoVRMRigMap'
import { saveClipAsJSON } from './utils/anim'


/**
 * Load Mixamo animation, convert for three-vrm use, and return it.
 *
 * @param {string} url A url of mixamo animation data
 * @param {VRM} vrm A target VRM
 * @returns {Promise<THREE.AnimationClip>} The converted AnimationClip
 */
function loadMixamoAnimation(url: string, vrm: VRM) {
  const loader = new FBXLoader() // A loader which loads FBX
  return loader.loadAsync(url).then((asset) => {
    const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com') // extract the AnimationClip

    const tracks: THREE.KeyframeTrack[] = [] // KeyframeTracks compatible with VRM will be added here

    const restRotationInverse = new THREE.Quaternion()
    const parentRestWorldRotation = new THREE.Quaternion()
    const _quatA = new THREE.Quaternion()
    const _vec3 = new THREE.Vector3()

    // Adjust with reference to hips height.
    const motionHipsHeight = asset.getObjectByName('mixamorigHips')?.position.y
    const vrmHipsY = vrm.humanoid?.getNormalizedBoneNode('hips')?.getWorldPosition(_vec3).y
    const vrmRootY = vrm.scene.getWorldPosition(_vec3).y
    let hipsPositionScale = 1

    if (vrmHipsY !== undefined && vrmRootY !== undefined && motionHipsHeight !== undefined) {
      const vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY)
      hipsPositionScale = vrmHipsHeight / motionHipsHeight
    } else {
      console.error('One or more variables are undefined:', {
        vrmHipsY,
        vrmRootY,
        motionHipsHeight
      })
    }

    clip.tracks.forEach((track) => {
      // Convert each tracks for VRM use, and push to `tracks`
      const trackSplitted = track.name.split('.')
      const mixamoRigName = trackSplitted[0]
      const vrmBoneName = mixamoVRMRigMap[
        mixamoRigName as keyof typeof mixamoVRMRigMap
      ] as VRMHumanBoneName
      const vrmNodeName = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName)?.name
      const mixamoRigNode = asset.getObjectByName(mixamoRigName)

      if (vrmNodeName != null) {
        const propertyName = trackSplitted[1]

        // Store rotations of rest-pose.
        mixamoRigNode?.getWorldQuaternion(restRotationInverse).invert()
        mixamoRigNode?.parent?.getWorldQuaternion(parentRestWorldRotation)

        if (track instanceof THREE.QuaternionKeyframeTrack) {
          // Retarget rotation of mixamoRig to NormalizedBone.
          for (let i = 0; i < track.values.length; i += 4) {
            const flatQuaternion = track.values.slice(i, i + 4)

            _quatA.fromArray(flatQuaternion)

            // 親のレスト時ワールド回転 * トラックの回転 * レスト時ワールド回転の逆
            _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse)

            _quatA.toArray(flatQuaternion)

            flatQuaternion.forEach((v, index) => {
              track.values[index + i] = v
            })
          }

          tracks.push(
            new THREE.QuaternionKeyframeTrack(
              `${vrmNodeName}.${propertyName}`,
              track.times,
              track.values.map((v, i) => (vrm.meta?.metaVersion === '0' && i % 2 === 0 ? -v : v))
            )
          )
        } else if (track instanceof THREE.VectorKeyframeTrack) {
          const value = track.values.map(
            (v, i) => (vrm.meta?.metaVersion === '0' && i % 3 !== 1 ? -v : v) * hipsPositionScale
          )
          tracks.push(
            new THREE.VectorKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times, value)
          )
        }
      }
    })

    const vrmClip = new THREE.AnimationClip('vrmAnimation', clip.duration, tracks);

    saveClipAsJSON(vrmClip, `${url}`)

    return vrmClip
  })
}

export { loadMixamoAnimation }

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VrmAnimation } from './animation'
import { VRMAnimationLoaderPlugin } from './animatin_loader_plugin'

const loader = new GLTFLoader()
loader.register(() => new VRMAnimationLoaderPlugin())

export async function loadVrmAnimation(url: string): Promise<VrmAnimation | null> {
  const gltf = await loader.loadAsync(url)

  const vrmAnimations: VrmAnimation[] = gltf.userData.vrmAnimations
  const vrmAnimation: VrmAnimation | undefined = vrmAnimations[0]

  return vrmAnimation ?? null
}

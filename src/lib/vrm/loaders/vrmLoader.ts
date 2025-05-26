import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MToonMaterialLoaderPlugin } from '@pixiv/three-vrm-materials-mtoon';
import { MToonNodeMaterial } from '@pixiv/three-vrm-materials-mtoon/nodes';
import { VRMLoaderPlugin } from '@pixiv/three-vrm'

export function createVRMLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.register((parser) => {
    const mtoonMaterialPlugin = new MToonMaterialLoaderPlugin(parser, {
      materialType: MToonNodeMaterial,
    })
    return new VRMLoaderPlugin(parser, { mtoonMaterialPlugin })
  })
  return loader;
}
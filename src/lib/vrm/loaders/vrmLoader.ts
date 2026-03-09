import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MToonMaterialLoaderPlugin } from '@pixiv/three-vrm-materials-mtoon';
import { MToonNodeMaterial } from '@pixiv/three-vrm-materials-mtoon/nodes';
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import * as THREE from 'three/webgpu';

let singletonLoader: GLTFLoader | null = null;

export function createVRMLoader(): GLTFLoader {
  if (singletonLoader) {
    return singletonLoader;
  }

  const manager = new THREE.LoadingManager();
  const loader = new GLTFLoader(manager);
  loader.register((parser) => {
    const mtoonMaterialPlugin = new MToonMaterialLoaderPlugin(parser, {
      materialType: MToonNodeMaterial,
    })
    return new VRMLoaderPlugin(parser, { mtoonMaterialPlugin })
  })

  singletonLoader = loader;
  return singletonLoader;
}

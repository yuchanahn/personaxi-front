import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

export async function validateVRMLicense(file: File): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const loader = new GLTFLoader();
        loader.register((parser) => {
            return new VRMLoaderPlugin(parser);
        });

        loader.load(
            url,
            (gltf) => {
                URL.revokeObjectURL(url);
                const vrm = gltf.userData.vrm;
                const meta = vrm?.meta || gltf.userData.vrmMeta; // Support both VRM 0.0 and 1.0 (via plugin)

                if (!meta) {
                    console.warn("No VRM meta found");
                    resolve(false);
                    return;
                }

                // Relaxed Validation: Just check if it has valid VRM metadata
                // We no longer enforce "personaxi" in the license or author name.
                // console.log("VRM Metadata found:", meta);
                resolve(true);
            },
            (progress) => {
                // console.log(
                //     "Loading VRM for validation...",
                //     (progress.loaded / progress.total) * 100 + "%",
                // );
            },
            (error) => {
                URL.revokeObjectURL(url);
                console.error("Failed to load VRM for validation:", error);
                resolve(false); // Fail safe
            },
        );
    });
}

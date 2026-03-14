// Dynamic imports — three.js is only loaded when this function is actually called,
// not when the module is imported. This prevents edit3/hub pages from loading
// ~600KB of three.js on initial page load.

export async function validateVRMLicense(file: File): Promise<boolean> {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const { VRMLoaderPlugin } = await import("@pixiv/three-vrm");

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
                resolve(true);
            },
            (progress) => {
                // Loading progress
            },
            (error) => {
                URL.revokeObjectURL(url);
                console.error("Failed to load VRM for validation:", error);
                resolve(false); // Fail safe
            },
        );
    });
}

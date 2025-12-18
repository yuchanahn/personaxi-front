import type { ImageMetadata, Persona } from "$lib/types";
import JSZip from 'jszip';
import { api, API_BASE_URL } from "$lib/api";
import { settings } from "$lib/stores/settings";
import { accessToken } from "$lib/stores/auth";
import { get } from "svelte/store";


export async function getUploadUrl(
    fileType: "vrm" | "portrait" | "asset" | "user_profile",
    oldUrl?: string
): Promise<Response> {
    let url = `/api/upload-url?type=${fileType}`;
    if (oldUrl) {
        url += `&previous_url=${encodeURIComponent(oldUrl)}`;
    }
    const res = await api.get(url);
    if (!res.ok) {
        throw new Error("Failed to get upload URL");
    }
    return res;
}


/**
 * XMLHttpRequest를 사용해 파일과 진행률을 함께 업로드하는 헬퍼 함수
 * @param signedURL - Supabase에서 받은 임시 업로드 URL
 * @param file - 업로드할 파일
 * @param onProgress - 진행률 콜백 함수 (0~100 사이의 숫자)
 * @returns {Promise<void>}
 */
export function uploadFileWithProgress(
    signedURL: string,
    file: File | Blob,
    onProgress: (percent: number) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signedURL);

        // Supabase Signed URL은 Content-Type 헤더가 필요할 수 있음
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        // 타임아웃 설정 (30초)
        xhr.timeout = 30000;

        let hasStarted = false;
        const STALL_TIMEOUT = 5000; // 5초 동안 시작 안하면 실패 처리

        const stallTimer = setTimeout(() => {
            if (!hasStarted) {
                xhr.abort();
                reject(new Error("Upload stalled: No data transferred within 5 seconds"));
            }
        }, STALL_TIMEOUT);

        // 업로드 진행률 이벤트 리스너
        xhr.upload.onprogress = (event) => {
            hasStarted = true;
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                onProgress(percentComplete);
            }
        };

        xhr.onload = () => {
            clearTimeout(stallTimer);
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress(100); // 완료 시 100% 보장
                resolve();
            } else {
                reject(new Error(`File upload failed: ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => {
            clearTimeout(stallTimer);
            reject(new Error('File upload failed due to a network error.'));
        };

        xhr.ontimeout = () => {
            clearTimeout(stallTimer);
            reject(new Error('File upload timed out (30s limit).'));
        };

        xhr.send(file);
    });
}


export async function savePersona(persona: Persona): Promise<string> {
    const response = await api.post(`/api/persona/edit`, persona);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save persona");
    }
    const data = await response.json();
    return data.ID;
}


export async function loadPersona(id: string): Promise<Persona> {
    const response = await api.get2(`/api/persona?id=${id}&locale=${get(settings).language}`);
    if (!response.ok) {
        throw new Error("Failed to load persona");
    }
    return (await response.json()) as Persona;
}

export async function loadPersonaOriginal(id: string): Promise<Persona> {
    const response = await api.get(`/api/persona/owner?id=${id}`);
    if (!response.ok) {
        throw new Error("Failed to load persona");
    }
    return (await response.json()) as Persona;
}


/**
 * Upload Live2D ZIP file via direct client-side upload
 * 1. Extract ZIP in browser
 * 2. Request Signed URLs from backend
 * 3. Upload files directly to CDN
 */
export async function uploadLive2DZip(
    file: File,
    onProgress: (percent: number) => void,
    oldUrl?: string
): Promise<{ model3_json_url: string; expressions: string[]; motions: string[] }> {
    // 1. Load ZIP
    const zip = await JSZip.loadAsync(file);
    const filesToUpload: { name: string; originalName: string; data: Blob }[] = [];
    let totalSize = 0;
    let model3JsonPath = "";
    let originalModel3JsonPath = "";

    // 2. Extract files and filter
    const renames = new Map<string, string>(); // oldPath -> newPath
    const folderMap = new Map<string, string>();
    let folderCounter = 0;

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;

        // Ignore system files
        if (relativePath.includes('__MACOSX') || relativePath.split('/').pop()?.startsWith('.')) continue;

        // Determine extension (preserve compound Live2D extensions)
        const lowerName = relativePath.toLowerCase();
        let ext = lowerName.split('.').pop() || ''; // Default to single extension

        // List of compound extensions to preserve
        const compoundExts = [
            'model3.json', 'json', 'moc3', 'motion3.json', 'exp3.json',
            'physics3.json', 'pose3.json', 'userdata3.json', 'cdi3.json',
            'png', 'jpg', 'jpeg', 'tga', 'atlas'
        ];

        // Check if ends with any specific compound extension
        const matchedCompound = compoundExts.find(e => lowerName.endsWith('.' + e));
        if (matchedCompound) {
            ext = matchedCompound;
        }

        // Filter valid files (using basic extensions for broad check, or specific logic)
        // Check if it matches any of allowed raw extensions
        const allowedTypes = ['json', 'moc3', 'png', 'jpg', 'jpeg', 'tga', 'atlas'];
        const basicExt = lowerName.split('.').pop() || ''; // This is the single-part extension
        if (!allowedTypes.includes(basicExt)) continue;

        let blob = await zipEntry.async('blob');

        // Resize images if needed (Max 2048px for mobile safety)
        if (['png', 'jpg', 'jpeg'].includes(basicExt)) {
            try {
                blob = await resizeImageBlob(blob, 2048);
            } catch (e) {
                console.warn(`Failed to resize ${relativePath}, using original.`, e);
            }
        }

        // [Sanitization] Check for non-ASCII characters in both folders and filename
        const parts = relativePath.split('/');
        const filename = parts.pop() || "";
        const dirParts = parts;

        // Sanitize Directory Parts
        const newDirParts = dirParts.map(part => {
            // eslint-disable-next-line
            if (/[^\x20-\x7E]/.test(part)) {
                if (!folderMap.has(part)) {
                    // Use a short deterministic name for folders
                    folderMap.set(part, `dir_${folderCounter++}`);
                }
                return folderMap.get(part) || part;
            }
            return part;
        });

        // Sanitize Filename
        let newFilename = filename;
        // eslint-disable-next-line
        if (/[^\x20-\x7E]/.test(filename)) {
            const timestamp = Date.now();
            const index = filesToUpload.length;
            newFilename = `${timestamp}_${index}.${ext}`;
        }

        const finalPath = [...newDirParts, newFilename].join('/');

        if (finalPath !== relativePath) {
            console.log(`[Sanitization] Renaming ${relativePath} -> ${finalPath}`);
            renames.set(relativePath, finalPath);
        }

        filesToUpload.push({ name: finalPath, originalName: relativePath, data: blob });
        totalSize += blob.size;

        if (relativePath.endsWith('model3.json')) {
            model3JsonPath = finalPath; // Update to new name if renamed
            originalModel3JsonPath = relativePath;
        }
    }

    if (!model3JsonPath) {
        throw new Error("model3.json not found in ZIP");
    }

    // [Sanitization] Patch model3.json references if renames occurred
    if (renames.size > 0 && originalModel3JsonPath) {
        try {
            const modelEntry = filesToUpload.find(f => f.name === model3JsonPath);
            if (modelEntry) {
                const text = await modelEntry.data.text();
                let newText = text;

                // Determine directories for relative path calculation
                const originalModelDir = originalModel3JsonPath.substring(0, originalModel3JsonPath.lastIndexOf('/') + 1);
                const newModelDir = model3JsonPath.substring(0, model3JsonPath.lastIndexOf('/') + 1);

                for (const [oldPath, newPath] of renames) {
                    // Calculate relative paths
                    // The JSON contains references relative to the model3.json location
                    let relativeOld = oldPath;
                    let relativeNew = newPath;

                    // Strip the directory prefix to find what the JSON likely contains
                    if (originalModelDir && oldPath.startsWith(originalModelDir)) {
                        relativeOld = oldPath.substring(originalModelDir.length);
                    }
                    if (newModelDir && newPath.startsWith(newModelDir)) {
                        relativeNew = newPath.substring(newModelDir.length);
                    }

                    // Replace exact matches in JSON strings
                    // We escape double quotes to match the JSON string value exactly if needed
                    // But usually safer to just replace the path segment
                    if (relativeOld !== relativeNew) {
                        // console.log(`[Sanitization] Patching Ref: "${relativeOld}" -> "${relativeNew}"`);
                        // Using split/join for global replacement
                        newText = newText.split(`"${relativeOld}"`).join(`"${relativeNew}"`);
                    }
                }

                modelEntry.data = new Blob([newText], { type: "application/json" });
                console.log("[Sanitization] Patched model3.json with renamed references.");
            }
        } catch (e) {
            console.warn("[Sanitization] Failed to patch model3.json:", e);
        }
    }

    // [Auto-Fix] Patch model3.json to include all motion files found in ZIP
    try {
        const modelEntry = filesToUpload.find(f => f.name === model3JsonPath);
        if (modelEntry) {
            const text = await modelEntry.data.text();
            const modelJson = JSON.parse(text);
            let modified = false;

            // Ensure FileReferences exists
            if (!modelJson.FileReferences) modelJson.FileReferences = {};
            // Ensure Motions exists
            if (!modelJson.FileReferences.Motions) modelJson.FileReferences.Motions = {};

            const motions = modelJson.FileReferences.Motions;

            // Calculate model directory to strip from motion paths
            const modelDir = model3JsonPath.substring(0, model3JsonPath.lastIndexOf('/') + 1);

            // Scan for all .motion3.json files in the upload list
            filesToUpload.forEach(file => {
                // Check ORIGINAL name for type detection to handle renamed files
                if (file.originalName.endsWith('.motion3.json')) {
                    // Determine Group Name from ORIGINAL filename (Semantic)
                    const originalFileName = file.originalName.split('/').pop() || "";
                    const baseName = originalFileName.replace('.motion3.json', '');

                    // Simple heuristic: split by underscore or numbers to get group
                    let groupName = baseName.split('_')[0];
                    if (!groupName) groupName = baseName;

                    // Capitalize first letter for consistency
                    groupName = groupName.charAt(0).toUpperCase() + groupName.slice(1);

                    // Initialize group array if needed
                    if (!motions[groupName]) {
                        motions[groupName] = [];
                    }

                    // Calculate relative path from model3.json to motion file (using NEW sanitized path)
                    let relativeMotionPath = file.name;
                    if (modelDir && relativeMotionPath.startsWith(modelDir)) {
                        relativeMotionPath = relativeMotionPath.substring(modelDir.length);
                    }

                    // Check if file is already referenced (check both raw and relative)
                    // Note: Existing references might be using old names if we didn't sanitize them in JSON yet?
                    // Actually, we already sanitized JSON in previous step.
                    // So JSON contains NEW paths.
                    const alreadyExists = motions[groupName].some((m: any) =>
                        m.File === relativeMotionPath || m.File === file.name
                    );

                    if (!alreadyExists) {
                        console.log(`[Auto-Fix] Injecting motion: ${relativeMotionPath} into group ${groupName}`);
                        motions[groupName].push({
                            File: relativeMotionPath
                        });
                        modified = true;
                    }
                }
            });

            if (modified) {
                console.log("[Auto-Fix] model3.json patched with new motions:", modelJson);
                const newBlob = new Blob([JSON.stringify(modelJson, null, 2)], { type: "application/json" });
                modelEntry.data = newBlob;
                // Update size for progress calculation
                totalSize -= text.length; // Approximate
                totalSize += newBlob.size;
            }
        }
    } catch (e) {
        console.warn("[Auto-Fix] Failed to patch model3.json (Motions):", e);
    }

    // [Auto-Fix] Patch model3.json for Expressions
    try {
        const modelEntry = filesToUpload.find(f => f.name === model3JsonPath);
        if (modelEntry) {
            const text = await modelEntry.data.text();
            const modelJson = JSON.parse(text);
            let modified = false;

            // Ensure FileReferences exists
            if (!modelJson.FileReferences) modelJson.FileReferences = {};
            // Ensure Expressions exists (Array for Expressions)
            if (!Array.isArray(modelJson.FileReferences.Expressions)) {
                modelJson.FileReferences.Expressions = [];
            }

            const expressions = modelJson.FileReferences.Expressions;
            const modelDir = model3JsonPath.substring(0, model3JsonPath.lastIndexOf('/') + 1);

            filesToUpload.forEach(file => {
                // Check ORIGINAL name
                if (file.originalName.endsWith('.exp3.json')) {
                    // Use ORIGINAL Name for semantic meaning
                    const originalFileName = file.originalName.split('/').pop() || "";
                    const baseName = originalFileName.replace('.exp3.json', '');

                    // Calculate relative path using NEW Name
                    let relativeExpPath = file.name;
                    if (modelDir && relativeExpPath.startsWith(modelDir)) {
                        relativeExpPath = relativeExpPath.substring(modelDir.length);
                    }

                    // Check for duplicates
                    // Existing entries in JSON have "File" (new path) and "Name" (preserved from file content or old JSON)
                    // We check if "File" matches
                    const alreadyExists = expressions.some((e: any) =>
                        e.File === relativeExpPath || e.File === file.name || e.Name === baseName
                    );

                    if (!alreadyExists) {
                        console.log(`[Auto-Fix] Injecting expression: ${relativeExpPath} as ${baseName}`);
                        expressions.push({
                            Name: baseName, // Use semantic original name
                            File: relativeExpPath // Use functional new path
                        });
                        modified = true;
                    }
                }
            });

            if (modified) {
                console.log("[Auto-Fix] model3.json patched with new expressions:", modelJson);
                const newBlob = new Blob([JSON.stringify(modelJson, null, 2)], { type: "application/json" });
                modelEntry.data = newBlob;
                // Note: Size update is approximate as we might have modified it in the motion block too.
                // Ideally we should have one pass, but this is safe enough.
            }
        }
    } catch (e) {
        console.warn("[Auto-Fix] Failed to patch model3.json (Expressions):", e);
    }

    // 3. Get Signed URLs from backend
    const fileNames = filesToUpload.map(f => f.name);
    // Use api.post to handle auth headers automatically
    const response = await api.post(`/api/upload-live2d`, {
        files: fileNames,
        old_live2d_url: oldUrl
    });
    if (!response.ok) throw new Error("Failed to get signed URLs");
    const { base_folder, urls } = await response.json();

    // 4. Upload files directly to CDN (Parallel with Retries)
    const progressMap = new Map<string, number>();
    const updateProgress = () => {
        let loaded = 0;
        for (const val of progressMap.values()) loaded += val;
        if (totalSize > 0) {
            onProgress(Math.min((loaded / totalSize) * 100, 99)); // Cap at 99 until done
        }
    };

    const uploadPromises = filesToUpload.map(async (file) => {
        const signedUrl = urls[file.name];
        if (!signedUrl) throw new Error(`No signed URL for ${file.name}`);

        const MAX_RETRIES = 3;
        let lastError;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                await uploadFileWithProgress(signedUrl, file.data, (percent) => {
                    // Convert percent back to bytes for total progress calculation
                    const bytesLoaded = (percent / 100) * file.data.size;
                    progressMap.set(file.name, bytesLoaded);
                    updateProgress();
                });
                // Success
                progressMap.set(file.name, file.data.size);
                updateProgress();
                return;
            } catch (e) {
                console.warn(`Upload failed for ${file.name} (Attempt ${attempt}/${MAX_RETRIES}):`, e);
                lastError = e;
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
                }
            }
        }
        throw new Error(`Failed to upload ${file.name} after ${MAX_RETRIES} attempts: ${lastError}`);
    });

    await Promise.all(uploadPromises);
    onProgress(100);

    // Construct public URL for model3.json
    // Assuming standard Supabase public URL structure
    const supabaseProjectURL = "https://uohepkqmwbstbmnkoqju.supabase.co/storage/v1/object/public/personaxi-assets";
    // Ensure forward slashes in path
    const cleanModelPath = model3JsonPath.replace(/\\/g, '/');
    const model3JsonUrl = `${supabaseProjectURL}/${base_folder}/${cleanModelPath}`;

    return {
        model3_json_url: model3JsonUrl,
        expressions: Array.from(new Set(filesToUpload
            .filter(f => f.name.endsWith('.exp3.json'))
            .map(f => f.name.split('/').pop()?.replace('.exp3.json', '') || "")
            .filter(n => n)
        )),
        motions: filesToUpload
            .filter(f => f.name.endsWith('.motion3.json'))
            .map(f => f.name)
    };
}


export async function fetchAndSetAssetTypes(
    metadatas: ImageMetadata[],
): Promise<ImageMetadata[]> {
    const promises = metadatas.map(
        async (metadata: ImageMetadata): Promise<ImageMetadata> => {
            try {
                // Skip blob URLs (local previews) to avoid NetworkError
                if (metadata.url.startsWith("blob:")) {
                    return metadata;
                }

                const response = await fetch(metadata.url, {
                    method: "HEAD",
                });

                if (!response.ok) {
                    return { ...metadata, type: "unknown" };
                }

                const contentType = response.headers.get("Content-Type");
                let type: "image" | "video" | "unknown" = "unknown";

                if (contentType?.startsWith("image/")) {
                    type = "image";
                } else if (contentType?.startsWith("video/")) {
                    type = "video";
                }

                return { ...metadata, type: type };
            } catch (error) {
                console.error(
                    "Error fetching metadata for:",
                    metadata.url,
                    error,
                );
                return { ...metadata, type: "unknown" };
            }
        },
    );

    return await Promise.all(promises);
}

/**
 * Resize image blob if it exceeds max dimension
 */
async function resizeImageBlob(blob: Blob, maxDimension: number = 2048): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // Check if resize is needed
            if (img.width <= maxDimension && img.height <= maxDimension) {
                resolve(blob);
                return;
            }

            // Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxDimension) {
                    height = Math.round(height * (maxDimension / width));
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width = Math.round(width * (maxDimension / height));
                    height = maxDimension;
                }
            }

            console.log(`Resizing image from ${img.width}x${img.height} to ${width}x${height}`);

            // Draw to canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Convert back to blob
            canvas.toBlob((newBlob) => {
                if (newBlob) {
                    resolve(newBlob);
                } else {
                    reject(new Error("Failed to create blob from canvas"));
                }
            }, blob.type, 0.9); // 90% quality
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image for resizing"));
        };

        img.src = url;
    });
}
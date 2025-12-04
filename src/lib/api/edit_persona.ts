import type { ImageMetadata, Persona } from "$lib/types";
import JSZip from 'jszip';
import { api, API_BASE_URL } from "$lib/api";
import { settings } from "$lib/stores/settings";
import { accessToken } from "$lib/stores/auth";
import { get } from "svelte/store";


export async function getUploadUrl(fileType: "vrm" | "portrait" | "asset" | "user_profile"): Promise<Response> {
    const res = await api.get(`/api/upload-url?type=${fileType}`);
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
    const response = await api.get2(`/api/persona?id=${id}`);
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
    onProgress: (percent: number) => void
): Promise<{ model3_json_url: string }> {
    // 1. Load ZIP
    const zip = await JSZip.loadAsync(file);
    const filesToUpload: { name: string; data: Blob }[] = [];
    let totalSize = 0;
    let model3JsonPath = "";

    // 2. Extract files and filter
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;

        // Ignore system files
        if (relativePath.includes('__MACOSX') || relativePath.split('/').pop()?.startsWith('.')) continue;

        // Filter extensions
        const ext = relativePath.split('.').pop()?.toLowerCase();
        if (!['json', 'moc3', 'png', 'jpg', 'jpeg'].includes(ext || '')) continue;

        let blob = await zipEntry.async('blob');

        // Resize images if needed (Max 2048px for mobile safety)
        if (['png', 'jpg', 'jpeg'].includes(ext || '')) {
            try {
                blob = await resizeImageBlob(blob, 2048);
            } catch (e) {
                console.warn(`Failed to resize ${relativePath}, using original.`, e);
            }
        }

        filesToUpload.push({ name: relativePath, data: blob });
        totalSize += blob.size;

        if (relativePath.endsWith('model3.json')) {
            model3JsonPath = relativePath;
        }
    }

    if (!model3JsonPath) {
        throw new Error("model3.json not found in ZIP");
    }

    // 3. Get Signed URLs from backend
    const fileNames = filesToUpload.map(f => f.name);
    // Use api.post to handle auth headers automatically
    const response = await api.post(`/api/upload-live2d`, { files: fileNames });
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

    return { model3_json_url: model3JsonUrl };
}


export async function fetchAndSetAssetTypes(
    metadatas: ImageMetadata[],
): Promise<ImageMetadata[]> {
    const promises = metadatas.map(
        async (metadata: ImageMetadata): Promise<ImageMetadata> => {
            try {
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
import type { Persona } from "$lib/types";
import { api } from "$lib/api";


export async function getUploadUrl(fileType: "vrm" | "portrait" | "asset"): Promise<Response> {
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
    file: File,
    onProgress: (percent: number) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signedURL);

        // Supabase Signed URL은 Content-Type 헤더가 필요할 수 있음
        xhr.setRequestHeader('Content-Type', file.type);

        // 업로드 진행률 이벤트 리스너
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                onProgress(percentComplete);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress(100); // 완료 시 100% 보장
                resolve();
            } else {
                reject(new Error(`File upload failed: ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error('File upload failed due to a network error.'));
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
    const response = await api.get(`/api/persona?id=${id}`);
    if (!response.ok) {
        throw new Error("Failed to load persona");
    }
    return (await response.json()) as Persona;
}

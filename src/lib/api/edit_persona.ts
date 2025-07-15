import type { Persona } from "$lib/types";
import { API_BASE_URL } from '$lib/constants';


export async function getUploadUrl(tpye: "vrm" | "portrait" | "asset") {
    const response = await fetch(
        `${API_BASE_URL}/api/upload-url?type=${tpye}`,
        {
            credentials: "include",
        },
    );

    if (!response.ok) {
        throw new Error(`Failed to get signed URL for ${tpye}`);
    }
    return response;
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


export async function savePersona(
    persona: Persona
): Promise<string | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/persona/edit`, {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(persona),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '페르소나 정보 저장 실패');
        }

        const result = await response.json();

        return result.ID;

    } catch (error) {
        console.error("페르소나 저장 중 오류 발생:", error);
        throw error;
    }
}




export async function loadPersona(id: string) {

    if (id) {
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/persona?id=${id}`,
                {
                    credentials: 'include'
                }
            );
            if (res.ok) {
                let persona = await res.json();

                return persona;
            }
        } catch (error) {
            console.error(error);
        }
    }
    return null;
}

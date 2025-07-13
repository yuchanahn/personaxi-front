import type { Persona } from "$lib/types";
import { API_BASE_URL } from '$lib/constants';
import { v4 as uuidv4 } from 'uuid';

/**
 * XMLHttpRequest를 사용해 파일과 진행률을 함께 업로드하는 헬퍼 함수
 * @param signedURL - Supabase에서 받은 임시 업로드 URL
 * @param file - 업로드할 파일
 * @param onProgress - 진행률 콜백 함수 (0~100 사이의 숫자)
 * @returns {Promise<void>}
 */
function uploadFileWithProgress(
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


// savePersona 함수 시그니처에 onProgress 콜백 추가
export async function savePersona(
    persona: Persona,
    vrmFile: File | null,
    portraitFile: File | null,
    onProgress: (progress: number) => void // Svelte에서 받은 콜백 함수
): Promise<string | null> {
    const filesToUpload: { bucket: string; file: File; fileName: string }[] = [];
    if (portraitFile) {
        filesToUpload.push({ bucket: 'portraits', file: portraitFile, fileName: `${persona.id}.portrait` });
    }
    if (vrmFile) {
        filesToUpload.push({ bucket: 'vrm-models', file: vrmFile, fileName: `${persona.id}.vrm` });
    }

    try {
        if (filesToUpload.length > 0) {
            const signedURLRequests = filesToUpload.map(f =>
                fetch(`${API_BASE_URL}/api/upload-url?bucket=${f.bucket}&fileName=${f.fileName}`,
                    {
                        credentials: 'include'
                    }).then(res => {
                        if (!res.ok) throw new Error(`URL 생성 실패: ${f.fileName}`);
                        return res.json();
                    })
            );
            const signedURLResponses = await Promise.all(signedURLRequests);

            // 여러 파일의 전체 진행률 계산
            const progressPerFile = new Array(filesToUpload.length).fill(0);

            const uploadPromises = filesToUpload.map((fileInfo, index) => {
                const signedURL = signedURLResponses[index].signedURL;
                return uploadFileWithProgress(signedURL, fileInfo.file, (percent) => {
                    progressPerFile[index] = percent;
                    // 모든 파일의 평균 진행률을 계산
                    const totalProgress = progressPerFile.reduce((sum, p) => sum + p, 0) / filesToUpload.length;
                    onProgress(totalProgress); // Svelte 컴포넌트로 전체 진행률 전달
                });
            });

            await Promise.all(uploadPromises);
        }

        // 파일 업로드 완료 후, 메타데이터 저장
        onProgress(100); // 파일 업로드 완료되었으니 100%로 설정
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
        return result.id;

    } catch (error) {
        console.error("페르소나 저장 중 오류 발생:", error);
        throw error;
    }
}

export async function savePersona2(persona: Persona, vrmFile: File | null, portrait: File | null) {
    try {

        const formData = new FormData();

        const meta = JSON.stringify(persona);

        if (vrmFile) {
            formData.append("vrm", vrmFile); // VRM 파일 (File 객체)
        }
        if (portrait) {
            formData.append("portrait", portrait); // VRM 파일 (File 객체)
        }
        formData.append("persona", meta); // 메타 정보

        const res = await fetch(`${API_BASE_URL}/api/persona/edit`, {
            method: "POST",
            body: formData,
            credentials: 'include'
        });

        if (res.ok) {
            let id: string = (await res.json() as any).id;
            return id;
        }
    } catch (error) {
        console.error(error);
    }
    return null;
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

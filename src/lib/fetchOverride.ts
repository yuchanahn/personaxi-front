// src/lib/fetchOverride.ts

// 원본 fetch 저장
const originalFetch = window.fetch;

// fetch 오버라이드
window.fetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    const headers = {
        ...init?.headers,
        "ngrok-skip-browser-warning": "true", // ngrok 경고 스킵
    };

    return originalFetch(input, { ...init, headers });
};

// 모듈 임포트 시 오버라이드 적용 (의미 없는 export)
export const initFetchOverride = () => { };
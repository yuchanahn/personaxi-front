import { browser, dev } from '$app/environment';
import { supabase } from '$lib/supabase';
import { get } from 'svelte/store';
import { accessToken } from '$lib/stores/auth';

export const API_BASE_URL = dev ? '' : "https://api.personaxi.com";

// AuthOption extension to RequestInit
interface AuthRequestInit extends RequestInit {
    requireAuth?: boolean;
}

async function fetchWithAuth(url: string, options: AuthRequestInit = {}): Promise<Response> {
    if (!browser) {
        return fetch(url, options);
    }

    options.credentials = 'include';
    const headers = new Headers(options.headers);

    // Supabase에서 현재 세션 가져오기
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    // Default requireAuth to true unless explicitly set to false
    const requireAuth = options.requireAuth !== false;

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    } else if (requireAuth) {
        // 토큰이 없는데 인증이 필수라면 로그인 페이지로 이동
        window.location.href = '/login';
        throw new Error('No session');
    }

    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    options.headers = headers;

    let response = await fetch(url, options);

    if (response.status === 401 && requireAuth) {
        // 401 에러(인증 실패) 시 로그인 페이지로 이동 (필수 인증일 때만)
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }

    if (response.status === 503) {
        // 503 에러(서버 점검/다운) 시 점검 페이지로 이동
        if (window.location.pathname !== '/maintenance') {
            window.location.href = '/maintenance';
        }
        throw new Error('Service Unavailable');
    }

    if (response.status === 403) {
        // 403 Forbidden (Banned)
        if (window.location.pathname !== '/suspended') {
            window.location.href = '/suspended';
        }
        throw new Error('Forbidden');
    }

    return response;
}


export const api = {
    get: (url: string, options?: AuthRequestInit) => fetchWithAuth(API_BASE_URL + url, { ...options, method: 'GET' }),
    // get2 is getOptional (Public or Optional Auth)
    get2: (url: string, options?: AuthRequestInit) => fetchWithAuth(API_BASE_URL + url, { ...options, method: 'GET', requireAuth: false }),

    post: (url: string, data: any, options?: AuthRequestInit) =>
        fetchWithAuth(API_BASE_URL + url, { ...options, method: 'POST', body: JSON.stringify(data) }),

    // post2 is postPublic (No Auth enforced)
    post2: (url: string, data: any, options?: AuthRequestInit) =>
        fetchWithAuth(API_BASE_URL + url, { ...options, method: 'POST', body: JSON.stringify(data), requireAuth: false }),
    delete(url: string, options?: RequestInit) {
        return fetchWithAuth(API_BASE_URL + url, {
            ...options,
            method: "DELETE",
        });
    },

    ws: async (
        path: string, // 예: '/ws' 또는 '/ws/tts'
        handlers: {
            onOpen?: (event: Event) => void;
            onMessage?: (event: MessageEvent) => void;
            onClose?: (event: CloseEvent) => void;
            onError?: (event: Event) => void;
        }
    ): Promise<WebSocket> => {
        if (!browser) {
            // 서버사이드에서는 WebSocket을 생성할 수 없으므로 에러를 던지거나 더미 객체를 반환
            throw new Error("WebSocket can only be created in the browser.");
        }

        // Get Supabase access token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error("No active session. Please login first.");
        }

        const token = session.access_token;

        let wsURL: string;
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

        // Add token as query parameter
        const separator = path.includes('?') ? '&' : '?';
        const pathWithToken = `${path}${separator}token=${encodeURIComponent(token)}`;

        if (dev) {
            // 개발 환경: 프록시를 사용하기 위해 현재 주소를 기반으로 URL 생성
            wsURL = `${wsProtocol}//${window.location.host}${pathWithToken}`;
        } else {
            // 프로덕션 환경: API_BASE_URL에서 호스트(hostname) 부분만 추출하여 wss 주소 생성
            const apiUrl = new URL(API_BASE_URL);
            wsURL = `${wsProtocol}//${apiUrl.host}${pathWithToken}`;
        }

        // console.log("🔗 WebSocket 연결 시도:", wsURL.replace(/token=[^&]+/, 'token=***'));

        const socket = new WebSocket(wsURL);

        if (handlers.onOpen) socket.onopen = handlers.onOpen;
        if (handlers.onMessage) socket.onmessage = handlers.onMessage;
        if (handlers.onClose) socket.onclose = handlers.onClose;
        if (handlers.onError) socket.onerror = handlers.onError;

        return socket;
    },
    isLoggedIn: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return !!session;
    },

};
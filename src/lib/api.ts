import { browser, dev } from '$app/environment';
import { supabase } from '$lib/supabase';
import { get } from 'svelte/store';
import { accessToken } from '$lib/stores/auth';

export const API_BASE_URL = dev ? '' : "https://api.personaxi.com";

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    if (!browser) {
        return fetch(url, options);
    }

    options.credentials = 'include';
    const headers = new Headers(options.headers);

    // Supabase에서 현재 세션 가져오기
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    } else {
        // 토큰이 없으면 로그인 페이지로 이동
        window.location.href = '/login';
        throw new Error('No session');
    }

    if (options.body) {
        headers.set('Content-Type', 'application/json');
    }
    options.headers = headers;

    let response = await fetch(url, options);

    if (response.status === 401) {
        // 401 에러(인증 실패) 시 로그인 페이지로 이동
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }

    return response;
}


export const api = {
    get: (url: string, options?: RequestInit) => fetchWithAuth(API_BASE_URL + url, { ...options, method: 'GET' }),
    get2: (url: string, options?: RequestInit) => fetch(API_BASE_URL + url, { ...options, method: 'GET', credentials: 'include' }),
    post: (url: string, data: any, options?: RequestInit) =>
        fetchWithAuth(API_BASE_URL + url, { ...options, method: 'POST', body: JSON.stringify(data) }),
    post2: (url: string, data: any, options?: RequestInit) =>
        fetch(API_BASE_URL + url, { ...options, method: 'POST', credentials: 'include', body: JSON.stringify(data) }),

    ws: (
        path: string, // 예: '/ws' 또는 '/ws/tts'
        handlers: {
            onOpen?: (event: Event) => void;
            onMessage?: (event: MessageEvent) => void;
            onClose?: (event: CloseEvent) => void;
            onError?: (event: Event) => void;
        }
    ): WebSocket => {
        if (!browser) {
            // 서버사이드에서는 WebSocket을 생성할 수 없으므로 에러를 던지거나 더미 객체를 반환
            throw new Error("WebSocket can only be created in the browser.");
        }

        let wsURL: string;
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

        if (dev) {
            // 개발 환경: 프록시를 사용하기 위해 현재 주소를 기반으로 URL 생성
            wsURL = `${wsProtocol}//${window.location.host}${path}`;
        } else {
            // 프로덕션 환경: API_BASE_URL에서 호스트(hostname) 부분만 추출하여 wss 주소 생성
            const apiUrl = new URL(API_BASE_URL);
            wsURL = `${wsProtocol}//${apiUrl.host}${path}`;
        }

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
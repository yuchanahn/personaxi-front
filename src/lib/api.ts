import { browser, dev } from '$app/environment';
import { accessToken } from '$lib/stores/auth';
import { get } from 'svelte/store';

const API_BASE_URL = dev ? '' : "https://api.personaxi.com";

let refreshTokenPromise: Promise<Response> | null = null;

async function refreshAccessToken() {
    if (!refreshTokenPromise) {
        refreshTokenPromise = fetch(API_BASE_URL + '/api/auth/refresh-token', {
            method: 'POST',
            credentials: 'include'
        });
    }

    const refreshResponse = await refreshTokenPromise;
    refreshTokenPromise = null;

    if (refreshResponse.ok) {
        const { access_token: newAccessToken } = await refreshResponse.clone().json();
        accessToken.set(newAccessToken);
    }
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    if (!browser) {
        return fetch(url, options);
    }

    options.credentials = 'include';
    const headers = new Headers(options.headers);
    const token = get(accessToken);

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    } else {
        await refreshAccessToken();
        const newToken = get(accessToken);
        if (newToken) {
            headers.set('Authorization', `Bearer ${newToken}`);
        } else {
            window.location.href = '/login';
            throw new Error('Session expired');
        }
    }
    if (options.body) {
        headers.set('Content-Type', 'application/json');
    }
    options.headers = headers;

    let response = await fetch(url, options);

    try {
        if (response.status === 401) {
            if (!refreshTokenPromise) {
                refreshTokenPromise = fetch(API_BASE_URL + '/api/auth/refresh-token', {
                    method: 'POST',
                    credentials: 'include'
                });
            }

            const refreshResponse = await refreshTokenPromise;
            refreshTokenPromise = null;
            if (refreshResponse.ok) {
                const { access_token: newAccessToken } = await refreshResponse.clone().json();
                accessToken.set(newAccessToken);

                headers.set('Authorization', `Bearer ${newAccessToken}`);
                options.headers = headers;
                return fetch(url, options);
            } else {
                window.location.href = '/login';
                throw new Error('Session expired');
            }
        }
    } catch (error) {
        console.error(error);
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
};
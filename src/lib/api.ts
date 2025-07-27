import { browser } from '$app/environment';
import { accessToken } from '$lib/stores/auth';
import { get } from 'svelte/store';

let isRefreshing = false;

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    if (!browser) {
        return fetch(url, options);
    }

    const headers = new Headers(options.headers);
    const token = get(accessToken);

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    if (options.body) {
        headers.set('Content-Type', 'application/json');
    }
    options.headers = headers;

    let response = await fetch(url, options);

    if (response.status === 401 && !isRefreshing) {
        isRefreshing = true;
        try {
            const refreshResponse = await fetch('/api/refresh-token', { method: 'POST' });

            if (!refreshResponse.ok) {
                window.location.href = '/login';
                throw new Error('Session expired');
            }

            const { access_token: newAccessToken } = await refreshResponse.json();
            accessToken.set(newAccessToken);

            headers.set('Authorization', `Bearer ${newAccessToken}`);
            options.headers = headers;
            response = await fetch(url, options);
        } finally {
            isRefreshing = false;
        }
    }
    return response;
}

export const api = {
    get: (url: string, options?: RequestInit) => fetchWithAuth(url, { ...options, method: 'GET' }),
    post: (url: string, data: any, options?: RequestInit) =>
        fetchWithAuth(url, { ...options, method: 'POST', body: JSON.stringify(data) }),
};
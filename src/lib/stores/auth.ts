import { writable, derived } from 'svelte/store';
import { api } from '$lib/api';

export const accessToken = writable<string | null>(null);

export const isAuthenticated = derived(
    accessToken,
    ($accessToken) => $accessToken !== null
);

export async function logout() {
    await api.post('/api/logout', {});

    accessToken.set(null);
    window.location.href = '/login';
}
import { writable, derived } from 'svelte/store';

export const accessToken = writable<string | null>(null);

export const isAuthenticated = derived(
    accessToken,
    ($accessToken) => $accessToken !== null
);

export async function logout() {
    await fetch('/api/logout', { method: 'POST' });

    accessToken.set(null);
    window.location.href = '/login';
}
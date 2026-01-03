import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { api } from '$lib/api';

export const accessToken = writable<string | null>(null);

export const isAuthenticated = derived(
    accessToken,
    ($accessToken) => $accessToken !== null
);

export async function logout() {
    await supabase.auth.signOut();
    accessToken.set(null);
    window.location.href = '/login';
}
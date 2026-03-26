import { writable, derived } from 'svelte/store';
import { goto } from '$app/navigation';
import { supabase } from '$lib/supabase';
import { bumpAuthRenderVersion, closeAuthGate } from '$lib/stores/authGate';

export const accessToken = writable<string | null>(null);

export const isAuthenticated = derived(
    accessToken,
    ($accessToken) => $accessToken !== null
);

export async function logout() {
    await supabase.auth.signOut();
    accessToken.set(null);
    closeAuthGate();
    bumpAuthRenderVersion();
    void goto('/hub', { replaceState: true });
}

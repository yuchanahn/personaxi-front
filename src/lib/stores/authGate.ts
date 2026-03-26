import { browser } from "$app/environment";
import { writable, get } from "svelte/store";
import { supabase } from "$lib/supabase";
import { accessToken } from "$lib/stores/auth";

export type AuthRequestSource = "api" | "action" | "page";

export type AuthGateState = {
    isOpen: boolean;
    source: AuthRequestSource;
    returnTo: string;
    reason: string;
    requestedAt: number;
};

const initialAuthGateState: AuthGateState = {
    isOpen: false,
    source: "api",
    returnTo: "/hub",
    reason: "",
    requestedAt: 0,
};

export class AuthRequiredError extends Error {
    constructor(message = "Authentication required") {
        super(message);
        this.name = "AuthRequiredError";
    }
}

export const authGate = writable<AuthGateState>(initialAuthGateState);
export const authRenderVersion = writable(0);

function getCurrentReturnTo() {
    if (!browser) return "/hub";
    const { pathname, search, hash } = window.location;
    return `${pathname}${search}${hash}` || "/hub";
}

export function openAuthGate(options?: {
    source?: AuthRequestSource;
    returnTo?: string;
    reason?: string;
}) {
    if (!browser) return;

    const nextState: AuthGateState = {
        isOpen: true,
        source: options?.source ?? "api",
        returnTo: options?.returnTo || getCurrentReturnTo(),
        reason: options?.reason ?? "",
        requestedAt: Date.now(),
    };

    authGate.update((current) => (current.isOpen ? current : nextState));
}

export function closeAuthGate() {
    authGate.set(initialAuthGateState);
}

export function consumeAuthGateSuccess() {
    const current = get(authGate);
    if (!current.isOpen) return null;

    authGate.set(initialAuthGateState);
    authRenderVersion.update((value) => value + 1);
    return current;
}

export function bumpAuthRenderVersion() {
    authRenderVersion.update((value) => value + 1);
}

export async function hasActiveSession() {
    const storedToken = get(accessToken);
    if (storedToken) {
        return true;
    }

    if (!browser) {
        return false;
    }

    try {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        const nextToken = session?.access_token ?? null;
        if (nextToken) {
            accessToken.set(nextToken);
        }
        return !!nextToken;
    } catch (error) {
        console.error("Failed to resolve session for auth gate", error);
        return false;
    }
}

export async function requireAuth(options?: {
    source?: AuthRequestSource;
    returnTo?: string;
    reason?: string;
}) {
    if (await hasActiveSession()) {
        return true;
    }

    openAuthGate(options);
    return false;
}

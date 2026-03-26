import { goto } from "$app/navigation";
import { requireAuth } from "$lib/stores/authGate";

export async function ensureAuthenticated(options?: {
    returnTo?: string;
    reason?: string;
}) {
    return requireAuth({
        source: "action",
        returnTo: options?.returnTo,
        reason: options?.reason,
    });
}

export async function gotoWithAuth(
    target: string,
    options?: {
        reason?: string;
    },
) {
    const isAuthenticated = await requireAuth({
        source: "action",
        returnTo: target,
        reason: options?.reason,
    });

    if (!isAuthenticated) {
        return false;
    }

    await goto(target);
    return true;
}

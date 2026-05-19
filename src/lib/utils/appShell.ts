import { browser } from "$app/environment";

type CapacitorLike = {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
};

type NavigatorWithStandalone = Navigator & {
    standalone?: boolean;
};

export type AppShellKind = "web" | "pwa" | "native";

function getCapacitorGlobal(): CapacitorLike | null {
    if (!browser) return null;

    const win = window as Window & {
        Capacitor?: CapacitorLike;
    };

    return win.Capacitor ?? null;
}

export function isNativeApp() {
    const capacitor = getCapacitorGlobal();
    if (!capacitor?.isNativePlatform) {
        return false;
    }

    try {
        if (!capacitor.isNativePlatform()) {
            return false;
        }

        return capacitor.getPlatform?.() !== "web";
    } catch {
        return false;
    }
}

export function isStandalonePwa() {
    if (!browser) return false;

    return (
        window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
        (navigator as NavigatorWithStandalone).standalone === true
    );
}

export function getAppShellKind(): AppShellKind {
    if (isNativeApp()) {
        return "native";
    }

    if (isStandalonePwa()) {
        return "pwa";
    }

    return "web";
}

export function isInstalledAppShell() {
    return getAppShellKind() !== "web";
}

export function isLocalWebHost(hostname?: string) {
    if (!browser || isNativeApp()) {
        return false;
    }

    const resolvedHostname = (hostname ?? window.location.hostname).toLowerCase();
    return (
        resolvedHostname === "localhost" ||
        resolvedHostname === "127.0.0.1" ||
        resolvedHostname === "::1" ||
        resolvedHostname === "0.0.0.0" ||
        resolvedHostname === "10.0.2.2"
    );
}

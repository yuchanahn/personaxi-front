import { browser } from "$app/environment";
import { isNativeApp } from "$lib/utils/appShell";

type WindowWithDataLayer = Window & {
    dataLayer?: Array<Record<string, unknown>>;
    requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
};

function isLocalHost(hostname: string) {
    return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "10.0.2.2"
    );
}

export function scheduleGoogleTagManager(containerId: string) {
    if (!browser || !containerId || isNativeApp()) {
        return () => {};
    }

    const win = window as WindowWithDataLayer;
    if (isLocalHost(window.location.hostname)) {
        return () => {};
    }

    const scriptId = `gtm-script-${containerId}`;
    if (document.getElementById(scriptId)) {
        return () => {};
    }

    let cancelled = false;
    let timeoutHandle: number | null = null;
    let idleHandle: number | null = null;

    const loadGtm = () => {
        if (cancelled || document.getElementById(scriptId)) {
            return;
        }

        win.dataLayer = win.dataLayer ?? [];
        win.dataLayer.push({
            "gtm.start": Date.now(),
            event: "gtm.js",
        });

        const script = document.createElement("script");
        script.id = scriptId;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
        document.head.appendChild(script);
    };

    const queueLoad = () => {
        if (cancelled) return;

        if (typeof win.requestIdleCallback === "function") {
            idleHandle = win.requestIdleCallback(loadGtm, { timeout: 3000 });
            return;
        }

        timeoutHandle = window.setTimeout(loadGtm, 1500);
    };

    if (document.readyState === "complete") {
        queueLoad();
    } else {
        window.addEventListener("load", queueLoad, { once: true });
    }

    return () => {
        cancelled = true;

        if (timeoutHandle !== null) {
            window.clearTimeout(timeoutHandle);
        }

        if (idleHandle !== null && typeof win.cancelIdleCallback === "function") {
            win.cancelIdleCallback(idleHandle);
        }
    };
}

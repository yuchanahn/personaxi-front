import { api } from "$lib/api";
import { getCurrentUser } from "$lib/api/auth";
import { st_user } from "$lib/stores/user";
import { toast } from "$lib/stores/toast";
import { toastError } from "$lib/utils/errorMapper";
import type { User } from "$lib/types";
import { t } from "svelte-i18n";
import { get } from "svelte/store";
import { getBranding } from "$lib/branding/config";
import { Capacitor } from "@capacitor/core";

export interface VerificationOptions {
    onSuccess?: () => void;
    onError?: (error: any) => void;
}

interface InicisStartResponse {
    actionUrl: string;
    method: string;
    fields: Record<string, string>;
    bridgeUrl?: string;
}

const ANDROID_APP_SCHEME = "com.personaxi.app";
const NATIVE_VERIFICATION_RETURN_URL = `${ANDROID_APP_SCHEME}://identity-verification`;

function isNativeAndroid(): boolean {
    return (
        typeof window !== "undefined" &&
        Capacitor.isNativePlatform() &&
        Capacitor.getPlatform() === "android"
    );
}

async function importCapacitorBrowser() {
    return await import("@capacitor/browser");
}

async function importCapacitorApp() {
    return await import("@capacitor/app");
}

function openVerificationPopup(): Window | null {
    const width = 420;
    const height = 720;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

    return window.open(
        "",
        "personaxi_inicis_verification",
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`,
    );
}

function submitVerificationForm(
    popup: Window,
    payload: InicisStartResponse,
): void {
    const doc = popup.document;
    doc.open();
    doc.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${getBranding("ko").legalServiceName} Verification</title></head><body></body></html>`);
    doc.close();

    const form = doc.createElement("form");
    form.method = payload.method || "POST";
    form.action = payload.actionUrl;

    for (const [name, value] of Object.entries(payload.fields || {})) {
        const input = doc.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
    }

    doc.body.appendChild(form);
    form.submit();
}

async function readVerificationStartError(response: Response): Promise<string> {
    const retryAfter = response.headers.get("Retry-After");
    let rawText = "";

    try {
        rawText = await response.text();
    } catch {
        rawText = "";
    }

    let serverMessage = rawText.trim();
    if (serverMessage.startsWith("{")) {
        try {
            const parsed = JSON.parse(serverMessage) as { error?: string; message?: string };
            serverMessage = parsed.error || parsed.message || serverMessage;
        } catch {
            // Keep raw text.
        }
    }

    if (response.status === 429) {
        const seconds = Number(retryAfter || "0");
        if (Number.isFinite(seconds) && seconds > 0) {
            return `본인인증 요청이 너무 잦습니다. ${Math.ceil(seconds)}초 후 다시 시도해주세요.`;
        }
        return "본인인증 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.";
    }

    if (response.status === 401) {
        return "로그인 후 본인인증을 다시 시도해주세요.";
    }

    return serverMessage || "본인인증 시작 중 오류가 발생했습니다.";
}

export async function requestIdentityVerification(options?: VerificationOptions) {
    if (typeof window === "undefined") return;

    if (isNativeAndroid()) {
        await requestNativeIdentityVerification(options);
        return;
    }

    const popup = openVerificationPopup();
    if (!popup) {
        toastError("verificationError");
        options?.onError?.(new Error("Popup blocked"));
        return;
    }

    let closed = false;
    const cleanup = () => {
        if (closed) return;
        closed = true;
        window.removeEventListener("message", handleMessage);
        if (!popup.closed) {
            popup.close();
        }
    };

    const handleMessage = async (event: MessageEvent) => {
        if (!event.data || event.data.type !== "personaXi.inicisIdentityVerification") {
            return;
        }

        cleanup();

        if (event.data.status === "success") {
            toast.success(get(t)("errors.verificationSuccess"));
            const userRes = await getCurrentUser();
            if (userRes) {
                st_user.set(userRes as User);
            }
            options?.onSuccess?.();
            return;
        }

        if (event.data.status === "failed") {
            toastError(event.data.message || "verificationFailed");
            options?.onError?.(new Error(event.data.message || "Verification failed"));
            return;
        }

        toastError(event.data.message || "verificationError");
        options?.onError?.(new Error(event.data.message || "Verification error"));
    };

    window.addEventListener("message", handleMessage);

    try {
        popup.document.write(
            `<!doctype html><html lang="ko"><body style="font-family:sans-serif;padding:24px;">${get(t)("errors.verificationPreparing")}</body></html>`,
        );
        popup.document.close();

        const response = await api.post("/api/identity-verifications/inicis/start", {});
        if (!response.ok) {
            cleanup();
            const errorMessage = await readVerificationStartError(response);
            console.error("Inicis verification start failed:", response.status, errorMessage);
            toast.error(errorMessage);
            options?.onError?.(new Error(errorMessage || `HTTP ${response.status}`));
            return;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            const rawText = await response.text();
            cleanup();
            console.error("Inicis verification start returned non-JSON:", rawText);
            toastError("verificationError");
            options?.onError?.(
                new Error(
                    rawText || "Verification start endpoint returned non-JSON response",
                ),
            );
            return;
        }

        const payload = (await response.json()) as InicisStartResponse;
        submitVerificationForm(popup, payload);
    } catch (error) {
        cleanup();
        console.error("Inicis verification start failed:", error);
        toastError("verificationError");
        options?.onError?.(error);
    }
}

async function requestNativeIdentityVerification(options?: VerificationOptions) {
    let completed = false;
    let cleanup: (() => void) | null = null;

    const finish = async (status: string, message: string) => {
        if (completed) return;
        completed = true;
        cleanup?.();

        if (Capacitor.isPluginAvailable("Browser")) {
            try {
                const { Browser } = await importCapacitorBrowser();
                await Browser.close();
            } catch {
                // Android Browser.close is a no-op in Capacitor; appUrlOpen still brings the app forward.
            }
        }

        if (status === "success") {
            toast.success(get(t)("errors.verificationSuccess"));
            const userRes = await getCurrentUser();
            if (userRes) {
                st_user.set(userRes as User);
            }
            options?.onSuccess?.();
            return;
        }

        if (status === "failed") {
            toastError(message || "verificationFailed");
            options?.onError?.(new Error(message || "Verification failed"));
            return;
        }

        toastError(message || "verificationError");
        options?.onError?.(new Error(message || "Verification error"));
    };

    try {
        const { App } = await importCapacitorApp();
        const listener = await App.addListener("appUrlOpen", (event) => {
            try {
                const url = new URL(event.url);
                if (
                    url.protocol !== `${ANDROID_APP_SCHEME}:` ||
                    url.host !== "identity-verification"
                ) {
                    return;
                }

                void finish(
                    url.searchParams.get("status") || "error",
                    url.searchParams.get("message") || "",
                );
            } catch (error) {
                console.warn("Failed to parse identity verification callback URL.", error);
            }
        });

        const timeout = window.setTimeout(() => {
            if (completed) return;
            cleanup?.();
        }, 15 * 60 * 1000);

        cleanup = () => {
            window.clearTimeout(timeout);
            void listener.remove();
            cleanup = null;
        };

        const response = await api.post("/api/identity-verifications/inicis/start", {
            returnUrl: NATIVE_VERIFICATION_RETURN_URL,
        });
        if (!response.ok) {
            cleanup();
            const errorMessage = await readVerificationStartError(response);
            console.error("Inicis native verification start failed:", response.status, errorMessage);
            toast.error(errorMessage);
            options?.onError?.(new Error(errorMessage || `HTTP ${response.status}`));
            return;
        }

        const payload = (await response.json()) as InicisStartResponse;
        if (!payload.bridgeUrl) {
            cleanup();
            toastError("verificationError");
            options?.onError?.(new Error("Verification bridge URL was not returned."));
            return;
        }

        if (!Capacitor.isPluginAvailable("Browser")) {
            cleanup();
            window.location.assign(payload.bridgeUrl);
            return;
        }

        const { Browser } = await importCapacitorBrowser();
        await Browser.open({
            url: payload.bridgeUrl,
            toolbarColor: "#111827",
        });
    } catch (error) {
        cleanup?.();
        console.error("Inicis native verification failed:", error);
        toastError("verificationError");
        options?.onError?.(error);
    }
}

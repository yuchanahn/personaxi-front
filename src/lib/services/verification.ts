import { api } from "$lib/api";
import { getCurrentUser } from "$lib/api/auth";
import { st_user } from "$lib/stores/user";
import { toast } from "$lib/stores/toast";
import { toastError } from "$lib/utils/errorMapper";
import type { User } from "$lib/types";
import { t } from "svelte-i18n";
import { get } from "svelte/store";
import { branding } from "$lib/branding/config";

export interface VerificationOptions {
    onSuccess?: () => void;
    onError?: (error: any) => void;
}

interface InicisStartResponse {
    actionUrl: string;
    method: string;
    fields: Record<string, string>;
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
    doc.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${branding.legalServiceName} Verification</title></head><body></body></html>`);
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

export async function requestIdentityVerification(options?: VerificationOptions) {
    if (typeof window === "undefined") return;

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
            const errorText = await response.text();
            console.error("Inicis verification start failed:", response.status, errorText);
            toastError("verificationError");
            options?.onError?.(new Error(errorText || `HTTP ${response.status}`));
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

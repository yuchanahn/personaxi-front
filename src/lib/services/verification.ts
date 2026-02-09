import { api } from "$lib/api";
import { getCurrentUser } from "$lib/api/auth";
import { st_user } from "$lib/stores/user";
import { toast } from "$lib/stores/toast";
import type { User } from "$lib/types";

export interface VerificationOptions {
    onSuccess?: () => void;
    onError?: (error: any) => void;
}

export async function requestIdentityVerification(options?: VerificationOptions) {
    // @ts-ignore
    if (typeof window === "undefined") return;

    // Ensure PortOne SDK is loaded
    // @ts-ignore
    if (!window.PortOne) {
        toast.error("인증 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
        return;
    }

    try {
        // @ts-ignore
        const response = await window.PortOne.requestIdentityVerification({
            storeId: "store-04392323-c1ba-4c80-9812-ae8577171bb0", // Same as payment storeId
            identityVerificationId: `identity-verification-${crypto.randomUUID()}`,
            channelKey: "channel-key-b5e31a4c-6742-49b8-a62c-e4ec792113b2", // KG Inicis Channel Key
        });

        if (response.code != null) {
            console.error("Verification Error:", response);
            toast.error(response.message || "본인인증 실패");
            options?.onError?.(response);
            return;
        }

        // Success callback to backend
        const verifyRes = await api.post("/api/identity-verifications", {
            identityVerificationId: response.identityVerificationId,
        });

        if (verifyRes.ok) {
            toast.success("본인인증이 완료되었습니다!");
            // Refresh user data
            const userRes = await getCurrentUser();
            if (userRes) {
                const updatedUser = userRes as User;
                st_user.set(updatedUser);
            }
            options?.onSuccess?.();
        } else {
            toast.error("인증 정보 저장에 실패했습니다.");
            options?.onError?.(new Error("Failed to save verification data"));
        }
    } catch (e) {
        console.error("Verification Exception:", e);
        toast.error("본인인증 중 오류가 발생했습니다.");
        options?.onError?.(e);
    }
}

import { api } from "$lib/api";

export async function followUser(targetId: string): Promise<boolean> {
    const res = await api.post("/api/user/follow", { targetId });
    return res.ok;
}

export async function unfollowUser(targetId: string): Promise<boolean> {
    const res = await api.post("/api/user/unfollow", { targetId });
    return res.ok;
}

export async function checkFollowStatus(targetId: string): Promise<boolean> {
    const res = await api.get(`/api/user/is-following?targetId=${targetId}`);
    if (res.ok) {
        const data = await res.json();
        return data.isFollowing;
    }
    return false;
}

export async function getFollowers(userId: string): Promise<string[]> {
    const res = await api.get2(`/api/user/followers?userId=${userId}`);
    if (res.ok) {
        return await res.json();
    }
    return [];
}

export async function getFollowing(userId: string): Promise<string[]> {
    const res = await api.get2(`/api/user/following?userId=${userId}`);
    if (res.ok) {
        return await res.json();
    }
    return [];
}

export async function deleteUser(): Promise<boolean> {
    const res = await api.delete("/api/user/delete");
    return res.ok;
}

export async function updateSafetyFilter(
    safetyFilterOn: boolean,
): Promise<{ success: boolean; safetyFilterOn: boolean; isVerified: boolean }> {
    const res = await api.post("/api/user/safety-filter", { safetyFilterOn });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to update safety filter");
    }
    return await res.json();
}

export async function updateBirthDate(
    birthDate: string,
): Promise<{ success: boolean; birthDate: string; isAdult: boolean; safetyFilterOn: boolean }> {
    const res = await api.post("/api/user/birth-date", { birthDate });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to update birth date");
    }
    return await res.json();
}

import type { PaymentRecord } from "$lib/types";

export async function getPaymentHistory(
    limit = 10,
    offset = 0,
): Promise<PaymentRecord[]> {
    const res = await api.get(`/api/user/payments?limit=${limit}&offset=${offset}`);
    if (res.ok) {
        return await res.json();
    }
    return [];
}

export type CreditTransaction = {
    id: number;
    user_ssid: string;
    amount: number;
    reason: string;
    created_at: string;
};

export async function getCreditHistory(
    limit = 10,
    offset = 0,
): Promise<CreditTransaction[]> {
    const res = await api.get(
        `/api/user/credits/history?limit=${limit}&offset=${offset}`,
    );
    if (res.ok) {
        return await res.json();
    }
    return [];
}

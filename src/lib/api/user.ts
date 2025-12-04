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

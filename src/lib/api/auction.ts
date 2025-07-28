import { api } from "$lib/api";

export async function fetchAuctionStatus(personaId: string) {
    const res = await api.get(`/api/auction/status?c=${personaId}`);

    if (!res.ok) throw new Error("Failed to load auction status");

    return await res.json();
}

export async function placeBid(personaId: string, amount: number) {
    const res = await api.post(`/api/auction/bid?c=${personaId}`, { amount });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to bid: ${text}`);
    }

    return res;
}

export async function createAuction(personaId: string, startBid: number, duration: number) {
    const res = await api.post(`/api/auction/create`, {
        personaId,
        startBid,
        duration,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to create auction: ${text}`);
    }

    return await res.json();
}

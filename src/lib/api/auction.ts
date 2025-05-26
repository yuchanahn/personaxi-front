import { API_BASE_URL } from "$lib/constants";

export async function fetchAuctionStatus(personaId: string) {
    const res = await fetch(`${API_BASE_URL}/api/auction/status?c=${personaId}`, {
        credentials: "include",
    });

    if (!res.ok) throw new Error("Failed to load auction status");

    return await res.json();
}

export async function placeBid(personaId: string, amount: number) {
    const res = await fetch(`${API_BASE_URL}/api/auction/bid?c=${personaId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ amount }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to bid: ${text}`);
    }

    return await res.json();
}

export async function createAuction(personaId: string, startBid: number, duration: number) {
    const res = await fetch(`${API_BASE_URL}/api/auction/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
            personaId,
            startBid,
            duration,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to create auction: ${text}`);
    }

    return await res.json();
}

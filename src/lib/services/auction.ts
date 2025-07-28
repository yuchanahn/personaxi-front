import { api } from "$lib/api";

/*
var resp []struct {
        PersonaID     string `json:"personaId"`
        StartBid      int64  `json:"startBid"`
        CurrentBid    int64  `json:"currentBid"`
        EndAt         string `json:"endAt"`
        CurrentWinner string `json:"currentWinner"`
    }

 */

export type AuctionPersona = {
    personaId: string;
    startBid: number;
    currentBid: number;
    endAt: string; // ISO 8601 형식
    currentWinner: string | null; // 현재 낙찰자, 없으면 null
};


export async function fetchAuctionPersonas(): Promise<AuctionPersona[]> {
    const res = await api.get2(`/api/auction/list`);

    if (!res.ok) {
        throw new Error("auction.fetchListFailed");
    }

    const json = await res.json();
    if (!Array.isArray(json)) {
        return [];
    }

    return json as AuctionPersona[];
}
import { API_BASE_URL } from '$lib/constants';


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
    const res = await fetch(`${API_BASE_URL}/api/auction/list`, { credentials: "include" });

    if (!res.ok) {
        throw new Error("경매 리스트 불러오기 실패");
    }

    const json = await res.json();
    if (!Array.isArray(json)) {
        return [];
    }

    return json as AuctionPersona[];
}
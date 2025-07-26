const BASE = "/api/live";
import { API_BASE_URL } from '$lib/constants';


export async function fetchLivePersonas(): Promise<string[]> {
    const res = await fetch(`${API_BASE_URL}${BASE}/list`, { credentials: "include" });

    if (!res.ok) {
        throw new Error("live.fetchListFailed");
    }

    const json = await res.json();
    if (!Array.isArray(json)) {
        throw new Error("live.responseNotArray");
    }

    return json as string[];
}


// 방송 상태 설정 (시작 or 중단)
export async function setLiveStatus(personaId: string, isLive: boolean): Promise<void> {
    const res = await fetch(`${API_BASE_URL}${BASE}/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ personaId, isLive })
    });
    if (!res.ok) throw new Error("live.setStatusFailed");
}


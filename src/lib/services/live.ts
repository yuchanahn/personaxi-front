const BASE = "/api/live";
import { api } from "$lib/api";

export async function fetchLivePersonas(): Promise<string[]> {
    const res = await api.get(`${BASE}/list`);

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
    const res = await api.post(`${BASE}/set`, { personaId, isLive });
    if (!res.ok) throw new Error("live.setStatusFailed");
}


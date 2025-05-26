const BASE = "/api/live";

export async function fetchLivePersonas(): Promise<string[]> {
    const res = await fetch(`http://localhost:8080${BASE}/list`, { credentials: "include" });

    if (!res.ok) {
        throw new Error("라이브 리스트 불러오기 실패");
    }

    const json = await res.json();
    if (!Array.isArray(json)) {
        throw new Error("응답이 배열이 아님");
    }

    return json as string[];
}


// 방송 상태 설정 (시작 or 중단)
export async function setLiveStatus(personaId: string, isLive: boolean): Promise<void> {
    const res = await fetch(`http://localhost:8080${BASE}/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ personaId, isLive })
    });
    if (!res.ok) throw new Error("방송 상태 변경 실패");
}

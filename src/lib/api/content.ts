import { api } from "$lib/api";
import type { Persona } from '$lib/types';


export async function loadContent() {
    const res = await api.get2(`/api/contents`);
    if (res.ok) {
        const data = await res.json();
        return data;
    }
    return [];
}

export async function loadlikesdata() {
    if (!api.isLoggedIn()) {
        return [];
    }

    const res = await api.get(`/api/contents/likesdata`);
    if (res.ok) {
        const data = await res.json();
        return data;
    }
    return [];
}

export async function LikeBtn(persona: Persona, onOk: () => void, onError: (message: string) => void) {
    const url = `/api/persona/like?id=${persona.id}`;

    try {
        const res = await api.get(url);

        if (res.ok) {
            onOk()
        } else {
            const errorData = await res.json();
            onError(errorData.error)
        }
    } catch (error) {
        console.error("Network or other error:", error);
        alert("An unexpected error occurred. Please try again.");
    }
}


export async function loadContentWithTags(tags: string[]) {
    const res = await api.get2(`/api/contents/t?t=${tags.join(",")}`);
    if (res.ok) {
        const data = await res.json();
        return data;
    }
    return [];
}



export async function loadContentWithName(name: string) {
    const res = await api.get2(`/api/contents/s?q=${name}`);
    if (res.ok) {
        const data = await res.json();
        return data;
    }
    return [];
}
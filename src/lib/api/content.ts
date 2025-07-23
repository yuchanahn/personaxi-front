import { API_BASE_URL } from '$lib/constants';
import type { Persona } from '$lib/types';


export async function loadContent() {
    const res = await fetch(`${API_BASE_URL}/api/contents`, {
        credentials: 'include'
    });
    if (res.ok) {
        const data = await res.json();
        return data;
    }
    return [];
}

export async function loadlikesdata() {
    const res = await fetch(`${API_BASE_URL}/api/contents/likesdata`, {
        credentials: 'include'
    });
    if (res.ok) {
        const data = await res.json();
        return data;
    }
    return [];
}

export async function LikeBtn(persona: Persona, onOk: () => void, onError: (message: string) => void) {
    const url = `${API_BASE_URL}/api/persona/like?id=${persona.id}`;

    try {
        const res = await fetch(url, {
            credentials: "include",
        });

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
    const res = await fetch(`${API_BASE_URL}/api/contents/t?t=${tags.join(",")}`, {
        credentials: 'include'
    });
    if (res.ok) {
        const data = await res.json();
        return data;
    }
    return [];
}



export async function loadContentWithName(name: string) {
    const res = await fetch(`${API_BASE_URL}/api/contents/s?q=${name}`, {
        credentials: 'include'
    });
    if (res.ok) {
        const data = await res.json();
        return data;
    }
    return [];
}
import { api } from "$lib/api";
import { allCategories } from "$lib/constants";
import { settings } from "$lib/stores/settings";
import type { Persona } from '$lib/types';
import { get } from "svelte/store";


export async function loadContent() {
    const res = await api.get2(`/api/contents?locale=${get(settings).language}`);
    if (res.ok) {
        const data = await res.json();
        return data;
    }
    return [];
}

export async function loadlikesdata() {
    if (!(await api.isLoggedIn())) {
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
    // tags가 숫자가 아닌 경우, allCategories에서 매핑하여 숫자 ID로 변환
    const numericTags = tags.map(tag => {
        const category = allCategories.find(cat => cat.nameKey === tag);
        return category ? category.id.toString() : tag; // 매핑된 ID가 없으면 원래 태그 사용
    });

    const res = await api.get2(`/api/contents/t?t=${numericTags.join(",")}&locale=${get(settings).language}`);
    if (res.ok) {
        const data = await res.json();
        return data;
    }
    return [];
}

export async function loadContentWithName(name: string) {
    const res = await api.get2(`/api/contents/s?q=${name}&locale=${get(settings).language}`);
    if (res.ok) {
        const data = await res.json();
        return data;
    }
    return [];
}
import { api } from "$lib/api";
import { allCategories } from "$lib/constants";
import { settings } from "$lib/stores/settings";
import type { Persona } from '$lib/types';
import { get } from "svelte/store";


export async function loadContent(page: number, limit: number, sort: string = 'latest', contentType: string = 'character', tags: string[] = [], excludedTags: string[] = []) {
    const offset = (page - 1) * limit;

    // Convert tags to query string if present
    let tagsQuery = '';
    if (tags.length > 0) {
        // Map tags to IDs if needed, similar to loadContentWithTags?
        // Actually the backend parses strings. But logic in loadContentWithTags mapped nameKey to ID.
        // Let's copy that mapping logic if we want to be safe, or assume backend handles strings.
        // User's previous code in loadContentWithTags did mapping.
        const mappedTags = tags.map(tag => {
            const category = allCategories.find(cat => cat.nameKey === tag);
            return category ? category.id.toString() : tag;
        });
        tagsQuery = `&t=${mappedTags.join(",")}`;
    }

    if (excludedTags.length > 0) {
        const mappedExcludedTags = excludedTags.map(tag => {
            const category = allCategories.find(cat => cat.nameKey === tag);
            return category ? category.id.toString() : tag;
        });
        tagsQuery += `&exclude=${mappedExcludedTags.join(",")}`;
    }

    const res = await api.get2(`/api/contents?offset=${offset}&limit=${limit}&sort=${sort}&type=${contentType}&locale=${get(settings).language}${tagsQuery}`);
    if (res.ok) {
        const data = await res.json();
        if (data === null) {
            return [];
        }
        return data;
    }
    return [];
}

export async function loadContentPaged(limit: number, offset: number) {
    const res = await api.get2(`/api/contents?locale=${get(settings).language}&limit=${limit}&offset=${offset}`);
    if (res.ok) {
        const data = await res.json();
        if (data === null) {
            return [];
        }
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
        if (data === null) {
            return [];
        }
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
        onError("An unexpected error occurred. Please try again.");
    }
}

export async function loadContentWithTags(tags: string[], page: number, limit: number, sort: string = 'latest', contentType: string = 'character', excludedTags: string[] = []) {

    // tags가 숫자가 아닌 경우, allCategories에서 매핑하여 숫자 ID로 변환
    const numericTags = tags.map(tag => {
        const category = allCategories.find(cat => cat.nameKey === tag);
        return category ? category.id.toString() : tag; // 매핑된 ID가 없으면 원래 태그 사용
    });

    const numericExcludedTags = excludedTags.map(tag => {
        const category = allCategories.find(cat => cat.nameKey === tag);
        return category ? category.id.toString() : tag;
    });

    const offset = (page - 1) * limit;
    let url = `/api/contents/t?t=${numericTags.join(",")}&offset=${offset}&limit=${limit}&sort=${sort}&type=${contentType}&locale=${get(settings).language}`;

    if (numericExcludedTags.length > 0) {
        url += `&exclude=${numericExcludedTags.join(",")}`;
    }

    const res = await api.get2(url);
    if (res.ok) {
        const data = await res.json();
        if (data === null) {
            return [];
        }
        return data;
    }
    return [];
}

export async function loadContentWithName(name: string) {
    const res = await api.get2(`/api/contents/s?q=${name}&locale=${get(settings).language}`);
    if (res.ok) {
        const data = await res.json();
        if (data === null) {
            return [];
        }
        return data;
    }
    return [];
}

export async function loadFollowedContent() {
    const res = await api.get(`/api/contents/followed?locale=${get(settings).language}`);
    if (res.ok) {
        const data = await res.json();
        if (data === null) {
            return [];
        }
        return data;
    }
    return [];
}

export async function loadLikedContent() {
    if (!(await api.isLoggedIn())) {
        return [];
    }

    const res = await api.get(`/api/contents/liked?locale=${get(settings).language}`);
    if (res.ok) {
        const data = await res.json();
        if (data === null) {
            return [];
        }
        return data;
    }
    return [];
}
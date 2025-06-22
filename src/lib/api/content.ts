import { API_BASE_URL } from '$lib/constants';


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
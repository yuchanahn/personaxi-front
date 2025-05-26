import { goto } from "$app/navigation";
import { onMount } from "svelte";
import type { Persona } from "$lib/types";
import { page } from "$app/stores";
import { API_BASE_URL } from '$lib/constants';

export async function savePersona(persona: Persona, vrmFile: File | null, portrait: File | null) {
    try {
        const formData = new FormData();
        formData.append("persona", JSON.stringify(persona)); // 메타 정보
        if (vrmFile) {
            formData.append("vrm", vrmFile); // VRM 파일 (File 객체)
        }
        if (portrait) {
            formData.append("portrait", portrait); // VRM 파일 (File 객체)
        }

        const res = await fetch(`${API_BASE_URL}/api/persona/edit`, {
            method: "POST",
            body: formData,
            credentials: 'include'
        });

        if (res.ok) {
            let id: string = (await res.json() as any).id;
            return id;
        }
    } catch (error) {
        console.error(error);
    }
    return null;
}


export async function loadPersona(id: string) {

    if (id) {
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/persona?id=${id}`,
                {
                    credentials: 'include'
                }
            );
            if (res.ok) {
                let persona = await res.json();

                return persona;
            }
        } catch (error) {
            console.error(error);
        }
    }
    return null;
}

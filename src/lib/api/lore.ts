import { api } from '$lib/api';

export interface Lore {
    id: string;
    owner_id: string;
    name: string;
    description: string;
    visibility: string;
    cc_uid?: string;
    version: number;
    created_at: string;
    updated_at: string;
}

export interface LoreEntry {
    id: string;
    lore_id: string;
    keywords: string[];
    content: string;
    priority: number;
    order: number;
    enabled: boolean;
    recursion: boolean;
    created_at: string;
    updated_at: string;
}

export const loreApi = {
    // Lore CRUD
    createLore: async (data: Partial<Lore>) => {
        const res = await api.post('/api/lore', data);
        if (!res.ok) throw new Error('Failed to create lore');
        return res;
    },

    getMyLores: async (): Promise<Lore[]> => {
        const res = await api.get('/api/lore');
        if (!res.ok) throw new Error('Failed to fetch lores');
        return await res.json();
    },

    getLore: async (id: string): Promise<{ lore: Lore, entries: LoreEntry[] }> => {
        const res = await api.get(`/api/lore?id=${id}`);
        if (!res.ok) throw new Error('Failed to fetch lore');
        return await res.json();
    },

    updateLore: async (id: string, data: Partial<Lore>) => {
        const res = await api.put(`/api/lore?id=${id}`, data);
        if (!res.ok) throw new Error('Failed to update lore');
        return res;
    },

    deleteLore: async (id: string) => {
        const res = await api.delete(`/api/lore?id=${id}`);
        if (!res.ok) throw new Error('Failed to delete lore');
        return res;
    },

    // Entry CRUD
    upsertEntry: async (entry: Partial<LoreEntry>) => {
        if (entry.id) {
            const res = await api.put('/api/lore/entry', entry);
            if (!res.ok) throw new Error('Failed to update entry');
            return res;
        } else {
            const res = await api.post('/api/lore/entry', entry);
            if (!res.ok) throw new Error('Failed to create entry');
            return res;
        }
    },

    deleteEntry: async (id: string, loreId: string) => {
        const res = await api.delete(`/api/lore/entry?id=${id}&lore_id=${loreId}`);
        if (!res.ok) throw new Error('Failed to delete entry');
        return res;
    },

    // Linking
    getPersonaLores: async (personaId: string): Promise<Lore[]> => {
        const res = await api.get(`/api/lore/persona/list?persona_id=${personaId}`);
        if (!res.ok) throw new Error('Failed to fetch persona lores');
        return await res.json();
    },

    linkPersona: async (personaId: string, loreId: string, unlink: boolean = false) => {
        const res = await api.post('/api/lore/link', { persona_id: personaId, lore_id: loreId, unlink });
        if (!res.ok) throw new Error('Failed to update linkage');
        return res;
    },

    // Debug
    async testContext(personaId: string, message: string, activeLoreIds?: string[]): Promise<any[]> {
        const res = await api.post('/api/lore/test', { persona_id: personaId, message, active_lore_ids: activeLoreIds });
        if (!res.ok) throw new Error("Failed to test context");
        return res.json();
    },
};

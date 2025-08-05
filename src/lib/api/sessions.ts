import { chatSessions, ChatSessionType, createNewSession, updateSession } from '$lib/stores/chatSessions';
import { get } from 'svelte/store';
import { api } from '$lib/api';
import { t } from 'svelte-i18n';

export async function loadChatSessions() {
    return;
    chatSessions.set([]);
    createNewSession("S4", "", ChatSessionType.SPACE);

    const res = await api.get(`/api/chat/sessions`);
    if (res.ok) {
        const data = await res.json();
        for (const chatSession of data) {
            if (!get(chatSessions).find(s => s.id == chatSession.id)) {
                createNewSession(chatSession.id, chatSession.name, chatSession.type ?? ChatSessionType.CHAT);
            }
        }
    }
}

export async function loadCharacterSessions() {
    const res = await api.get(`/api/chat/char/sessions`);
    if (res.ok) {
        const data = await res.json();
        if (data === null) {
            return;
        }
        for (const chatSession of data) {
            if (!get(chatSessions).find(s => s.id == chatSession.id)) {
                createNewSession(chatSession.id, chatSession.name, chatSession.type);
            }
            if (get(chatSessions).find(s => s.id == chatSession.id)) {
                updateSession(chatSession.id, {
                    id: chatSession.id,
                    name: chatSession.name,
                    createdAt: chatSession.createdAt,
                    type: chatSession.type
                });
            }
        }
    }
}
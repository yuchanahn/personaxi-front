import { chatSessions, ChatSessionType, createNewSession, updateSession } from '$lib/stores/chatSessions';
import { get } from 'svelte/store';
import { API_BASE_URL } from '$lib/constants';
import { t } from 'svelte-i18n';

export async function loadChatSessions() {

    chatSessions.set([]);
    createNewSession("S4", "", ChatSessionType.SPACE);

    const res = await fetch(`${API_BASE_URL}/api/chat/sessions`, {
        credentials: 'include'
    });
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
    const res = await fetch(`${API_BASE_URL}/api/chat/char/sessions`, {
        credentials: 'include'
    });
    if (res.ok) {
        const data = await res.json();
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
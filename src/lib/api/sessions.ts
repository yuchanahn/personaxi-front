import { chatSessions, createNewSession, updateSession } from '$lib/stores/chatSessions';
import { get } from 'svelte/store';
import { api } from '$lib/api';

export async function loadCharacterSessions() {
    const res = await api.get(`/api/chat/char/sessions`);
    if (res.ok) {
        const data = await res.json();
        if (data === null) {
            chatSessions.set([]);
            return;
        }
        chatSessions.set([]);
        for (const chatSession of data) {
            if (!get(chatSessions).find(s => s.id == chatSession.id)) {
                createNewSession(chatSession.id, chatSession.name, chatSession.type, chatSession.llmType);
            }
            if (get(chatSessions).find(s => s.id == chatSession.id)) {
                updateSession(chatSession.id, {
                    id: chatSession.id,
                    name: chatSession.name,
                    createdAt: chatSession.createdAt,
                    type: chatSession.type,
                    llmType: chatSession.llmType,
                    avatar: chatSession.avatar,
                    lastMessage: chatSession.lastMessage,
                    lastMessageAt: chatSession.lastMessageAt
                });
            }
        }
    }
}
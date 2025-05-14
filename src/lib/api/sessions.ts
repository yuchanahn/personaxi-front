import { chatSessions, createNewSession } from '$lib/stores/chatSessions';
import { get } from 'svelte/store';

export async function loadChatSessions() {
    createNewSession("2", "탐색 하기");
    createNewSession("1", "새 대화");
    const res = await fetch('http://localhost:8080/api/chat/sessions', {
        credentials: 'include'
    });
    if (res.ok) {
        const data = await res.json();
        for (const chatSession of data) {
            if (!get(chatSessions).find(s => s.id == chatSession.id)) {
                createNewSession(chatSession.id, chatSession.name);
            }
        }
    }
}

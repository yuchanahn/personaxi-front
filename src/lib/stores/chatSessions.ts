// src/lib/stores/chatSessions.ts
import { writable } from 'svelte/store';

export const chatSessions = writable<{
	id: string;
	name: string;
	createdAt: string;
}[]>([]);

export const currentSessionId = writable<string | null>(null);

export const createNewSession = (id: string, name: string) => {
    const newSession = {
        id: id,
        name: name,
        createdAt: new Date().toISOString() // 추가!
    };
    chatSessions.update((sessions) => {
        // Check if the session with the same ID already exists
        const sessionExists = sessions.some(session => session.id === newSession.id);
        if (sessionExists) {
            // If it exists, return the current sessions without adding the new one
            return sessions;
        }
        // If it doesn't exist, add the new session
        return [...sessions, newSession];
    }
    );
};
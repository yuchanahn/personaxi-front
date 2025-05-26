import { get, writable } from 'svelte/store';

export enum ChatSessionType {
    CHAT = 'text',
    CHARACTER = '2D',
    CHARACTER3D = '3D',
    SYSTEM = 'system',
    SPACE = 'space',
}

export type ChatSession = {
    id: string;
    name: string;
    createdAt: string;
    type: ChatSessionType;
};

export const chatSessions = writable<ChatSession[]>([]);

export const createNewSession = (id: string, name: string, type: ChatSessionType) => {
    const newSession: ChatSession = {
        id: id,
        name: name,
        createdAt: new Date().toISOString(),
        type: type
    } as ChatSession;

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

export const updateSession = (id: string, session: ChatSession) => {
    chatSessions.update((sessions) => {
        const sessionIndex = sessions.findIndex((session) => session.id === id);
        if (sessionIndex !== -1) {
            // Update the session at the found index
            sessions[sessionIndex] = { ...sessions[sessionIndex], ...session };
        }
        return sessions;
    });
};

export const getSessionById = (id: string) => {
    let session: ChatSession | undefined;
    chatSessions.subscribe((sessions) => {
        session = sessions.find((s) => s.id === id);
    })();
    return session;
}
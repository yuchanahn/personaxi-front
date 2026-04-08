import { browser } from '$app/environment';
import { get, writable, derived } from 'svelte/store';

export enum ChatSessionType {
    CHAT = 'text',
    CHARACTER = '2D',
    CHARACTER3D = '3D',
    SYSTEM = 'system',
    SPACE = 'space',
    LIVE2D = '2.5D',
}

export type ChatSession = {
    id: string;
    name: string;
    createdAt: string;
    type: ChatSessionType;
    avatar?: string;
    lastMessage?: string;
    lastMessageAt?: string;
    userNote?: string;
    llmType?: string;
    outputTokenMultiplier?: number;
    userPersonaId?: string;
    dialogueRenderStyle?: DialogueRenderStyle;
    ended?: boolean;
    endingId?: string;
    endingTitle?: string;
    endingMode?: string;
};

export type DialogueRenderStyle = 'bubble' | 'inline-yellow';

type ChatSessionUIPreferences = Record<
    string,
    {
        dialogueRenderStyle?: DialogueRenderStyle;
    }
>;

const CHAT_SESSION_UI_PREFS_KEY = 'chat-session-ui-preferences';
const DEFAULT_DIALOGUE_RENDER_STYLE: DialogueRenderStyle = 'bubble';

function isValidDialogueRenderStyle(value: unknown): value is DialogueRenderStyle {
    return value === 'bubble' || value === 'inline-yellow';
}

function loadChatSessionUIPreferences(): ChatSessionUIPreferences {
    if (!browser) {
        return {};
    }

    const raw = window.localStorage.getItem(CHAT_SESSION_UI_PREFS_KEY);
    if (!raw) {
        return {};
    }

    try {
        const parsed = JSON.parse(raw) as ChatSessionUIPreferences;
        if (!parsed || typeof parsed !== 'object') {
            return {};
        }
        return parsed;
    } catch (error) {
        console.error('Failed to parse chat session UI preferences', error);
        return {};
    }
}

let cachedChatSessionUIPreferences: ChatSessionUIPreferences | null = null;

function getChatSessionUIPreferences(): ChatSessionUIPreferences {
    if (cachedChatSessionUIPreferences) {
        return cachedChatSessionUIPreferences;
    }

    cachedChatSessionUIPreferences = loadChatSessionUIPreferences();
    return cachedChatSessionUIPreferences;
}

function persistChatSessionUIPreferences(next: ChatSessionUIPreferences) {
    cachedChatSessionUIPreferences = next;
    if (!browser) {
        return;
    }
    window.localStorage.setItem(CHAT_SESSION_UI_PREFS_KEY, JSON.stringify(next));
}

function applyUIPreferences(session: ChatSession): ChatSession {
    const prefs = getChatSessionUIPreferences()[session.id];
    const preferredStyle = prefs?.dialogueRenderStyle;

    return {
        ...session,
        dialogueRenderStyle: isValidDialogueRenderStyle(preferredStyle)
            ? preferredStyle
            : session.dialogueRenderStyle || DEFAULT_DIALOGUE_RENDER_STYLE,
    };
}

function clearUIPreferences(id: string) {
    const prefs = { ...getChatSessionUIPreferences() };
    if (!(id in prefs)) {
        return;
    }
    delete prefs[id];
    persistChatSessionUIPreferences(prefs);
}

export function getDefaultDialogueRenderStyle(): DialogueRenderStyle {
    return DEFAULT_DIALOGUE_RENDER_STYLE;
}

export function setSessionDialogueRenderStyle(id: string, style: DialogueRenderStyle) {
    const normalizedStyle = isValidDialogueRenderStyle(style)
        ? style
        : DEFAULT_DIALOGUE_RENDER_STYLE;
    const prefs = {
        ...getChatSessionUIPreferences(),
        [id]: {
            ...getChatSessionUIPreferences()[id],
            dialogueRenderStyle: normalizedStyle,
        },
    };

    persistChatSessionUIPreferences(prefs);

    chatSessions.update((sessions) =>
        sessions.map((session) =>
            session.id === id
                ? { ...session, dialogueRenderStyle: normalizedStyle }
                : session,
        ),
    );
}

export const chatSessions = writable<ChatSession[]>([]);

export const sortedChatSessions = derived(chatSessions, ($sessions) => {
    return [...$sessions].sort((a, b) => {
        const timeA = new Date(a.lastMessageAt || a.createdAt).getTime();
        const timeB = new Date(b.lastMessageAt || b.createdAt).getTime();
        return timeB - timeA; // Descending order (newest first)
    });
});

export const createNewSession = (
    id: string,
    name: string,
    type: ChatSessionType,
    llmType: string,
    outputTokenMultiplier: number = 1,
) => {
    const newSession: ChatSession = applyUIPreferences({
        id: id,
        name: name,
        createdAt: new Date().toISOString(),
        type: type,
        llmType: llmType || 'Error',
        outputTokenMultiplier,
    } as ChatSession);

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
            sessions[sessionIndex] = applyUIPreferences({
                ...sessions[sessionIndex],
                ...session,
            });
        }
        return sessions;
    });
};

export const removeSession = (id: string) => {
    clearUIPreferences(id);
    chatSessions.update((sessions) => sessions.filter((session) => session.id !== id));
};

export const getSessionById = (id: string) => {
    let session: ChatSession | undefined;
    chatSessions.subscribe((sessions) => {
        session = sessions.find((s) => s.id === id);
    })();
    return session;
}

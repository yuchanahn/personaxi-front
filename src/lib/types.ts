export interface PersonaFeedback {
    like: number;
    dislike: number;
    view: number;
}

export interface Persona {
    id: string;
    owner_id: string[];
    name: string;
    personaType: string; // 3D, 2D, text
    instructions: string[];
    promptExamples: string[];
    tags: string[];
    feedback: PersonaFeedback;
    voice_id: string;
}

export interface User {
    id: string;
    name: string;
    credits: number;
    gender: string;
    plan: string;
    profile: string;
    email: string;
    state: string;
    data: {
        nickname: string;
        language: string;
        lastLoginAt: string;
        createdAt: string;
        hasReceivedFirstCreationReward: boolean;
        lastLoginIP: string;
    };
}
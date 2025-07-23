export interface PersonaFeedback {
    view: number;
}

export interface ImageMetadata {
    url: string;
    description: string;
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
    vrm_url: string; // Add this
    portrait_url: string; // Add this
    image_metadatas: ImageMetadata[];
    visibility: string; // e.g., "public", "private"
    created_at: string;
    updated_at: string;
    creator_name: string;
    first_scene: string;
    greeting: string;
    likes_count: number;
    dislikes_count: number;
    is_liked?: boolean; // Optional, as it's only present when fetched with user context
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
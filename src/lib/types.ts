export interface PersonaFeedback {
    view: number;
}

export interface ImageMetadata {
    url: string;
    description: string;
    type?: 'image' | 'video' | 'unknown'; // 타입을 저장할 속성
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
    live2d_url?: string; // Add this
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
    chat_count: number;
}

export interface PersonaDTO {
    id: string;
    name: string;
    portrait_url: string;
    creator_name: string;
    likes_count: number;
    dislikes_count: number;
    chat_count: number;
    personaType: string;
    image_metadatas: ImageMetadata[];
    owner_id: string[];
    tags: string[];
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

export interface CreatorInfoDTO {
    name: string;
    portrait_url: string;
}

export interface CreatorProfileDTO {
    creator: CreatorInfoDTO;
    personas: PersonaDTO[];
}

export interface Comment {
    id: string;                  // 댓글의 고유 ID
    persona_id: string;          // 댓글이 달린 페르소나의 ID
    content: string;             // 댓글 내용
    parent_comment_id?: string;  // 대댓글의 경우, 부모 댓글 ID (옵셔널)
    created_at: string;          // 생성 시간 (ISO 8601 형식의 문자열)

    // users 테이블과 JOIN해서 가져오는 작성자 정보
    author_id: string;           // 작성자의 고유 ID (SSID)
    author_name: string;         // 작성자 이름
    author_avatar_url: string;   // 작성자 프로필 사진 URL
}

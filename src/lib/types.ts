export interface PersonaFeedback {
    view: number;
}

export interface ImageMetadata {
    url: string;
    static_url?: string;
    description: string;
    type?: 'image' | 'video' | 'unknown'; // 타입을 저장할 속성
    is_secret?: boolean;
}

export interface PersonaVariable {
    name: string;
    var_type: 'text' | 'number' | 'enum' | 'boolean';
    default_value: string;
    description?: string;
    min_value?: string;
    max_value?: string;
}

export interface Persona {
    id: string;
    owner_id: string[];
    name: string;
    personaType: string; // 3D, 2D, text
    contentType?: 'character' | 'story' | ''; // Default: character
    instructions: string[];
    promptExamples: string[];
    tags: string[];
    feedback: PersonaFeedback;
    voice_id: string;
    vrm_url: string; // Add this
    live2d_model_url?: string; // Live2D model3.json URL
    portrait_url: string; // Add this
    static_portrait_url?: string; // Extracted frame for video portraits
    image_metadatas: ImageMetadata[];
    image_count: number;
    visibility: string; // e.g., "public", "private"
    created_at: string;
    updated_at: string;
    creator_name: string;
    one_liner?: string;
    first_scene: string;
    greeting: string;
    likes_count: number;
    dislikes_count: number;
    is_liked?: boolean; // Optional, as it's only present when fetched with user context
    chat_count: number;
    start_voice_url?: string;

    // Variable System
    variables?: PersonaVariable[];
    status_template?: string;
    status_template_css?: string;
}

export interface ESFPrompt {
    body_desc: string;
    anim_list: string[];
    core_desire: string;
    contradiction: string;
    last_atmosphere: string;
    current_emotion: string;
    last_prompt_tokens: number;
    recent_turns: string[];
    affection_score: number;
}

export interface PersonaDTO {
    id: string;
    name: string;
    one_liner?: string;
    portrait_url: string;
    static_portrait_url?: string;
    creator_name: string;
    likes_count: number;
    dislikes_count: number;
    chat_count: number;
    personaType: string;
    contentType?: 'character' | 'story' | ''; // Default: character
    image_metadatas: ImageMetadata[];
    image_count: number;
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
    creator_points?: number;
    data: {
        nickname: string;
        language: string;
        lastLoginAt: string;
        createdAt: string;
        hasReceivedFirstCreationReward: boolean;
        lastLoginIP: string;

        // Identity Verification
        isVerified?: boolean;
        birthDate?: string;
        gender?: string;
        ci?: string;
        di?: string;
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

export type NotificationType = 'comment' | 'like' | 'follow' | 'auction_bid' | 'auction_win' | 'system';

export interface Notification {
    id: string;
    userId: string;
    actorId?: string;
    type: NotificationType;
    resourceId?: string;
    resourceType?: string;
    title?: string; // For announcements
    content: string;
    isRead: boolean;
    createdAt: string;

    // Optional joined fields (if backend provides them)
    actorName?: string;
    actorAvatarUrl?: string;
}

export interface UserDevice {
    id: string;
    userId: string;
    fcmToken: string;
    deviceType: string;
    lastActiveAt: string;
}

export interface PaymentRecord {
    id: string; // Order ID
    amount: number;
    currency: string;
    item_name: string;
    status: 'paid' | 'pending' | 'refunded' | 'failed' | 'refund_requested' | 'completed';
    created_at: string;
    payment_method?: string;
    variant_id?: string;
}

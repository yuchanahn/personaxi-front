/*

type PersonaFeedback struct {
    Like    int64 `json:"like"`
    Dislike int64 `json:"dislike"`
    View    int64 `json:"view"`
}


*/


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
}
export interface Persona {
    id: string;
    owner_id: string[];
    name: string;
    personaType: string; // 3D, 2D, text
    instructions: string[];
    promptExamples: string[];
    tags: string[];
}
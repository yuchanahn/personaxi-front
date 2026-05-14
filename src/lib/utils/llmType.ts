export type VisibleLLMType =
    | "gemini-flash-lite"
    | "gemini-flash"
    | "gemini-pro";

export const DEFAULT_2D_LLM_TYPE: VisibleLLMType = "gemini-pro";
export const DEFAULT_AVATAR_LLM_TYPE: VisibleLLMType = "gemini-flash-lite";

export function normalizeVisibleLLMType(
    value?: string | null,
    fallback: VisibleLLMType = DEFAULT_2D_LLM_TYPE,
): VisibleLLMType {
    switch ((value || "").trim()) {
        case "antigravity":
        case "gemini-pro":
            return "gemini-pro";
        case "gemini-flash-lite":
            return "gemini-flash-lite";
        case "gemini-flash":
            return "gemini-flash";
        default:
            return fallback;
    }
}

export function getDefaultLLMTypeForPersonaType(
    personaType?: string | null,
): VisibleLLMType {
    switch ((personaType || "").trim().toLowerCase()) {
        case "3d":
        case "2.5d":
        case "live2d":
            return DEFAULT_AVATAR_LLM_TYPE;
        default:
            return DEFAULT_2D_LLM_TYPE;
    }
}

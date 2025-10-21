// src/lib/constants.ts
const host = window.location.hostname;

export const API_BASE_URL = "https://api.personaxi.com"
export const PORTRAIT_URL = "https://uohepkqmwbstbmnkoqju.supabase.co/storage/v1/object/public/personaxi-assets/portraits/"
export const VRM_URL = "https://uohepkqmwbstbmnkoqju.supabase.co/storage/v1/object/public/personaxi-assets/vrm-models/"
export const ASSET_URL = "https://uohepkqmwbstbmnkoqju.supabase.co/storage/v1/object/public/personaxi-assets/persona_images/"
//https://uohepkqmwbstbmnkoqju.supabase.co/storage/v1/object/public/vrm-models/
/*host === "localhost" || host === "127.0.0.1"
    ? "http://localhost:8080"
    : "https://api.personaxi.com";
//: "https://7a87-175-115-55-94.ngrok-free.app";*/


// --- 새 카테고리 목록 (예시) ---
export const allCategories = [
    { id: 1, nameKey: "tags.romance" },
    { id: 2, nameKey: "tags.fantasy" },
    { id: 3, nameKey: "tags.scifi" },
    { id: 4, nameKey: "tags.horror" },
    { id: 5, nameKey: "tags.sliceOfLife" },
    { id: 6, nameKey: "tags.action" },
    { id: 7, nameKey: "tags.comedy" },
    { id: 8, nameKey: "tags.drama" },
];
// ------------------------------
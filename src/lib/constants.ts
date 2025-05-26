// src/lib/constants.ts
const host = window.location.hostname;

export const API_BASE_URL =
    host === "localhost" || host === "127.0.0.1"
        ? "http://localhost:8080"
        : "https://955b-175-115-55-94.ngrok-free.app";
export const ssr = false
export const csr = true
export const prerender = false

// src/routes/+layout.ts
import { initFetchOverride } from "$lib/fetchOverride";

// 단순히 임포트만 하면 fetch 오버라이드가 적용됨
initFetchOverride();
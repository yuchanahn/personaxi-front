// src/lib/stores/ttsStore.ts (예시)
import { writable } from 'svelte/store';

export type TTSState = 'connecting' | 'connected' | 'disconnected';

export const ttsState = writable<TTSState>('disconnected');

// WebSocket 연결 로직에서 이 store를 업데이트
// ws.onopen = () => ttsState.set('connected');
// ws.onclose = () => ttsState.set('disconnected');
// ws.onerror = () => ttsState.set('disconnected');
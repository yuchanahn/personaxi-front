import { writable } from 'svelte/store';

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export const messages = writable<Message[]>([]);
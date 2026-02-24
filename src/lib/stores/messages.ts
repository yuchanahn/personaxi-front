import { writable } from 'svelte/store';

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  done?: boolean;
};

export const messages = writable<Message[]>([]);
import { writable } from 'svelte/store';

export const messages = writable<{
  role: 'user' | 'assistant' | 'system';
  content: string;
}[]>([
  { role: 'assistant', content: '질문을 입력하세요.' }
]);
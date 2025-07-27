import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// localStorage에서 저장된 값을 가져오거나, 없으면 'system'을 기본값으로 사용
const initialValue = 'dark';

// 'theme'라는 이름으로 스토어를 만들고 초기값을 설정
export const theme = writable<'light' | 'dark' | 'system'>(initialValue);

// 스토어 값이 바뀔 때마다 localStorage에도 저장하여 선택을 기억함

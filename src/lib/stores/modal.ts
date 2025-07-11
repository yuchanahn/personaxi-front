import { writable } from 'svelte/store';

// NeedMoreNeuronsModal의 열림/닫힘 상태를 관리하는 전역 스토어
export const needMoreNeuronsModal = writable<boolean>(false);

// 모달을 외부에서 쉽게 열기 위한 헬퍼 함수
export function showNeedMoreNeuronsModal() {
    needMoreNeuronsModal.set(true);
}

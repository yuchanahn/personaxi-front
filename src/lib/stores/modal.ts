import { writable } from 'svelte/store';

// NeedMoreNeuronsModal의 열림/닫힘 상태 및 모드를 관리하는 전역 스토어
export const needMoreNeuronsModal = writable<{
    isOpen: boolean;
    isNeedNeurons: boolean;
}>({
    isOpen: false,
    isNeedNeurons: false,
});

// 모달을 외부에서 쉽게 열기 위한 헬퍼 함수
export function showNeedMoreNeuronsModal(isNeedNeurons = true) {
    needMoreNeuronsModal.set({
        isOpen: true,
        isNeedNeurons,
    });
}

export function closeNeedMoreNeuronsModal() {
    needMoreNeuronsModal.update((s) => ({ ...s, isOpen: false }));
}

import { writable } from "svelte/store";
import { toast } from "$lib/stores/toast";
import { isNativeApp } from "$lib/utils/appShell";

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
    if (isNativeApp()) {
        toast.info("Android 앱 결제 플로우는 별도 모달로 분기 예정입니다.");
        return;
    }

    needMoreNeuronsModal.set({
        isOpen: true,
        isNeedNeurons,
    });
}

export function closeNeedMoreNeuronsModal() {
    needMoreNeuronsModal.update((s) => ({ ...s, isOpen: false }));
}

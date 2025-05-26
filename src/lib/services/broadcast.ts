// 감정 + 행동 패킷 처리 → 캐릭터에 반영

import type { Model } from "$lib/vrm/core/model"; // 너의 VRM 모델 타입
//import { performVrmReaction } from "$lib/vrm/actions"; // 네가 정의한 VRM 적용 함수

export type BroadcastMessage = {
    user: string;
    msg: string;
    time?: number; // 선택: timestamp
};

let model: Model | null = null;

export function setBroadcastModel(m: Model) {
    model = m;
}

export function handleBroadcastReaction(packet: {
    emotion: string;
    action: string;
    text: string;
}) {
    if (!model) {
        console.warn("VRM 모델이 로드되지 않음");
        return;
    }

    //performVrmReaction(model, {
    //    emotion: packet.emotion,
    //    action: packet.action,
    //    text: packet.text
    //});
}

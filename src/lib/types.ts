export interface Persona {
    id: string;
    owner_id: string;
    name: string;
    personaType: string; // 3D, 2D, text
    style: string;
    intro: string;
    tone: string;
    instructions: string[];
    promptExamples: string[];

    // 추가된 대응 필드
    personalitySummary: string;      // {{성격_요약}} 캐릭터 성격 요약
    emotionExpressionRules: string;  // {{감정_표현_블록}} 감정 표현 규칙
    memoryPolicy: string;            // {{기억_정책}} 기억 및 감정 시스템 정책
    outputConstraints: string;       // {{출력_제한}} 출력 제한 규칙 (형식, 길이 등)
    additionalRules: string;         // {{추가_규칙}} 기타 시스템적 지시 사항
}
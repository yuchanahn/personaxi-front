type EmotionType =
    | "ELATED"
    | "GENTLE"
    | "STERN"
    | "DEPRESSED"
    | "TENSE"
    | "ASTONISHED"
    | "CALM";

type EmotionInfo = {
    cat: string;
    type: EmotionType;
};

const EMOTION_MAP: Record<string, EmotionInfo> = {
    joy: { cat: "joy", type: "GENTLE" },
    happy: { cat: "joy", type: "GENTLE" },
    love: { cat: "joy", type: "GENTLE" },
    gratitude: { cat: "joy", type: "GENTLE" },
    relief: { cat: "joy", type: "GENTLE" },
    pride: { cat: "joy", type: "GENTLE" },
    amusement: { cat: "amuse", type: "ELATED" },
    excitement: { cat: "amuse", type: "ELATED" },
    fun: { cat: "amuse", type: "ELATED" },
    curiosity: { cat: "amuse", type: "ELATED" },
    anger: { cat: "anger", type: "STERN" },
    annoyance: { cat: "anger", type: "STERN" },
    disapproval: { cat: "anger", type: "STERN" },
    disgust: { cat: "anger", type: "STERN" },
    sadness: { cat: "sorrow", type: "DEPRESSED" },
    grief: { cat: "sorrow", type: "DEPRESSED" },
    disappointment: { cat: "sorrow", type: "DEPRESSED" },
    remorse: { cat: "sorrow", type: "DEPRESSED" },
    fear: { cat: "unease", type: "TENSE" },
    nervousness: { cat: "unease", type: "TENSE" },
    embarrassment: { cat: "unease", type: "TENSE" },
    surprise: { cat: "surprise", type: "ASTONISHED" },
    realization: { cat: "surprise", type: "ASTONISHED" },
    confusion: { cat: "surprise", type: "ASTONISHED" },
    neutral: { cat: "neutral", type: "CALM" },
    approval: { cat: "neutral", type: "CALM" },
    caring: { cat: "neutral", type: "CALM" },
};

type CreateExpressionControlOptions = {
    getCurrentModel: () => any | null;
    getAutonomy: () => any | null;
    getExpressionMap: () => Record<string, string>;
    onSetCurrentEmotion: (emotion: string) => void;
    onSetCurrentExpression: (expression: string) => void;
    lockMs?: number;
};

export function createLive2DExpressionControl({
    getCurrentModel,
    getAutonomy,
    getExpressionMap,
    onSetCurrentEmotion,
    onSetCurrentExpression,
    lockMs = 2000,
}: CreateExpressionControlOptions) {
    let expressionLockUntil = 0;
    let pendingEmotion: string | null = null;
    let lockTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearPendingLock = () => {
        if (lockTimeout) {
            clearTimeout(lockTimeout);
            lockTimeout = null;
        }
        pendingEmotion = null;
    };

    const applyExpressionNow = (emotion: string): void => {
        const model = getCurrentModel();
        if (!model) return;

        onSetCurrentEmotion(emotion);

        const mapped = EMOTION_MAP[emotion.toLowerCase()];
        if (!mapped) return;

        const expressionMap = getExpressionMap();
        let targetExpression = "";

        getAutonomy()?.setEmotion(mapped.type);
        if (expressionMap[mapped.type]) {
            targetExpression = expressionMap[mapped.type];
        } else if (expressionMap[mapped.cat]) {
            targetExpression = expressionMap[mapped.cat];
        }

        if (!targetExpression) return;

        model.expression(targetExpression);
        onSetCurrentExpression(targetExpression);
    };

    const setExpression = (emotion: string) => {
        if (!getCurrentModel()) return;

        if (Date.now() < expressionLockUntil) {
            pendingEmotion = emotion;
            if (!lockTimeout) {
                const wait = Math.max(0, expressionLockUntil - Date.now());
                lockTimeout = setTimeout(() => {
                    lockTimeout = null;
                    if (!pendingEmotion) return;
                    const next = pendingEmotion;
                    pendingEmotion = null;
                    setExpression(next);
                }, wait);
            }
            return;
        }

        applyExpressionNow(emotion);
    };

    const triggerExpression = (fileName: string) => {
        const model = getCurrentModel();
        if (!model) return;

        model.expression(fileName);
        onSetCurrentExpression(fileName);
        expressionLockUntil = Date.now() + lockMs;
        clearPendingLock();
    };

    const destroy = () => {
        clearPendingLock();
    };

    return {
        setExpression,
        triggerExpression,
        destroy,
    };
}

type CreateLive2DDebugControlOptions = {
    getCurrentModel: () => any | null;
    getAutonomy: () => any | null;
    getManualParamId: () => string;
    getManualParamValue: () => number;
    onSetCurrentEmotion: (emotion: string) => void;
    onSetCurrentExpression: (expression: string) => void;
    onSetLastMotion: (motion: string) => void;
};

export function createLive2DDebugControl({
    getCurrentModel,
    getAutonomy,
    getManualParamId,
    getManualParamValue,
    onSetCurrentEmotion,
    onSetCurrentExpression,
    onSetLastMotion,
}: CreateLive2DDebugControlOptions) {
    const handleDebugExpressionSelect = (expression: string) => {
        const model = getCurrentModel();
        if (!model) return;
        model.expression(expression);
        onSetCurrentExpression(expression);
    };

    const handleDebugSetManualParam = () => {
        const model = getCurrentModel();
        const manualParamId = getManualParamId();
        if (!model || !model.internalModel || !manualParamId) return;

        try {
            model.internalModel.coreModel.setParameterValueById(
                manualParamId,
                Number(getManualParamValue()),
            );
            model.internalModel.coreModel.update();
        } catch (e) {
            console.error("Failed to set parameter:", e);
            alert("Error setting parameter. Check ID.");
        }
    };

    const handleDebugSetEmotion = (emotion: string) => {
        const autonomy = getAutonomy();
        if (!autonomy) return;
        autonomy.setEmotion(emotion);
    };

    const resetToDefault = () => {
        const model = getCurrentModel();
        if (!model || !model.internalModel) return;

        const internal = model.internalModel;
        const mgr = internal.motionManager;

        if (mgr) {
            if (typeof mgr.stopAll === "function") {
                mgr.stopAll();
            } else if (typeof mgr.stop === "function") {
                mgr.stop();
            }

            if (mgr.queue) {
                mgr.queue = [];
            }

            if (mgr.expressionManager) {
                if (
                    typeof mgr.expressionManager.stopAllExpressions ===
                    "function"
                ) {
                    mgr.expressionManager.stopAllExpressions();
                } else if (
                    typeof mgr.expressionManager.restore === "function"
                ) {
                    mgr.expressionManager.restore();
                }
            }
        }

        const core = internal.coreModel;
        if (core) {
            const paramCount = core.getParameterCount();
            for (let i = 0; i < paramCount; i++) {
                const defaultValue = core.getParameterDefaultValue(i);
                core.setParameterValueByIndex(i, defaultValue);
            }
        }

        onSetCurrentEmotion("None");
        onSetCurrentExpression("None");
        onSetLastMotion("Reset (Hard)");
    };

    return {
        handleDebugExpressionSelect,
        handleDebugSetManualParam,
        handleDebugSetEmotion,
        resetToDefault,
    };
}

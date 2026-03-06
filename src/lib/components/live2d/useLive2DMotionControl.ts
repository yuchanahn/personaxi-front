type Live2DModelLike = {
    motion: (group: string, index?: number, priority?: number) => any;
    internalModel?: {
        motionManager?: any;
    };
};

type CreateMotionControlOptions = {
    getCurrentModel: () => Live2DModelLike | null;
    disableAllMotionsByDefault?: boolean;
};

export function createLive2DMotionControl({
    getCurrentModel,
    disableAllMotionsByDefault = true,
}: CreateMotionControlOptions) {
    let originalMotionDefinitions: Record<string, any[]> | null = null;
    let originalMotionUpdate: ((...args: any[]) => any) | null = null;
    let motionRelockTimer: any = null;
    const noMotionUpdate = () => true;

    const getMotionManager = (model?: Live2DModelLike | null) =>
        (model ?? getCurrentModel())?.internalModel?.motionManager;

    const relockMotionsWithoutStop = (model?: Live2DModelLike | null) => {
        if (!disableAllMotionsByDefault) return;
        const mgr = getMotionManager(model);
        if (!mgr) return;
        mgr.update = noMotionUpdate;
        mgr.definitions = {};
    };

    const disableAllMotions = (model?: Live2DModelLike | null) => {
        if (!disableAllMotionsByDefault) return;
        const current = model ?? getCurrentModel();
        const mgr = getMotionManager(current);
        if (!mgr) return;

        if (!originalMotionDefinitions && mgr.definitions) {
            originalMotionDefinitions = { ...mgr.definitions };
        }
        if (!originalMotionUpdate && typeof mgr.update === "function") {
            originalMotionUpdate = mgr.update.bind(mgr);
        }

        if (typeof mgr.stopAllMotions === "function") {
            mgr.stopAllMotions();
        } else if (typeof mgr.stopAll === "function") {
            mgr.stopAll();
        } else if (typeof mgr.stop === "function") {
            mgr.stop();
        }

        mgr.update = noMotionUpdate;
        mgr.definitions = {};

        if (Array.isArray(mgr.queue)) {
            mgr.queue = [];
        }
    };

    const getMotionDefinitionsForDebug = (): Record<string, any[]> | null => {
        if (disableAllMotionsByDefault && originalMotionDefinitions) {
            return originalMotionDefinitions;
        }
        return getMotionManager()?.definitions ?? null;
    };

    const findMotionByFile = (fileName: string) => {
        const defs = getMotionDefinitionsForDebug();
        if (!defs) return null;

        for (const [group, motions] of Object.entries(defs)) {
            if (!Array.isArray(motions)) continue;
            for (let i = 0; i < motions.length; i++) {
                const motion = motions[i];
                const file = motion?.File;
                if (
                    file &&
                    (file === fileName ||
                        file.endsWith("/" + fileName) ||
                        file.endsWith("\\" + fileName))
                ) {
                    return { group, index: i, file };
                }
            }
        }

        return null;
    };

    const playMotion = (
        group: string,
        index?: number,
        priority: number = 3,
    ) => {
        const model = getCurrentModel();
        const mgr = getMotionManager(model);
        if (!model || !mgr) return undefined;

        if (!disableAllMotionsByDefault) {
            return index === undefined
                ? model.motion(group)
                : model.motion(group, index, priority);
        }

        if (originalMotionDefinitions) {
            mgr.definitions = originalMotionDefinitions;
        }
        if (originalMotionUpdate) {
            mgr.update = originalMotionUpdate;
        }

        let relocked = false;
        const relock = () => {
            if (relocked) return;
            relocked = true;

            if (motionRelockTimer) {
                clearTimeout(motionRelockTimer);
                motionRelockTimer = null;
            }

            if (typeof mgr.off === "function") {
                mgr.off("motionFinish", handleMotionFinish);
            }

            relockMotionsWithoutStop(model);
        };

        const handleMotionFinish = () => {
            relock();
        };

        if (typeof mgr.once === "function") {
            mgr.once("motionFinish", handleMotionFinish);
        } else if (typeof mgr.on === "function") {
            mgr.on("motionFinish", handleMotionFinish);
        }

        const result =
            index === undefined
                ? model.motion(group)
                : model.motion(group, index, priority);

        motionRelockTimer = setTimeout(relock, 12000);

        if (result && typeof result.then === "function") {
            result
                .then((ok: boolean) => {
                    if (ok === false) relock();
                })
                .catch(relock);
        }

        return result;
    };

    return {
        disableAllMotions,
        getMotionDefinitionsForDebug,
        findMotionByFile,
        playMotion,
    };
}


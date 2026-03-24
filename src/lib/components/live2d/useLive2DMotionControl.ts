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

    const getRawSettingsJson = (settings: any) => {
        if (settings?.json && typeof settings.json === "object") {
            return settings.json;
        }
        if (settings?._json && typeof settings._json === "object") {
            return settings._json;
        }
        return null;
    };

    const cloneMotionDefinitionsFromSettings = (
        model?: Live2DModelLike | null,
    ): Record<string, any[]> | null => {
        const settings = (model as any)?.internalModel?.settings;
        const rawJson = getRawSettingsJson(settings);
        const motions =
            settings?.FileReferences?.Motions ||
            rawJson?.FileReferences?.Motions ||
            settings?.motions ||
            rawJson?.motions;
        if (!motions || typeof motions !== "object") return null;

        const defs: Record<string, any[]> = {};
        Object.entries(motions).forEach(([group, list]: [string, any]) => {
            if (!Array.isArray(list)) return;
            defs[group] = list.map((item) => ({ ...(item || {}) }));
        });
        return Object.keys(defs).length > 0 ? defs : null;
    };

    const ensureOriginalMotionState = (model?: Live2DModelLike | null) => {
        const current = model ?? getCurrentModel();
        const mgr = getMotionManager(current);
        if (!mgr) return;

        const hasMgrDefs =
            mgr.definitions &&
            typeof mgr.definitions === "object" &&
            Object.keys(mgr.definitions).length > 0;

        if (!originalMotionDefinitions) {
            if (hasMgrDefs) {
                originalMotionDefinitions = { ...mgr.definitions };
            } else {
                const fromSettings = cloneMotionDefinitionsFromSettings(current);
                if (fromSettings) {
                    originalMotionDefinitions = fromSettings;
                }
            }
        }

        if (!originalMotionUpdate && typeof mgr.update === "function") {
            originalMotionUpdate = mgr.update.bind(mgr);
        }
    };

    const relockMotionsWithoutStop = (model?: Live2DModelLike | null) => {
        if (!disableAllMotionsByDefault) return;
        const mgr = getMotionManager(model);
        if (!mgr) return;
        mgr.update = noMotionUpdate;
    };

    const disableAllMotions = (model?: Live2DModelLike | null) => {
        if (!disableAllMotionsByDefault) return;
        const current = model ?? getCurrentModel();
        const mgr = getMotionManager(current);
        if (!mgr) return;

        ensureOriginalMotionState(current);

        if (typeof mgr.stopAllMotions === "function") {
            mgr.stopAllMotions();
        } else if (typeof mgr.stopAll === "function") {
            mgr.stopAll();
        } else if (typeof mgr.stop === "function") {
            mgr.stop();
        }

        mgr.update = noMotionUpdate;

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
        ensureOriginalMotionState(model);

        if (!disableAllMotionsByDefault) {
            return index === undefined
                ? model.motion(group)
                : model.motion(group, index, priority);
        }

        console.log("Motion manager before unlock:", {
            group,
            index,
            locked: mgr.update === noMotionUpdate,
            hasOriginalUpdate: !!originalMotionUpdate,
        });

        if (originalMotionDefinitions) {
            mgr.definitions = originalMotionDefinitions;
        }
        if (originalMotionUpdate) {
            mgr.update = originalMotionUpdate;
        }
        console.log("Motion manager after unlock:", {
            group,
            index,
            locked: mgr.update === noMotionUpdate,
        });

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
            console.log("Motion manager re-locked:", {
                group,
                index,
                locked: mgr.update === noMotionUpdate,
            });
        };

        const handleMotionFinish = () => {
            relock();
        };

        if (typeof mgr.once === "function") {
            mgr.once("motionFinish", handleMotionFinish);
        } else if (typeof mgr.on === "function") {
            mgr.on("motionFinish", handleMotionFinish);
        }

        let result =
            index === undefined
                ? model.motion(group)
                : model.motion(group, index, priority);
        console.log("Motion try:", { group, index, priority, result });

        const tryManagerStartFallback = () => {
            if (typeof index !== "number") return undefined;
            if (typeof mgr.startMotion === "function") {
                return mgr.startMotion(group, index, priority);
            }
            if (typeof mgr.startMotionPriority === "function") {
                return mgr.startMotionPriority(group, index, priority);
            }
            return undefined;
        };

        const tryAnyGroupByIndexFallback = () => {
            if (typeof index !== "number") return undefined;
            const defs =
                originalMotionDefinitions ||
                mgr.definitions ||
                cloneMotionDefinitionsFromSettings(model);
            if (!defs || typeof defs !== "object") return undefined;

            for (const candidateGroup of Object.keys(defs)) {
                try {
                    const byModel = model.motion(candidateGroup, index, priority);
                    if (byModel !== false && byModel !== undefined) {
                        return byModel;
                    }
                } catch {
                    // try next group
                }
                try {
                    if (typeof mgr.startMotion === "function") {
                        const byMgr = mgr.startMotion(
                            candidateGroup,
                            index,
                            priority,
                        );
                        if (byMgr !== false && byMgr !== undefined) {
                            return byMgr;
                        }
                    } else if (typeof mgr.startMotionPriority === "function") {
                        const byMgr = mgr.startMotionPriority(
                            candidateGroup,
                            index,
                            priority,
                        );
                        if (byMgr !== false && byMgr !== undefined) {
                            return byMgr;
                        }
                    }
                } catch {
                    // try next group
                }
            }

            return undefined;
        };

        motionRelockTimer = setTimeout(relock, 12000);

        if (result && typeof result.then === "function") {
            result
                .then((ok: boolean) => {
                    if (ok === false) {
                        const fallbackResult = tryManagerStartFallback();
                        console.log("Motion fallback(then:false):", {
                            group,
                            index,
                            fallbackResult,
                        });
                        if (fallbackResult === undefined) {
                            const anyGroupResult = tryAnyGroupByIndexFallback();
                            if (anyGroupResult !== undefined) {
                                result = anyGroupResult;
                                return;
                            }
                            relock();
                        } else {
                            result = fallbackResult;
                        }
                    }
                })
                .catch(relock);
        } else if (result === false || result === undefined) {
            const fallbackResult = tryManagerStartFallback();
            console.log("Motion fallback(sync false/undefined):", {
                group,
                index,
                fallbackResult,
            });
            if (fallbackResult === undefined) {
                const anyGroupResult = tryAnyGroupByIndexFallback();
                if (anyGroupResult === undefined) {
                    relock();
                } else {
                    result = anyGroupResult;
                }
            } else {
                result = fallbackResult;
            }
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

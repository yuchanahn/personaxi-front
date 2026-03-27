type LoadLive2DModelOptions = {
    PIXI: any;
    app: any;
    modelUrl: string;
    showDebug: boolean;
    x: number;
    y: number;
    scale: number;
};

const MODEL_RESOURCE_PATH_PATTERN = /\.(moc3|png|jpg|jpeg|tga|atlas|json)$/i;
const resolvedModelUrlCache = new Map<string, Promise<string>>();

async function blobToDataUrl(blob: Blob): Promise<string> {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function isAbsoluteResourcePath(path: string): boolean {
    return /^(https?:|data:|blob:)/i.test(path);
}

function resolveModelResourceUrl(
    modelUrl: string,
    relativeOrAbsolutePath: string,
): string {
    if (isAbsoluteResourcePath(relativeOrAbsolutePath)) {
        return relativeOrAbsolutePath;
    }

    const absoluteModelUrl = new URL(modelUrl, window.location.origin).href;
    const basePath = absoluteModelUrl.substring(
        0,
        absoluteModelUrl.lastIndexOf("/") + 1,
    );
    return new URL(relativeOrAbsolutePath, basePath).href;
}

async function rewriteModelResourcePaths(
    obj: any,
    resolver: (resourcePath: string) => Promise<string> | string,
) {
    if (Array.isArray(obj)) {
        await Promise.all(
            obj.map(async (item, index) => {
                if (
                    typeof item === "string" &&
                    MODEL_RESOURCE_PATH_PATTERN.test(item)
                ) {
                    obj[index] = await resolver(item);
                } else if (typeof item === "object" && item !== null) {
                    await rewriteModelResourcePaths(item, resolver);
                }
            }),
        );
        return;
    }

    if (typeof obj === "object" && obj !== null) {
        await Promise.all(
            Object.keys(obj).map(async (key) => {
                const value = obj[key];
                if (
                    typeof value === "string" &&
                    MODEL_RESOURCE_PATH_PATTERN.test(value)
                ) {
                    obj[key] = await resolver(value);
                } else if (typeof value === "object" && value !== null) {
                    await rewriteModelResourcePaths(value, resolver);
                }
            }),
        );
    }
}

async function convertModelJsonToDataUrl(modelJson: any): Promise<string> {
    const modelJsonBlob = new Blob([JSON.stringify(modelJson)], {
        type: "application/json",
    });
    const finalDataUrl = await blobToDataUrl(modelJsonBlob);
    return `${finalDataUrl}#dummy.model3.json`;
}

async function resolveEncryptedModelUrl(url: string): Promise<string> {
    const cached = resolvedModelUrlCache.get(url);
    if (cached) {
        return await cached;
    }

    const resolutionTask = (async () => {
        const cryptoModule = await import("$lib/utils/crypto");
        const absoluteModelUrl = new URL(url, window.location.origin).href;
        const res = await fetch(absoluteModelUrl);
        if (!res.ok) throw new Error("Failed to fetch model3.json");
        const buffer = await res.arrayBuffer();

        let modelJson: any;
        let isEncrypted = false;

        try {
            const plainText = new TextDecoder().decode(buffer);
            modelJson = JSON.parse(plainText);
        } catch (plainParseError) {
            try {
                const decryptedJsonBuffer =
                    await cryptoModule.xorEncryptDecrypt(buffer);
                const jsonStr = new TextDecoder().decode(decryptedJsonBuffer);
                modelJson = JSON.parse(jsonStr);
                isEncrypted = true;
            } catch {
                throw plainParseError;
            }
        }

        if (!isEncrypted) {
            await rewriteModelResourcePaths(modelJson, (resourcePath) =>
                resolveModelResourceUrl(absoluteModelUrl, resourcePath),
            );
            return await convertModelJsonToDataUrl(modelJson);
        }

        const createDecryptedDataUrl = async (
            relativeOrAbsolutePath: string,
        ): Promise<string> => {
            const fullUrl = resolveModelResourceUrl(
                absoluteModelUrl,
                relativeOrAbsolutePath,
            );

            const ext = fullUrl.split(".").pop()?.toLowerCase() || "";
            const mimeByExt: Record<string, string> = {
                png: "image/png",
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                json: "application/json",
                moc3: "application/octet-stream",
            };
            const mime = mimeByExt[ext] || "application/octet-stream";

            const fileRes = await fetch(fullUrl);
            if (!fileRes.ok) throw new Error(`Failed to fetch ${fullUrl}`);
            const fileBuffer = await fileRes.arrayBuffer();

            const decryptedFileBuffer =
                await cryptoModule.xorEncryptDecrypt(fileBuffer);
            const blob = new Blob([decryptedFileBuffer], { type: mime });
            return await blobToDataUrl(blob);
        };

        await rewriteModelResourcePaths(modelJson, createDecryptedDataUrl);
        return await convertModelJsonToDataUrl(modelJson);
    })().catch((error) => {
        resolvedModelUrlCache.delete(url);
        throw error;
    });

    resolvedModelUrlCache.set(url, resolutionTask);
    return await resolutionTask;
}

export async function loadLive2DModel({
    PIXI,
    app,
    modelUrl,
    showDebug,
    x,
    y,
    scale,
}: LoadLive2DModelOptions): Promise<{ model: any; hitAreaKeys: string[] }> {
    const finalUrl = await resolveEncryptedModelUrl(modelUrl);
    const model = await PIXI.live2d.Live2DModel.from(finalUrl, {
        autoInteract: false,
    });

    model.interactive = true;
    model.buttonMode = true;

    if (
        PIXI.live2d.HitAreaFrames &&
        typeof PIXI.live2d.HitAreaFrames === "function"
    ) {
        const hitAreaFrames = new PIXI.live2d.HitAreaFrames();
        hitAreaFrames.visible = showDebug;
        model.addChild(hitAreaFrames);
        (model as any).hitAreaFrames = hitAreaFrames;
    }

    const hitAreaKeys = model.hitAreas ? Object.keys(model.hitAreas) : [];

    model.scale.set(1);
    const bounds = model.getBounds();
    const paddingFactor = 1.3;
    const scaleX = (app.screen.width * paddingFactor) / bounds.width;
    const scaleY = (app.screen.height * paddingFactor) / bounds.height;
    const autoScale = Math.min(scaleX, scaleY);
    const finalScale = x === 0 && y === 0 ? autoScale : scale;
    model.scale.set(finalScale);

    model.x = x;
    model.y = y;
    if (x === 0 && y === 0) {
        model.anchor.set(0.5, 0.5);
        model.x = app.screen.width / 2;
        model.y = app.screen.height / 2 + 150;
    }

    return { model, hitAreaKeys };
}

function getRawSettingsJson(settings: any) {
    if (settings?.json && typeof settings.json === "object") return settings.json;
    if (settings?._json && typeof settings._json === "object") return settings._json;
    return null;
}

function getExpressionEntries(settings: any): any[] {
    const rawJson = getRawSettingsJson(settings);
    const entries =
        settings?.FileReferences?.Expressions ||
        rawJson?.FileReferences?.Expressions ||
        settings?.expressions ||
        rawJson?.expressions;
    return Array.isArray(entries) ? entries : [];
}

export function collectAvailableExpressions(model: any): string[] {
    const found = new Set<string>();

    if (Array.isArray(model?.expressions)) {
        model.expressions.forEach((expr: string) => found.add(expr));
    }

    const settings = model?.internalModel?.settings;
    getExpressionEntries(settings).forEach((expr: any) => {
        if (expr.name) found.add(expr.name);
        else if (expr.Name) found.add(expr.Name);
        else if (expr.file) {
            found.add(expr.file.split("/").pop().replace(/\.exp3\.json$/i, ""));
        } else if (expr.File) {
            found.add(expr.File.split("/").pop().replace(/\.exp3\.json$/i, ""));
        }
    });

    return Array.from(found);
}

export function collectAvailableMotionGroups(
    model: any,
    motionDefinitions?: Record<string, any[]> | null,
): string[] {
    const found = new Set<string>();
    const defs =
        motionDefinitions || model?.internalModel?.motionManager?.definitions;

    if (defs) {
        Object.keys(defs).forEach((group) => found.add(group));
    }

    return Array.from(found);
}

export async function applyPermanentExpressions(
    model: any,
    modelUrl: string,
    firstScene?: string,
    live2dConfig?: any,
): Promise<void> {
    let expressions: any = null;
    if (live2dConfig && typeof live2dConfig === "object") {
        expressions = Array.isArray(live2dConfig.permanent_expressions)
            ? live2dConfig.permanent_expressions
            : Array.isArray(live2dConfig.live2d_permanent_expressions)
              ? live2dConfig.live2d_permanent_expressions
              : null;
    }

    if (!expressions && firstScene) {
        let parsed: any;
        try {
            parsed = JSON.parse(firstScene);
        } catch {
            parsed = null;
        }
        expressions = parsed?.live2d_permanent_expressions;
    }

    if (!Array.isArray(expressions) || expressions.length === 0) return;

    const settings = model?.internalModel?.settings;
    const coreModel = model?.internalModel?.coreModel;
    const setParameterValueById = coreModel?.setParameterValueById?.bind(
        coreModel,
    );
    if (!setParameterValueById) return;

    for (const exprName of expressions) {
        let file = "";
        const found = getExpressionEntries(settings).find(
            (expr: any) =>
                expr.name === exprName ||
                expr.Name === exprName ||
                expr.file?.includes?.(exprName) ||
                expr.File?.includes?.(exprName),
        );
        if (found) file = found.file || found.File || "";

        if (!file) continue;

        try {
            const exprUrl = resolveModelResourceUrl(modelUrl, file);
            const resp = await fetch(exprUrl);
            if (!resp.ok) continue;
            const json = await resp.json();
            if (!Array.isArray(json?.Parameters)) continue;
            json.Parameters.forEach((param: any) => {
                if (param?.Id !== undefined && param?.Value !== undefined) {
                    setParameterValueById(param.Id, param.Value);
                }
            });
        } catch {
            // ignore one-off expression fetch/parse failures
        }
    }
}

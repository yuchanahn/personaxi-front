type LoadLive2DModelOptions = {
    PIXI: any;
    app: any;
    modelUrl: string;
    showDebug: boolean;
    x: number;
    y: number;
    scale: number;
};

async function blobToDataUrl(blob: Blob): Promise<string> {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function resolveEncryptedModelUrl(url: string): Promise<string> {
    const isSupabase = url.includes("uohepkqmwbstbmnkoqju.supabase.co");
    if (!isSupabase) return url;

    const cryptoModule = await import("$lib/utils/crypto");
    const basePath = url.substring(0, url.lastIndexOf("/") + 1);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch model3.json");
    const buffer = await res.arrayBuffer();

    let modelJson: any;
    try {
        const plainText = new TextDecoder().decode(buffer);
        modelJson = JSON.parse(plainText);
        return url;
    } catch {
        const decryptedJsonBuffer = await cryptoModule.xorEncryptDecrypt(buffer);
        const jsonStr = new TextDecoder().decode(decryptedJsonBuffer);
        modelJson = JSON.parse(jsonStr);
    }

    const createDecryptedDataUrl = async (
        relativeOrAbsolutePath: string,
    ): Promise<string> => {
        let fullUrl = relativeOrAbsolutePath;
        if (!fullUrl.startsWith("http") && !fullUrl.startsWith("data:")) {
            fullUrl = new URL(relativeOrAbsolutePath, basePath).href;
        }

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

    const replacePaths = async (obj: any) => {
        if (Array.isArray(obj)) {
            await Promise.all(
                obj.map(async (item, i) => {
                    if (
                        typeof item === "string" &&
                        item.match(/\.(moc3|png|jpg|jpeg|tga|atlas|json)$/i)
                    ) {
                        obj[i] = await createDecryptedDataUrl(item);
                    } else if (typeof item === "object" && item !== null) {
                        await replacePaths(item);
                    }
                }),
            );
            return;
        }

        if (typeof obj === "object" && obj !== null) {
            const keys = Object.keys(obj);
            await Promise.all(
                keys.map(async (key) => {
                    const value = obj[key];
                    if (
                        typeof value === "string" &&
                        value.match(/\.(moc3|png|jpg|jpeg|tga|atlas|json)$/i)
                    ) {
                        obj[key] = await createDecryptedDataUrl(value);
                    } else if (typeof value === "object" && value !== null) {
                        await replacePaths(value);
                    }
                }),
            );
        }
    };

    await replacePaths(modelJson);
    const modelJsonBlob = new Blob([JSON.stringify(modelJson)], {
        type: "application/json",
    });
    const finalDataUrl = await blobToDataUrl(modelJsonBlob);
    return `${finalDataUrl}#dummy.model3.json`;
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
    const baseUrl = modelUrl.substring(0, modelUrl.lastIndexOf("/") + 1);
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
            const exprUrl = baseUrl + file;
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

type DisplayInfoParameter = {
    Id?: string;
    Name?: string;
};

type BodyAxis = "x" | "y" | "z";

type PhysicsInputEntry = {
    Source?: {
        Id?: string;
    };
    Id?: string;
};

type PhysicsOutputEntry = {
    Destination?: {
        Id?: string;
    };
    Id?: string;
};

type PhysicsSettingEntry = {
    Id?: string;
    Input?: PhysicsInputEntry[];
    Inputs?: PhysicsInputEntry[];
    Output?: PhysicsOutputEntry[];
    Outputs?: PhysicsOutputEntry[];
};

export type Live2DParameterAliasHints = Partial<Record<string, string[]>>;

export interface Live2DBodyPhysicsLinkSlot {
    linked: boolean;
    bodyParamId: string | null;
    sourceParamIds: string[];
    physicsSettingIds: string[];
}

export type Live2DBodyPhysicsLinkSummary = Record<
    BodyAxis,
    Live2DBodyPhysicsLinkSlot
>;

export interface Live2DResolvedParameterMetadata {
    aliasHints: Live2DParameterAliasHints;
    bodyPhysicsLinks: Live2DBodyPhysicsLinkSummary;
}

function normalizeName(value: string): string {
    return value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[\s_\-]+/g, "");
}

function createEmptyBodyPhysicsLinks(): Live2DBodyPhysicsLinkSummary {
    return {
        x: {
            linked: false,
            bodyParamId: null,
            sourceParamIds: [],
            physicsSettingIds: [],
        },
        y: {
            linked: false,
            bodyParamId: null,
            sourceParamIds: [],
            physicsSettingIds: [],
        },
        z: {
            linked: false,
            bodyParamId: null,
            sourceParamIds: [],
            physicsSettingIds: [],
        },
    };
}

async function loadMaybeEncryptedJson(url: string): Promise<any> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}`);
    }

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder();

    try {
        return JSON.parse(decoder.decode(buffer));
    } catch {
        const cryptoModule = await import("$lib/utils/crypto");
        const decrypted = await cryptoModule.xorEncryptDecrypt(buffer);
        return JSON.parse(decoder.decode(decrypted));
    }
}

function getRawSettingsJson(settings: any) {
    if (settings?.json && typeof settings.json === "object") return settings.json;
    if (settings?._json && typeof settings._json === "object") return settings._json;
    return null;
}

function getDisplayInfoPath(model: any): string | null {
    const settings = model?.internalModel?.settings;
    const rawJson = getRawSettingsJson(settings);
    return (
        settings?.FileReferences?.DisplayInfo ||
        rawJson?.FileReferences?.DisplayInfo ||
        settings?.displayInfo ||
        rawJson?.displayInfo ||
        null
    );
}

function getPhysicsPath(model: any): string | null {
    const settings = model?.internalModel?.settings;
    const rawJson = getRawSettingsJson(settings);
    return (
        settings?.FileReferences?.Physics ||
        rawJson?.FileReferences?.Physics ||
        settings?.physics ||
        rawJson?.physics ||
        null
    );
}

function resolveResourceUrl(modelUrl: string, resourcePath: string): string {
    if (
        resourcePath.startsWith("http://") ||
        resourcePath.startsWith("https://")
    ) {
        return resourcePath;
    }

    return new URL(
        resourcePath,
        modelUrl.substring(0, modelUrl.lastIndexOf("/") + 1),
    ).href;
}

function buildAliasHints(parameters: DisplayInfoParameter[]): Live2DParameterAliasHints {
    const canonicalNameHints: Record<string, string[]> = {
        ParamBodyAngleX: ["bodyx", "\u8eab\u4f53x", "\u4f53x", "\ubab8x"],
        ParamBodyAngleY: ["bodyy", "\u8eab\u4f53y", "\u4f53y", "\ubab8y"],
        ParamBodyAngleZ: ["bodyz", "\u8eab\u4f53z", "\u4f53z", "\ubab8z"],
    };

    const out: Live2DParameterAliasHints = {};

    parameters.forEach((parameter) => {
        const id = (parameter?.Id || "").trim();
        const normalizedName = normalizeName((parameter?.Name || "").trim());
        if (!id || !normalizedName) return;

        Object.entries(canonicalNameHints).forEach(([canonicalId, nameHints]) => {
            if (!nameHints.includes(normalizedName)) return;
            if (!out[canonicalId]) out[canonicalId] = [];
            if (!out[canonicalId]!.includes(id)) {
                out[canonicalId]!.push(id);
            }
        });
    });

    return out;
}

function getPhysicsSettings(physics: any): PhysicsSettingEntry[] {
    if (Array.isArray(physics?.PhysicsSettings)) return physics.PhysicsSettings;
    if (Array.isArray(physics?.Settings)) return physics.Settings;
    return [];
}

function getPhysicsInputIds(setting: PhysicsSettingEntry): string[] {
    const inputs = Array.isArray(setting?.Input)
        ? setting.Input
        : Array.isArray(setting?.Inputs)
          ? setting.Inputs
          : [];

    return inputs
        .map((input) => input?.Source?.Id || input?.Id || "")
        .filter((value): value is string => typeof value === "string" && !!value);
}

function getPhysicsOutputIds(setting: PhysicsSettingEntry): string[] {
    const outputs = Array.isArray(setting?.Output)
        ? setting.Output
        : Array.isArray(setting?.Outputs)
          ? setting.Outputs
          : [];

    return outputs
        .map(
            (output) => output?.Destination?.Id || output?.Id || "",
        )
        .filter((value): value is string => typeof value === "string" && !!value);
}

function buildBodyParamIdCandidates(
    aliasHints: Live2DParameterAliasHints,
): Record<BodyAxis, Set<string>> {
    return {
        x: new Set([
            "ParamBodyAngleX",
            "ParamBodyX",
            ...(aliasHints.ParamBodyAngleX || []),
        ]),
        y: new Set([
            "ParamBodyAngleY",
            "ParamBodyY",
            "ParamBodyAngle",
            ...(aliasHints.ParamBodyAngleY || []),
        ]),
        z: new Set([
            "ParamBodyAngleZ",
            "ParamBodyZ",
            ...(aliasHints.ParamBodyAngleZ || []),
        ]),
    };
}

function buildBodyPhysicsLinks(
    physics: any,
    aliasHints: Live2DParameterAliasHints,
): Live2DBodyPhysicsLinkSummary {
    const bodyPhysicsLinks = createEmptyBodyPhysicsLinks();
    const bodyParamIdCandidates = buildBodyParamIdCandidates(aliasHints);
    const headInputIds = new Set(["ParamAngleX", "ParamAngleY", "ParamAngleZ"]);
    const settings = getPhysicsSettings(physics);

    (Object.keys(bodyParamIdCandidates) as BodyAxis[]).forEach((axis) => {
        const bodyIds = bodyParamIdCandidates[axis];
        const matchedSourceIds = new Set<string>();
        const matchedSettingIds = new Set<string>();
        let matchedBodyParamId: string | null = null;

        settings.forEach((setting) => {
            const outputIds = getPhysicsOutputIds(setting);
            const inputIds = getPhysicsInputIds(setting);
            const matchedOutputId = outputIds.find((id) => bodyIds.has(id));
            const linkedHeadInputs = inputIds.filter((id) => headInputIds.has(id));

            if (!matchedOutputId || linkedHeadInputs.length === 0) return;

            matchedBodyParamId = matchedOutputId;
            linkedHeadInputs.forEach((id) => matchedSourceIds.add(id));
            if (setting?.Id) {
                matchedSettingIds.add(setting.Id);
            }
        });

        if (matchedBodyParamId) {
            bodyPhysicsLinks[axis] = {
                linked: true,
                bodyParamId: matchedBodyParamId,
                sourceParamIds: Array.from(matchedSourceIds),
                physicsSettingIds: Array.from(matchedSettingIds),
            };
        }
    });

    return bodyPhysicsLinks;
}

export async function resolveLive2DParameterMetadata(
    modelUrl: string,
    model: any,
): Promise<Live2DResolvedParameterMetadata> {
    const displayInfoPath = getDisplayInfoPath(model);
    const physicsPath = getPhysicsPath(model);

    try {
        const [displayInfo, physics] = await Promise.all([
            displayInfoPath
                ? loadMaybeEncryptedJson(
                      resolveResourceUrl(modelUrl, displayInfoPath),
                  ).catch(() => null)
                : Promise.resolve(null),
            physicsPath
                ? loadMaybeEncryptedJson(
                      resolveResourceUrl(modelUrl, physicsPath),
                  ).catch(() => null)
                : Promise.resolve(null),
        ]);

        const parameters = Array.isArray(displayInfo?.Parameters)
            ? displayInfo.Parameters
            : [];
        const aliasHints = buildAliasHints(parameters);
        const bodyPhysicsLinks = physics
            ? buildBodyPhysicsLinks(physics, aliasHints)
            : createEmptyBodyPhysicsLinks();

        return {
            aliasHints,
            bodyPhysicsLinks,
        };
    } catch (error) {
        console.warn("Failed to resolve Live2D parameter metadata:", error);
        return {
            aliasHints: {},
            bodyPhysicsLinks: createEmptyBodyPhysicsLinks(),
        };
    }
}

export async function resolveLive2DParameterAliasHints(
    modelUrl: string,
    model: any,
): Promise<Live2DParameterAliasHints> {
    const metadata = await resolveLive2DParameterMetadata(modelUrl, model);
    return metadata.aliasHints;
}

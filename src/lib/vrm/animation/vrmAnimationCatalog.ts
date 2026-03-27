export interface WeightedAnimation {
    clipName: string;
    weight: number;
    duration?: number;
    cooldown?: number;
    lastPlayedTime?: number;
}

export interface AnimationPoolConfig {
    animations: WeightedAnimation[];
    transitionTime: number;
    minPlayTime: number;
    maxPlayTime: number;
}

export const ANIMATION_POOLS: Record<string, AnimationPoolConfig> = {
    idle_pool: {
        animations: [
            { clipName: 'Idle_nomal.fbx', weight: 60 },
            { clipName: 'Looking Around.fbx', weight: 5 },
            { clipName: 'Hands on waist.fbx', weight: 5 },
            { clipName: 'Arms crossed.fbx', weight: 5 },
            { clipName: 'Neck Stretching.fbx', weight: 2, cooldown: 30.0 },
            { clipName: 'Arm Stretching.fbx', weight: 2, cooldown: 30.0 },
            { clipName: 'Yawning.fbx', weight: 1, cooldown: 45.0, duration: 5.0 },
        ],
        transitionTime: 1.5,
        minPlayTime: 3.0,
        maxPlayTime: 30.0,
    },
    thinking_pool: {
        animations: [
            { clipName: 'Thinking.fbx', weight: 35 },
            { clipName: 'Hand To Chin.fbx', weight: 25 },
            { clipName: 'Looking Up Thinking.fbx', weight: 20 },
            { clipName: 'Head Scratch.fbx', weight: 15, cooldown: 20.0 },
            { clipName: 'Deep Thought.fbx', weight: 5 },
        ],
        transitionTime: 1.5,
        minPlayTime: 2.0,
        maxPlayTime: 8.0,
    },
    speaking_pool: {
        animations: [
            { clipName: 'talk1.fbx', weight: 35 },
            { clipName: 'talk2.fbx', weight: 25 },
            { clipName: 'talk3.fbx', weight: 25 },
        ],
        transitionTime: 1.5,
        minPlayTime: 2.0,
        maxPlayTime: 8.0,
    },
    listening_pool: {
        animations: [
            { clipName: 'Listening.fbx', weight: 50 },
        ],
        transitionTime: 1.5,
        minPlayTime: 3.0,
        maxPlayTime: 10.0,
    },
};

export const VRM_DEFAULT_ANIMATION_ASSET_NAMES = [
    'base/Idle Base.fbx',
    'base/Arms crossed.fbx',
    'base/Hands on waist.fbx',
    'base/Looking Around.fbx',
    'base/Listening.fbx',
    'base/Listening2.fbx',
    'base/Listening Start.fbx',
    'base/Listening End.fbx',
    'base/talk1.fbx',
    'base/talk2.fbx',
    'base/talk3.fbx',
] as const;

const DEFAULT_ANIMATION_OVERRIDES = new Map(
    VRM_DEFAULT_ANIMATION_ASSET_NAMES.map((assetName) => [normalizeAnimationName(assetName), assetName]),
);

const FSM_EAGER_ANIMATION_NAMES = [
    'Idle_nomal.fbx',
    'Looking Around.fbx',
    'Hands on waist.fbx',
    'Arms crossed.fbx',
    'Neck Stretching.fbx',
    'Arm Stretching.fbx',
    'Yawning.fbx',
    'Listening.fbx',
    'talk1.fbx',
    'talk2.fbx',
    'talk3.fbx',
] as const;

export const VRM_INITIAL_PRELOAD_ANIMATION_NAMES = Array.from(
    new Set([
        ...VRM_DEFAULT_ANIMATION_ASSET_NAMES.map((assetName) => normalizeAnimationName(assetName)),
        ...FSM_EAGER_ANIMATION_NAMES,
    ]),
);

export function normalizeAnimationName(name: string): string {
    const parts = name.split('/');
    const baseName = parts[parts.length - 1] || name;
    return baseName.toLowerCase().endsWith('.fbx') ? baseName : `${baseName}.fbx`;
}

export function resolveAnimationAssetName(name: string): string {
    if (name.startsWith('/animations/')) {
        return name.replace(/^\/animations\//, '');
    }

    if (name.includes('/')) {
        const parts = name.split('/');
        const fileName = parts.pop() || '';
        const normalizedFileName = normalizeAnimationName(fileName);
        return [...parts, normalizedFileName].join('/');
    }

    const normalizedName = normalizeAnimationName(name);
    return DEFAULT_ANIMATION_OVERRIDES.get(normalizedName) ?? normalizedName;
}

export function resolveAnimationAssetPath(name: string): string {
    const assetName = resolveAnimationAssetName(name);
    return assetName.startsWith('/animations/') ? assetName : `/animations/${assetName}`;
}

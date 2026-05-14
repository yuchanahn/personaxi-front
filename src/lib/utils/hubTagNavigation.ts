import { allCategories } from "$lib/constants";

export type HubTab = "home" | "character" | "story" | "companion" | "2d" | "3d";
type HubQueryTab = Exclude<HubTab, "home" | "companion">;

type HubTagNavigationInput = {
    tag?: string | number | null;
    tab?: HubTab | null;
    personaType?: string | null;
    contentType?: string | null;
};

export function normalizeHubTab(raw?: string | null): HubTab | null {
    switch ((raw || "").trim()) {
        case "home":
        case "character":
        case "story":
        case "companion":
        case "2d":
        case "3d":
            return raw as HubTab;
        default:
            return null;
    }
}

export function normalizeHubTag(tag?: string | number | null): string | null {
    const value = `${tag ?? ""}`.trim();
    if (!value) return null;

    const byName = allCategories.find((category) => category.nameKey === value);
    if (byName) return byName.nameKey;

    const byId = allCategories.find((category) => `${category.id}` === value);
    if (byId) return byId.nameKey;

    return value;
}

export function resolveHubTabForContent(input?: {
    personaType?: string | null;
    contentType?: string | null;
}): HubQueryTab {
    const normalizedContentType = (input?.contentType || "").trim().toLowerCase();
    if (normalizedContentType === "story") {
        return "story";
    }

    const normalizedPersonaType = (input?.personaType || "").trim().toLowerCase();
    if (normalizedPersonaType === "2.5d" || normalizedPersonaType === "live2d") {
        return "2d";
    }
    if (normalizedPersonaType === "3d" || normalizedPersonaType === "vrm3d") {
        return "3d";
    }

    return "character";
}

export function buildHubTagHref(input: HubTagNavigationInput): string {
    const normalizedTag = normalizeHubTag(input.tag);
    if (!normalizedTag) return "/hub";

    let resolvedTab: HubQueryTab | null =
        input.tab && input.tab !== "home" && input.tab !== "companion"
            ? input.tab
            : null;

    if (!resolvedTab) {
        if (normalizedTag === "tags.live2d") {
            resolvedTab = "2d";
        } else if (normalizedTag === "tags.vrm") {
            resolvedTab = "3d";
        } else {
            resolvedTab = resolveHubTabForContent(input);
        }
    }

    const params = new URLSearchParams();
    params.set("tag", normalizedTag);
    params.set("tab", resolvedTab);

    return `/hub?${params.toString()}`;
}

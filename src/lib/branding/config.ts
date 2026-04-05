import rawBrandingConfig from "./branding.config.json";

type BrandingConfig = {
    publicBrandName: string;
    legalServiceName: string;
    legalEntityName: string;
    serviceSlug: string;
    publicOrigin: string;
    apiOrigin: string;
    supportEmail: string;
    privacyEmail: string;
    contactEmail: string;
    copyrightName: string;
};

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, "");
}

function getHost(origin: string, fallback: string): string {
    try {
        return new URL(origin).host;
    } catch {
        return fallback;
    }
}

const config = rawBrandingConfig as BrandingConfig;
const publicOrigin = trimTrailingSlash(config.publicOrigin);
const apiOrigin = trimTrailingSlash(config.apiOrigin);

export const branding = {
    ...config,
    publicOrigin,
    apiOrigin,
    publicHost: getHost(publicOrigin, "personaxi.com"),
    apiHost: getHost(apiOrigin, "api.personaxi.com"),
    appTitle: `${config.publicBrandName} - AI Chat, Your Way`,
    appDescription: `From status panels to Live2D and VRM, ${config.publicBrandName} is the only AI chat platform where you can design how characters appear.`,
    ogImageUrl: `${publicOrigin}/og-image-v3.png`,
};

export function buildPublicUrl(path = ""): string {
    if (!path) {
        return branding.publicOrigin;
    }

    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    return `${branding.publicOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

import rawBrandingConfig from "./branding.config.json";

export const BRANDING_LOCALES = ["ko", "en", "ja"] as const;

export type BrandingLocale = (typeof BRANDING_LOCALES)[number];
type LocalizedBrandValue =
    | string
    | Partial<Record<BrandingLocale | "default", string>>;

type BrandingConfig = {
    publicBrandName: LocalizedBrandValue;
    legalServiceName: LocalizedBrandValue;
    legalEntityName: string;
    serviceSlug: string;
    publicOrigin: string;
    apiOrigin: string;
    supportEmail: string;
    privacyEmail: string;
    contactEmail: string;
    copyrightName: LocalizedBrandValue;
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

function normalizeBrandingLocale(
    value: string | null | undefined,
): BrandingLocale | undefined {
    return BRANDING_LOCALES.find((locale) => locale === value);
}

function resolveLocalizedBrandValue(
    value: LocalizedBrandValue,
    locale?: string | null,
): string {
    if (typeof value === "string") {
        return value;
    }

    const normalizedLocale = normalizeBrandingLocale(locale);
    const candidates = [
        normalizedLocale,
        "default",
        "ko",
        "en",
        "ja",
    ] as const;

    for (const candidate of candidates) {
        if (!candidate) continue;
        const resolved = value[candidate];
        if (resolved) {
            return resolved;
        }
    }

    const fallback = Object.values(value).find(Boolean);
    return fallback || "";
}

const config = rawBrandingConfig as BrandingConfig;
const publicOrigin = trimTrailingSlash(config.publicOrigin);
const apiOrigin = trimTrailingSlash(config.apiOrigin);

export function getBranding(locale?: string | null) {
    const publicBrandName = resolveLocalizedBrandValue(
        config.publicBrandName,
        locale,
    );
    const legalServiceName = resolveLocalizedBrandValue(
        config.legalServiceName,
        locale,
    );
    const copyrightName = resolveLocalizedBrandValue(
        config.copyrightName,
        locale,
    );

    return {
        ...config,
        publicBrandName,
        legalServiceName,
        copyrightName,
        publicOrigin,
        apiOrigin,
        publicHost: getHost(publicOrigin, "personaxi.com"),
        apiHost: getHost(apiOrigin, "api.personaxi.com"),
        appTitle: `${publicBrandName} - AI Chat, Your Way`,
        appDescription: `From status panels to Live2D and VRM, ${publicBrandName} is the only AI chat platform where you can design how characters appear.`,
        ogImageUrl: `${publicOrigin}/og-image-v4.png`,
    };
}

export const branding = getBranding();

export function buildPublicUrl(path = ""): string {
    if (!path) {
        return branding.publicOrigin;
    }

    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    return `${branding.publicOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

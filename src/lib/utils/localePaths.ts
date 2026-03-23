import type { Language } from "$lib/stores/settings";

export const SUPPORTED_LOCALES = ["ko", "en", "ja"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LocalizedStaticDoc =
    | "terms"
    | "privacy"
    | "policy"
    | "faq"
    | "welcome";

export function normalizeLocale(locale: string | null | undefined): SupportedLocale {
    if (locale === "ko" || locale === "en" || locale === "ja") {
        return locale;
    }

    return "en";
}

export function getLocalizedStaticDocPath(
    locale: string | Language | null | undefined,
    doc: LocalizedStaticDoc,
) {
    const normalized = normalizeLocale(locale);
    return `/${normalized}/${doc}/`;
}

export function getLocalizedStaticDocFlatPath(
    locale: string | Language | null | undefined,
    doc: LocalizedStaticDoc,
) {
    const normalized = normalizeLocale(locale);

    if (normalized === "ko") {
        return `/${doc}.html`;
    }

    return `/${doc}-${normalized}.html`;
}

export function getLocalizedStaticDocHref(
    locale: string | Language | null | undefined,
    doc: LocalizedStaticDoc,
) {
    if (typeof window !== "undefined") {
        const host = window.location.hostname;
        const isLocalHost =
            host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";

        if (isLocalHost) {
            return getLocalizedStaticDocFlatPath(locale, doc);
        }
    }

    return getLocalizedStaticDocPath(locale, doc);
}

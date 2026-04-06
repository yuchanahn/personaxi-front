import type { Language } from "$lib/stores/settings";

export const SUPPORTED_LOCALES = ["ko", "en", "ja"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LocalizedStaticDoc =
    | "terms"
    | "privacy"
    | "licenses";

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

export function getLocalizedStaticDocHref(
    locale: string | Language | null | undefined,
    doc: LocalizedStaticDoc,
) {
    return getLocalizedStaticDocPath(locale, doc);
}

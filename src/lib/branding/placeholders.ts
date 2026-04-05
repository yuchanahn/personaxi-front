import { branding } from "./config";

type JsonLike =
    | string
    | number
    | boolean
    | null
    | JsonLike[]
    | { [key: string]: JsonLike };

function getReplacements(): Array<[string, string]> {
    return [
        ["{{PUBLIC_BRAND_NAME}}", branding.publicBrandName],
        ["{{LEGAL_SERVICE_NAME}}", branding.legalServiceName],
        ["{{LEGAL_ENTITY_NAME}}", branding.legalEntityName],
        ["{{SERVICE_SLUG}}", branding.serviceSlug],
        ["{{PUBLIC_ORIGIN}}", branding.publicOrigin],
        ["{{API_ORIGIN}}", branding.apiOrigin],
        ["{{PUBLIC_HOST}}", branding.publicHost],
        ["{{API_HOST}}", branding.apiHost],
        ["{{SUPPORT_EMAIL}}", branding.supportEmail],
        ["{{PRIVACY_EMAIL}}", branding.privacyEmail],
        ["{{CONTACT_EMAIL}}", branding.contactEmail],
        ["{{COPYRIGHT_NAME}}", branding.copyrightName],
        ["{{OG_IMAGE_URL}}", branding.ogImageUrl],
        ["{{APP_TITLE}}", branding.appTitle],
        ["{{APP_DESCRIPTION}}", branding.appDescription],
    ];
}

export function applyBrandingText(value: string): string {
    let output = value;

    for (const [from, to] of getReplacements()) {
        if (!from || from === to) {
            continue;
        }

        output = output.split(from).join(to);
    }

    return output;
}

export function applyBrandingMessages<T extends JsonLike>(value: T): T {
    if (typeof value === "string") {
        return applyBrandingText(value) as T;
    }

    if (Array.isArray(value)) {
        return value.map((entry) => applyBrandingMessages(entry)) as T;
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [
                key,
                applyBrandingMessages(entry as JsonLike),
            ]),
        ) as T;
    }

    return value;
}

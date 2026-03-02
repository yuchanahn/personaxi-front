import { _ } from 'svelte-i18n';
import { get } from 'svelte/store';
import { toast } from '$lib/stores/toast';

/**
 * Maps standard backend error codes (e.g. ERR_INSUFFICIENT_CREDITS) to i18n messages.
 * If the error is a recognized code, it returns the translated message.
 * Otherwise, it attempts to translate the error string directly.
 * If translation is missing, it returns the original error string.
 */
export function mapErrorCode(errString: string): string {
    if (!errString) return "Unknown error";

    const t = get(_);

    // Check if it's a known error code (starts with ERR_ or matches a key in errors.*)
    const i18nKey = `errors.${errString}`;
    const translated = t(i18nKey);

    // If the translation exists and is not just the key itself, return it.
    if (translated && translated !== i18nKey) {
        return translated as string;
    }

    // Try to translate as raw string if it perfectly matches another key (fallback)
    const rawTranslated = t(`errors.${errString.replace(/\s+/g, '_')}`);
    if (rawTranslated && rawTranslated !== `errors.${errString.replace(/\s+/g, '_')}`) {
        return rawTranslated as string;
    }

    // Return original if no translation
    return errString;
}

/**
 * Convenience function to show a localized error toast.
 * @param err The error message, error code, or Error object thrown.
 */
export function toastError(err: Error | string) {
    let errString = "";
    if (err instanceof Error) {
        errString = err.message;
    } else {
        errString = String(err);
    }
    toast.error(mapErrorCode(errString));
}

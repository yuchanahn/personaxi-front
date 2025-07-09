import { init, register, getLocaleFromNavigator } from 'svelte-i18n';
import { initFetchOverride } from "$lib/fetchOverride";

initFetchOverride();

register('en', () => import('$lib/i18n/locales/en.json'));
register('ko', () => import('$lib/i18n/locales/ko.json'));

export async function load() {
    await init({
        fallbackLocale: 'en',
        initialLocale: getLocaleFromNavigator(),
    });

    console.log("Svelte i18n initialized!!");
}

export const ssr = false
export const csr = true
export const prerender = false
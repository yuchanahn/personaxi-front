import { init, register, locale } from 'svelte-i18n';
import { settings } from '$lib/stores/settings';
import { get } from 'svelte/store';

register('en', () => import('$lib/i18n/locales/en.json'));
register('ko', () => import('$lib/i18n/locales/ko.json'));

const initialLocale = get(settings).language;

init({
    fallbackLocale: 'en',
    initialLocale: initialLocale,
});

settings.subscribe((s) => {
    locale.set(s.language);
    document.body.dataset.theme = s.theme;
});
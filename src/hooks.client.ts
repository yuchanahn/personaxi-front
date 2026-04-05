import { init, register, locale } from 'svelte-i18n';
import { settings } from '$lib/stores/settings';
import { get } from 'svelte/store';
import { applyBrandingMessages } from '$lib/branding/placeholders';

register('en', () =>
    import('$lib/i18n/locales/en.json').then((module) =>
        applyBrandingMessages(module.default),
    ),
);
register('ko', () =>
    import('$lib/i18n/locales/ko.json').then((module) =>
        applyBrandingMessages(module.default),
    ),
);
register('ja', () =>
    import('$lib/i18n/locales/ja.json').then((module) =>
        applyBrandingMessages(module.default),
    ),
);

const initialLocale = get(settings).language;

init({
    fallbackLocale: 'en',
    initialLocale: initialLocale,
});

settings.subscribe((s) => {
    locale.set(s.language);
    document.body.dataset.theme = s.theme;
});

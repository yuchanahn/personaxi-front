import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';
export type Language = 'ko' | 'en';
export type FontSize = 'medium' | 'large';

export interface AppSettings {
    theme: Theme;
    language: Language;
    fontSize: FontSize;
    enterToSend: boolean;
    soundVolume: number;
}

function isValidTheme(value: any): value is Theme {
    return value === 'light' || value === 'dark';
}
function isValidLanguage(value: any): value is Language {
    return value === 'ko' || value === 'en';
}
function isValidFontSize(value: any): value is FontSize {
    return value === 'medium' || value === 'large';
}

function initializeSettings(): AppSettings {
    let settings: AppSettings = {
        theme: 'light',
        language: 'ko',
        fontSize: 'medium',
        enterToSend: true,
        soundVolume: 0.8
    };

    if (!browser) {
        return settings;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    settings.theme = prefersDark ? 'dark' : 'light';
    settings.language = navigator.language.startsWith('ko') ? 'ko' : 'en';

    const savedSettingsJSON = window.localStorage.getItem('app-settings');
    if (savedSettingsJSON) {
        try {
            const savedSettings = JSON.parse(savedSettingsJSON);

            if (isValidTheme(savedSettings.theme)) {
                settings.theme = savedSettings.theme;
            }
            if (isValidLanguage(savedSettings.language)) {
                settings.language = savedSettings.language;
            }
            if (isValidFontSize(savedSettings.fontSize)) {
                settings.fontSize = savedSettings.fontSize;
            }
            if (typeof savedSettings.enterToSend === 'boolean') {
                settings.enterToSend = savedSettings.enterToSend;
            }
            if (typeof savedSettings.soundVolume === 'number') {
                settings.soundVolume = savedSettings.soundVolume;
            }
        } catch (e) {
            console.error("Failed to parse settings from localStorage", e);
        }
    }

    return settings;
}

function createSettingsStore() {
    const initialSettings = initializeSettings();
    const { subscribe, set, update } = writable<AppSettings>(initialSettings);

    return {
        subscribe,
        set: (value: AppSettings) => {
            if (browser) {
                window.localStorage.setItem('app-settings', JSON.stringify(value));
            }
            set(value);
        },
        update
    };
}

export const settings = createSettingsStore();

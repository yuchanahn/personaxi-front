import { init, register, getLocaleFromNavigator, locales, locale } from 'svelte-i18n';
//import { initFetchOverride } from "$lib/fetchOverride";
import { get } from 'svelte/store';

//initFetchOverride();

register('en', () => import('$lib/i18n/locales/en.json'));
register('ko', () => import('$lib/i18n/locales/ko.json'));


async function getMyIpInfo() {
    try {
        // ipinfo.io 서비스에 요청을 보냅니다.
        const response = await fetch('https://ipinfo.io/json');

        if (!response.ok) {
            throw new Error('IP 정보를 가져오는데 실패했습니다.');
        }

        const data = await response.json();

        return data;

    } catch (error) {
        console.error('에러 발생:', error);
        return null;
    }
}

const map_localeToCountry = {
    'US': 'en',
    'KR': 'ko'
}

const map_browserLocaleToCountry = {
    'en-US': 'en',
    'ko-KR': 'ko'
}

export async function load() {
    try {
        const loc = await getMyIpInfo();
        let _locale = 'en'; // 기본값
        if (loc === null) {
            console.warn("Failed to get IP info, using default locale 'en'");
            _locale = 'en';
        } else {
            _locale = map_localeToCountry[loc.country as keyof typeof map_localeToCountry] || 'en';
        }

        let browserLocale = getLocaleFromNavigator() || 'en-US'; // 기본값
        if (browserLocale in map_browserLocaleToCountry) {
            browserLocale = map_browserLocaleToCountry[browserLocale as keyof typeof map_browserLocaleToCountry] || _locale;
        }

        let locale__ = get(locale);

        if (locale__ !== null) {
            console.log("Available locales:", locale__);
        }

        locale.subscribe((value) => {
            console.log("Current locales:", value);
        });

        await init({
            fallbackLocale: _locale,
            initialLocale: browserLocale,
        });

        console.log("fallbackLocale : ", _locale);
        console.log("initialLocale : ", browserLocale);

    }
    catch (e) {
        console.error("레이아웃 로드 중 심각한 에러 발생:", e);
    }

    return {}
}

export const ssr = false
export const csr = true
export const prerender = false
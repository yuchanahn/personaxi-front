import { browser } from "$app/environment";
import { env } from "$env/dynamic/public";
import { supabase } from "$lib/supabase";
import { Capacitor } from "@capacitor/core";
import type {
    InitializeOptions,
    SocialLoginPlugin,
} from "@capgo/capacitor-social-login";

type SocialProvider = "google" | "kakao";

export type SocialLoginMode = "native-session" | "web-redirect";

const ANDROID_APP_SCHEME = "com.personaxi.app";
const KAKAO_PROVIDER_ID = "kakao";
const DEFAULT_NATIVE_OAUTH_REDIRECT_URL = `${ANDROID_APP_SCHEME}://login-callback/`;
const KAKAO_ISSUER_URL = "https://kauth.kakao.com";
const KAKAO_AUTHORIZATION_URL = "https://kauth.kakao.com/oauth/authorize";
const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const DEFAULT_KAKAO_NATIVE_REDIRECT_URL = `${ANDROID_APP_SCHEME}://oauth/kakao`;
const DEFAULT_KAKAO_SCOPE = "openid profile_nickname profile_image account_email";
const NATIVE_GOOGLE_LOGIN_TIMEOUT_MS = 60000;

let nativeSocialLoginInitPromise: Promise<void> | null = null;
let nativeOAuthListenerCleanup: (() => void) | null = null;
let nativeOAuthExchangePromise: Promise<boolean> | null = null;

function isNativeAndroid() {
    return (
        browser &&
        Capacitor.isNativePlatform() &&
        Capacitor.getPlatform() === "android"
    );
}

function getGoogleWebClientId() {
    return env.PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || "";
}

function getNativeOAuthRedirectUrl() {
    return (
        env.PUBLIC_NATIVE_AUTH_REDIRECT_URL?.trim() ||
        DEFAULT_NATIVE_OAUTH_REDIRECT_URL
    );
}

function getKakaoRestApiKey() {
    return (
        env.PUBLIC_KAKAO_NATIVE_REST_API_KEY?.trim() ||
        env.PUBLIC_KAKAO_REST_API_KEY?.trim() ||
        ""
    );
}

function getKakaoRedirectUrl() {
    return (
        env.PUBLIC_KAKAO_NATIVE_REDIRECT_URL?.trim() ||
        DEFAULT_KAKAO_NATIVE_REDIRECT_URL
    );
}

function getKakaoScope() {
    return env.PUBLIC_KAKAO_NATIVE_SCOPE?.trim() || DEFAULT_KAKAO_SCOPE;
}

async function importSocialLoginModule(): Promise<{
    SocialLogin: SocialLoginPlugin;
}> {
    return import("@capgo/capacitor-social-login");
}

async function importCapacitorBrowser() {
    return import("@capacitor/browser");
}

async function importCapacitorApp() {
    return import("@capacitor/app");
}

function isPluginNotImplementedError(error: unknown) {
    return (
        error instanceof Error &&
        error.message.toLowerCase().includes("not implemented")
    );
}

async function initializeNativeSocialLogin() {
    if (!isNativeAndroid()) return;

    if (nativeSocialLoginInitPromise) {
        return nativeSocialLoginInitPromise;
    }

    nativeSocialLoginInitPromise = (async () => {
        const googleWebClientId = getGoogleWebClientId();
        const kakaoRestApiKey = getKakaoRestApiKey();

        const options: InitializeOptions = {};

        if (googleWebClientId) {
            options.google = {
                webClientId: googleWebClientId,
                mode: "online",
            };
        }

        if (kakaoRestApiKey) {
            options.oauth2 = {
                [KAKAO_PROVIDER_ID]: {
                    appId: kakaoRestApiKey,
                    issuerUrl: KAKAO_ISSUER_URL,
                    authorizationBaseUrl: KAKAO_AUTHORIZATION_URL,
                    accessTokenEndpoint: KAKAO_TOKEN_URL,
                    redirectUrl: getKakaoRedirectUrl(),
                    scope: getKakaoScope(),
                    pkceEnabled: true,
                },
            };
        }

        if (Object.keys(options).length === 0) {
            return;
        }

        const { SocialLogin } = await importSocialLoginModule();
        await SocialLogin.initialize(options);
    })().catch((error) => {
        nativeSocialLoginInitPromise = null;
        throw error;
    });

    return nativeSocialLoginInitPromise;
}

async function signInWithSupabaseIdToken(
    provider: SocialProvider,
    token: string,
    accessToken?: string,
) {
    const payload = {
        provider,
        token,
        ...(accessToken ? { access_token: accessToken } : {}),
    };

    const { error } = await supabase.auth.signInWithIdToken(payload);
    if (error) {
        console.error(`${provider} signInWithIdToken failed`, error);
        throw error;
    }

    console.log(`${provider} signInWithIdToken succeeded`);
}

async function signInWithWebOAuth(provider: SocialProvider) {
    const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${window.location.origin}/hub`,
        },
    });

    if (error) {
        throw error;
    }

    return "web-redirect" as const;
}

function urlsMatchForNativeOAuth(incomingUrl: string) {
    try {
        const incoming = new URL(incomingUrl);
        const redirect = new URL(getNativeOAuthRedirectUrl());

        const normalizePath = (path: string) =>
            path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;

        return (
            incoming.protocol === redirect.protocol &&
            incoming.host === redirect.host &&
            normalizePath(incoming.pathname) ===
                normalizePath(redirect.pathname)
        );
    } catch {
        return false;
    }
}

async function exchangeNativeOAuthUrl(url: string) {
    if (!urlsMatchForNativeOAuth(url)) {
        return false;
    }

    const callbackUrl = new URL(url);
    const queryParams = callbackUrl.searchParams;
    const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ""));

    const authError =
        queryParams.get("error_description") ||
        queryParams.get("error") ||
        hashParams.get("error_description") ||
        hashParams.get("error");

    if (authError) {
        throw new Error(authError);
    }

    const authCode = queryParams.get("code");
    if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (error) {
            throw error;
        }
        return true;
    }

    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        });
        if (error) {
            throw error;
        }
        return true;
    }

    throw new Error("OAuth callback did not include a code or session tokens.");
}

async function openNativeOAuthBrowser(url: string) {
    if (!Capacitor.isPluginAvailable("Browser")) {
        window.location.assign(url);
        return;
    }

    try {
        const { Browser } = await importCapacitorBrowser();
        await Browser.open({
            url,
        });
    } catch (error) {
        if (!isPluginNotImplementedError(error)) {
            throw error;
        }

        console.warn(
            "Capacitor Browser plugin is unavailable on this Android build. Falling back to WebView navigation.",
            error,
        );

        window.location.assign(url);
    }
}

async function signInWithNativeWebOAuth(provider: SocialProvider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: getNativeOAuthRedirectUrl(),
            skipBrowserRedirect: true,
        },
    });

    if (error) {
        throw error;
    }

    if (!data?.url) {
        throw new Error(`${provider} OAuth URL was not returned.`);
    }

    await openNativeOAuthBrowser(data.url);

    return "web-redirect" as const;
}

async function withTimeout<T>(
    work: () => Promise<T>,
    timeoutMs: number,
    message: string,
) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(message));
        }, timeoutMs);
    });

    try {
        const workPromise = (async () => await work())();
        return await Promise.race([workPromise, timeoutPromise]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

function explainGoogleFailure(error: unknown) {
    if (!(error instanceof Error)) {
        return "Google native login failed.";
    }

    if (error.message.includes("timed out")) {
        return "Google native login timed out. Choose a Google account and complete the sheet, or cancel and try again.";
    }

    if (error.message.includes("No credentials available")) {
        return "No Google account is available on this device. Add one in Settings > Passwords & accounts, then try again.";
    }

    return error.message;
}

async function loginWithNativeGoogle() {
    const googleWebClientId = getGoogleWebClientId();
    if (!googleWebClientId) {
        throw new Error(
            "Google native login is not configured. Set PUBLIC_GOOGLE_WEB_CLIENT_ID first.",
        );
    }

    await initializeNativeSocialLogin();

    try {
        const { SocialLogin } = await importSocialLoginModule();
        const response = await withTimeout(
            () =>
                SocialLogin.login({
                    provider: "google",
                    options: {
                        filterByAuthorizedAccounts: false,
                        autoSelectEnabled: false,
                    },
                }),
            NATIVE_GOOGLE_LOGIN_TIMEOUT_MS,
            "Google native login timed out.",
        );

        if (response.result.responseType !== "online" || !response.result.idToken) {
            throw new Error("Google native login did not return an ID token.");
        }

        await signInWithSupabaseIdToken(
            "google",
            response.result.idToken,
            response.result.accessToken?.token,
        );

        return "native-session" as const;
    } catch (error) {
        console.error("Google native login failed", error);
        throw new Error(explainGoogleFailure(error));
    }
}

function explainKakaoFailure(error: unknown) {
    if (!(error instanceof Error)) {
        return "Kakao native login failed.";
    }

    if (error.message.includes("Unacceptable audience")) {
        return "Kakao id_token audience does not match the current Supabase Kakao provider. Use Kakao REST API key based OIDC, not the native app key flow.";
    }

    if (error.message.includes("invalid_client")) {
        return "Kakao token exchange failed. Check the REST API key, redirect URI, and whether client secret is blocking public-client OIDC.";
    }

    return error.message;
}

async function loginWithNativeKakao() {
    const kakaoRestApiKey = getKakaoRestApiKey();
    if (!kakaoRestApiKey) {
        throw new Error(
            "Kakao native login is not configured. Set PUBLIC_KAKAO_NATIVE_REST_API_KEY first.",
        );
    }

    await initializeNativeSocialLogin();

    try {
        const { SocialLogin } = await importSocialLoginModule();
        const response = await SocialLogin.login({
            provider: "oauth2",
            options: {
                providerId: KAKAO_PROVIDER_ID,
            },
        });

        if (!response.result.idToken) {
            throw new Error(
                "Kakao did not return an id_token. Enable OpenID Connect in Kakao Developers and keep openid in scope.",
            );
        }

        await signInWithSupabaseIdToken(
            "kakao",
            response.result.idToken,
            response.result.accessToken?.token,
        );

        return "native-session" as const;
    } catch (error) {
        console.error("Kakao native login failed", error);
        throw new Error(explainKakaoFailure(error));
    }
}

function explainNativeOAuthFailure(error: unknown) {
    if (!(error instanceof Error)) {
        return "OAuth login failed.";
    }

    return error.message;
}

export async function registerNativeOAuthRedirectHandler(options?: {
    onSuccess?: () => void;
    onError?: (message: string) => void;
}) {
    if (!isNativeAndroid()) {
        return () => {};
    }

    if (nativeOAuthListenerCleanup) {
        return nativeOAuthListenerCleanup;
    }

    const { App } = await importCapacitorApp();

    const handleUrl = async (url: string) => {
        if (nativeOAuthExchangePromise) {
            return nativeOAuthExchangePromise;
        }

        nativeOAuthExchangePromise = (async () => {
            try {
                const handled = await exchangeNativeOAuthUrl(url);
                if (handled) {
                    options?.onSuccess?.();
                }
                return handled;
            } catch (error) {
                const message = explainNativeOAuthFailure(error);
                options?.onError?.(message);
                return false;
            } finally {
                nativeOAuthExchangePromise = null;
            }
        })();

        return nativeOAuthExchangePromise;
    };

    const listener = await App.addListener("appUrlOpen", (event) => {
        void handleUrl(event.url);
    });

    const launchUrl = await App.getLaunchUrl();
    if (launchUrl?.url) {
        void handleUrl(launchUrl.url);
    }

    nativeOAuthListenerCleanup = () => {
        void listener.remove();
        nativeOAuthListenerCleanup = null;
    };

    return nativeOAuthListenerCleanup;
}

export async function loginWithGoogle(): Promise<SocialLoginMode> {
    if (isNativeAndroid()) {
        return loginWithNativeGoogle();
    }

    return signInWithWebOAuth("google");
}

export async function loginWithKakao(): Promise<SocialLoginMode> {
    if (isNativeAndroid()) {
        return signInWithNativeWebOAuth("kakao");
    }

    return signInWithWebOAuth("kakao");
}

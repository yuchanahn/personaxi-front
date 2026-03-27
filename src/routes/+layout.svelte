<!-- src/routes/+layout.svelte -->
<script lang="ts">
    /* ────────────── 글로벌 스타일 및 공통 CSS ────────────── */
    import "../app.css";

    /* ────────────── 레이아웃 구성 요소 ────────────── */
    import Sidebar from "$lib/components/sidebar/Sidebar.svelte";
    import NavBottom from "$lib/components/Nav/NavBottom.svelte";
    import CheatConsole from "$lib/components/cheat/CheatConsole.svelte";
    import { settings, type Language } from "$lib/stores/settings";
    /* ────────────── 모달들 ────────────── */
    import NeedMoreNeuronsModal from "$lib/components/modal/NeedMoreNeuronsModal.svelte";
    import ConsentModal from "$lib/components/modal/ConsentModal.svelte";
    import WelcomeModal from "$lib/components/modal/WelcomeModal.svelte";
    import AuthLoginModal from "$lib/components/modal/AuthLoginModal.svelte";
    import ToastContainer from "$lib/components/ui/toast/ToastContainer.svelte";
    import ConfirmModal from "$lib/components/ui/ConfirmModal.svelte";

    /* ────────────── API · 스토어 ────────────── */
    import { loadCharacterSessions } from "$lib/api/sessions";
    import { confirmConsent, getCurrentUser } from "$lib/api/auth";
    import { st_user } from "$lib/stores/user";

    import {
        needMoreNeuronsModal,
        closeNeedMoreNeuronsModal,
    } from "$lib/stores/modal";
    import { pricingStore } from "$lib/stores/pricing";
    import { notificationStore } from "$lib/stores/notification";

    /* ────────────── SvelteKit 내장 ────────────── */
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import Icon from "@iconify/svelte";
    import { slide } from "svelte/transition";
    import { accessToken } from "$lib/stores/auth";
    import { locale, t } from "svelte-i18n";
    import { get } from "svelte/store";
    import { api } from "$lib/api";
    import { toast } from "$lib/stores/toast";
    import type { User } from "$lib/types";

    import { supabase } from "$lib/supabase";
    import {
        authRenderVersion,
        consumeAuthGateSuccess,
        bumpAuthRenderVersion,
    } from "$lib/stores/authGate";
    import { scheduleGoogleTagManager } from "$lib/utils/googleTagManager";

    import { hideBackButton } from "$lib/utils/LayoutUtils";

    /* ────────────── 화면 크기 감지 ────────────── */
    let isMobile = false;
    if (browser) {
        const mq = window.matchMedia("(max-width: 768px)");
        isMobile = mq.matches;
        mq.addEventListener("change", (e) => (isMobile = e.matches));
    }

    /* ────────────── 상태 변수 ────────────── */
    let showCheatConsole = false;
    let consentModal = false;
    let welcomeModal = false;
    let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSyncedSettingsPayload = "";
    let bootstrappedUserToken: string | null = null;
    let bootstrappedUserPromise: Promise<User | null> | null = null;
    let initializedNotificationUserId = "";

    function syncUserLanguage(user: User) {
        if (user.data.language === "") {
            settings.update((s) => {
                s.language = (get(locale) as Language) || "en";
                return { ...s };
            });
        } else if (user.data.language !== get(locale)) {
            settings.update((s) => {
                s.language = user.data.language as Language;
                return { ...s };
            });
        }
    }

    function resetAuthenticatedBootstrap() {
        bootstrappedUserToken = null;
        bootstrappedUserPromise = null;
        initializedNotificationUserId = "";
    }

    async function bootstrapCurrentUser(force = false) {
        const token = get(accessToken);
        if (!token) return null;

        if (
            !force &&
            bootstrappedUserPromise &&
            bootstrappedUserToken === token
        ) {
            return bootstrappedUserPromise;
        }

        bootstrappedUserToken = token;
        bootstrappedUserPromise = (async () => {
            const user = (await getCurrentUser()) as User | null;
            if (user) {
                if (user.state === "new") {
                    consentModal = true;
                }
                syncUserLanguage(user);
            }
            return user;
        })();

        const user = await bootstrappedUserPromise;
        if (!user) {
            resetAuthenticatedBootstrap();
        }

        return user;
    }

    /* ────────────── 인증 확인 ────────────── */
    onMount(() => {
        if (!browser) return;

        if ("serviceWorker" in navigator) {
            window.addEventListener("load", () => {
                navigator.serviceWorker
                    .register("/service-worker.js")
                    .catch((e) => {
                        console.error("Service Worker registration failed:", e);
                    });
            });
        }

        // Global chat error handler — show toast when LLM fails
        const handleChatError = (e: CustomEvent) => {
            toast.error(
                e.detail?.message ||
                    get(t)("common.tryAgainError", {
                        default: "Something went wrong. Please try again.",
                    }),
            );
        };
        window.addEventListener("chat-error", handleChatError as EventListener);
        const cleanupGoogleTagManager =
            scheduleGoogleTagManager("GTM-N3KH9NL7");

        // pricingStore.fetchPricingPolicy() — called in accessToken.subscribe, no duplicate needed

        // 1. 초기 세션 로드
        void supabase.auth.getSession().then(({ data: { session } }) => {
            accessToken.set(session?.access_token ?? null);
        });

        // 2. Auth 상태 변경 감지
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("[AUTH] onAuthStateChange", {
                event,
                hasSession: !!session,
            });

            if (session) {
                accessToken.set(session.access_token);

                const completedAuthRequest = consumeAuthGateSuccess();
                console.log(
                    "[LAYOUT] consumeAuthGateSuccess",
                    completedAuthRequest,
                );

                if (completedAuthRequest?.returnTo) {
                    const currentUrl =
                        `${window.location.pathname}${window.location.search}${window.location.hash}` ||
                        "/hub";

                    console.log("[LAYOUT] auth returnTo compare", {
                        returnTo: completedAuthRequest.returnTo,
                        currentUrl,
                    });

                    if (completedAuthRequest.returnTo !== currentUrl) {
                        console.log("[LAYOUT] goto returnTo");
                        void goto(completedAuthRequest.returnTo, {
                            replaceState: true,
                        });
                    }
                }
                return;
            }

            resetAuthenticatedBootstrap();
            accessToken.set(null);

            if (event === "SIGNED_OUT") {
                bumpAuthRenderVersion();
            }
        });

        return () => {
            window.removeEventListener(
                "chat-error",
                handleChatError as EventListener,
            );
            cleanupGoogleTagManager();
            subscription.unsubscribe();
        };
    });

    // 3. Payment Redirect Handler (Mobile Support)
    onMount(async () => {
        if (!browser) return;
        const urlParams = new URLSearchParams(window.location.search);
        const paymentId = urlParams.get("paymentId");

        // If returning from PortOne payment
        if (paymentId) {
            const code = urlParams.get("code");
            const message = urlParams.get("message");
            const decodedMessage = message ? decodeURIComponent(message) : "";

            // Remove params from URL without reload
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, newUrl);

            // Check for error code (PortOne V2 returns code on failure/cancellation)
            if (code) {
                console.error("Payment Error Redirect:", code, decodedMessage);
                toast.error(
                    decodedMessage ||
                        get(t)("shop.payment_failed", {
                            default: "Payment failed.",
                        }),
                );
                closeNeedMoreNeuronsModal();
                return;
            }

            // Success handling
            const user = await getCurrentUser();
            if (user) {
                st_user.set(user);
                toast.success(
                    get(t)("shop.payment_complete_toast", {
                        default: "Payment verified! Neurons added.",
                    }),
                );

                // If the modal was open (state preserved?), close it.
                // But full reload might have reset stores.
                closeNeedMoreNeuronsModal();
            }
        }
    });

    accessToken.subscribe(async (token) => {
        if (!token) {
            resetAuthenticatedBootstrap();
            return;
        }

        // Fetch pricing policy as soon as we have a token
        pricingStore.fetchPricingPolicy();

        const user = await bootstrapCurrentUser();
        if (token !== get(accessToken)) {
            return;
        }

        loadCharacterSessions();

        if (user) {
            if (initializedNotificationUserId !== user.id) {
                notificationStore.init(user.id);
                initializedNotificationUserId = user.id;
            }
        }
    });

    settings.subscribe((currentSettings) => {
        if (!browser || get(accessToken) === null) return;

        const user = get(st_user) as User | null;
        if (!user) return;

        const settingRq: any = {
            name: user.name,
            nickname: user.data?.nickname || "",
            language:
                currentSettings.language || (get(locale) as Language) || "en",
            llmType: currentSettings.llmType,
            safetyFilterOn: currentSettings.safetyFilterOn,
        };

        const payloadKey = JSON.stringify(settingRq);
        if (payloadKey === lastSyncedSettingsPayload) {
            return;
        }

        if (settingsSaveTimer) {
            clearTimeout(settingsSaveTimer);
        }

        settingsSaveTimer = setTimeout(async () => {
            const res = await api.post(`/api/user/edit`, settingRq);
            if (res.ok) {
                lastSyncedSettingsPayload = payloadKey;
            }
        }, 300);
    });

    function handleBack() {
        if (history.length <= 1) {
            goto("/hub");
        } else {
            history.back();
        }
    }

    $: isChatPage = ["/2d", "/character", "/live2d", "/feed"].includes(
        $page.url.pathname,
    );
    $: showNavBottom =
        isMobile &&
        ![
            "/test",
            "/2d",
            "/character",
            "/",
            "/live2d",
            "/maintenance",
        ].includes($page.url.pathname) &&
        !$page.url.pathname.startsWith("/test/");
</script>

<!-- ────────────── 레이아웃 ────────────── -->
<div class="layout">
    {#if !isMobile && $page.url.pathname !== "/maintenance"}
        <Sidebar /> <!-- 모바일에선 아예 렌더하지 않는다 -->
    {/if}

    <main class:no-padding-bottom={isChatPage} class="no-scrollbar">
        <!-- access_token -->
        {#key `${$authRenderVersion}`}
            <slot />
        {/key}

        <CheatConsole
            isVisible={showCheatConsole}
            on:close={() => (showCheatConsole = false)}
        />
    </main>

    {#if showNavBottom}
        <div
            class="nav-bottom-wrapper"
            transition:slide={{ duration: 300, axis: "y" }}
        >
            <NavBottom />
        </div>
    {/if}

    <!-- ────────────── 모달 ────────────── -->
    <ConsentModal
        isOpen={consentModal}
        on:confirm={async () => {
            const u = (await confirmConsent()) as User;
            st_user.set(u);

            consentModal = false;
            welcomeModal = true;
        }}
    />
    <WelcomeModal neuronAmount={100} isOpen={welcomeModal} />

    {#if !["/hub", "/", "/maintenance", "/payment/complete"].includes($page.url.pathname)}
        {#if !$hideBackButton}
            <button class="back-btn" on:click={handleBack}
                ><Icon icon="weui:back-filled" width="12" height="24" />
            </button>
        {/if}
    {/if}

    <!-- Global Charge Modal -->
    <NeedMoreNeuronsModal
        isOpen={$needMoreNeuronsModal.isOpen}
        isNeedNeurons={$needMoreNeuronsModal.isNeedNeurons}
        on:close={closeNeedMoreNeuronsModal}
    />

    <ToastContainer />
    <ConfirmModal />
    <AuthLoginModal />
</div>

<style>
    :global(html),
    :global(body) {
        margin: 0;
        overscroll-behavior: none;
        color: var(--color-text);
    }

    /* ────────────── 전체 레이아웃 (Grid로 수정) ────────────── */
    .layout {
        display: grid;
        position: fixed;
        grid-template-rows: 1fr auto;
        inset: 0;
        display: grid;
        overflow: hidden;
        height: 100dvh;
    }

    /* ────────────── 메인 영역 ────────────── */
    main {
        display: grid;
        position: relative;
        z-index: 1;
        grid-template-rows: 1fr auto;
        flex-direction: column;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        height: 100%;

        padding-bottom: calc(env(safe-area-inset-bottom, 0px));
        /*padding-bottom: calc(85px + 100px);*/
    }

    main:global(.no-padding-bottom) {
        padding-bottom: env(safe-area-inset-bottom, 0px);
        /* padding-bottom: 0; */
    }

    .back-btn {
        position: absolute;
        top: 10px;
        left: 10px;
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 8px;
        transition: background 0.2s ease;
        display: none;

        z-index: 99999;
    }

    @media (max-width: 768px) {
        .back-btn {
            display: block;
        }
    }
</style>

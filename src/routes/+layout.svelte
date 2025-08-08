<!-- src/routes/+layout.svelte -->
<script lang="ts">
    /* ────────────── 글로벌 스타일 및 공통 CSS ────────────── */
    import "../app.css";

    /* ────────────── 레이아웃 구성 요소 ────────────── */
    import Sidebar from "$lib/components/sidebar/Sidebar.svelte";
    import NavBottom from "$lib/components/Nav/NavBottom.svelte";
    import CheatConsole from "$lib/components/cheat/CheatConsole.svelte";
    import { settings } from "$lib/stores/settings";
    /* ────────────── 모달들 ────────────── */
    import NeedMoreNeuronsModal from "$lib/components/modal/NeedMoreNeuronsModal.svelte";
    import ConsentModal from "$lib/components/modal/ConsentModal.svelte";
    import WelcomeModal from "$lib/components/modal/WelcomeModal.svelte";

    /* ────────────── API · 스토어 ────────────── */
    import { loadCharacterSessions, loadChatSessions } from "$lib/api/sessions";
    import { confirmConsent, getCurrentUser } from "$lib/api/auth";
    import { st_user } from "$lib/stores/user";
    import { needMoreNeuronsModal } from "$lib/stores/modal";

    /* ────────────── SvelteKit 내장 ────────────── */
    import { onMount, tick } from "svelte";
    import { page } from "$app/stores";
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import Icon from "@iconify/svelte";
    import { slide } from "svelte/transition";
    import { accessToken } from "$lib/stores/auth";
    import { locale } from "svelte-i18n";
    import { get } from "svelte/store";
    import { api } from "$lib/api";
    import type { User } from "$lib/types";

    /* ────────────── PWA: Service Worker ────────────── */
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/service-worker.js").then(
                (r) => console.log("Service Worker registered:", r),
                (e) => console.error("Service Worker registration failed:", e),
            );
        });
    }

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

    /* ────────────── 인증 확인 ────────────── */
    onMount(async () => {
        if (!browser) return;
        if (["/login"].includes($page.url.pathname)) {
            return;
        }

        const hash = window.location.hash;
        if (hash.includes("access_token=")) {
            const token = new URLSearchParams(hash.substring(1)).get(
                "access_token",
            );
            if (token) {
                accessToken.set(token);
                window.history.replaceState(
                    null,
                    "",
                    window.location.pathname + window.location.search,
                );
                return;
            }
        }
        accessToken.set(null);
    });

    accessToken.subscribe(async (token) => {
        tick();
        if (!token) {
            return;
        }

        loadChatSessions();
        loadCharacterSessions();
    });

    settings.subscribe(async (settings) => {
        if (get(accessToken) === null) return;
        const userRes = await api.get(`/api/user/me`);
        if (userRes.ok) {
            let user = await userRes.json();

            if (!user.data) {
                user.data = {
                    nickname: user.name,
                    language: settings.language,
                    lastLoginAt: "",
                    createdAt: "",
                    hasReceivedFirstCreationReward: false,
                    lastLoginIP: "",
                };
            }

            const settingRq: any = {
                name: user.name,
                nickname: user.data.nickname || "",
                language: get(locale) || "en",
            };

            const res = await api.post(`/api/user/edit`, settingRq);
            if (res.ok) {
                console.log("최종 저장완료!");
            }
        }
    });

    function handleBack() {
        history.length > 1 ? history.back() : goto("/hub");
    }

    $: showNavBottom =
        isMobile &&
        !["/test", "/2d", "/character"].includes($page.url.pathname);

    $: isChatPage =
        $page.url.pathname.startsWith("/2d") ||
        $page.url.pathname.startsWith("/character");
</script>

<!-- ────────────── 레이아웃 ────────────── -->
<div class="layout">
    {#if !isMobile}
        <Sidebar /> <!-- 모바일에선 아예 렌더하지 않는다 -->
    {/if}

    <main class:no-padding-bottom={isChatPage}>
        <slot />

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
    <NeedMoreNeuronsModal
        bind:isOpen={$needMoreNeuronsModal}
        isNeedNeurons={true}
    />
    <ConsentModal
        isOpen={consentModal}
        on:confirm={async () => {
            const u = (await confirmConsent()) as User;
            st_user.set(u);

            consentModal = false;
            welcomeModal = true;
        }}
    />
    <WelcomeModal neuronAmount={200} isOpen={welcomeModal} />

    {#if !["/hub", "/"].includes($page.url.pathname)}
        <button class="back-btn" on:click={handleBack}
            ><Icon icon="weui:back-filled" width="12" height="24" />
        </button>
    {/if}
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
        height: 100vh;
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

        /* padding-bottom: calc(85px + env(safe-area-inset-bottom, 0px)); */
        padding-bottom: calc(85px + 100px);
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

    .back-btn:hover {
        background: #ffffff18;
    }
</style>

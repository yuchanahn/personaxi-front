<!-- src/routes/+layout.svelte -->
<script lang="ts">
    /* ────────────── 글로벌 스타일 및 공통 CSS ────────────── */
    import "$lib/styles/theme.css";
    import "../app.css";

    /* ────────────── 레이아웃 구성 요소 ────────────── */
    import Sidebar from "$lib/components/sidebar/Sidebar.svelte";
    import NavBottom from "$lib/components/Nav/NavBottom.svelte";
    import CheatConsole from "$lib/components/cheat/CheatConsole.svelte";
    import Login from "$lib/components/login/login.svelte";

    /* ────────────── 모달들 ────────────── */
    import NeedMoreNeuronsModal from "$lib/components/modal/NeedMoreNeuronsModal.svelte";
    import ConsentModal from "$lib/components/modal/ConsentModal.svelte";
    import WelcomeModal from "$lib/components/modal/WelcomeModal.svelte";

    /* ────────────── API · 스토어 ────────────── */
    import { loadCharacterSessions, loadChatSessions } from "$lib/api/sessions";
    import { confirmConsent, getCurrentUser } from "$lib/api/auth";
    import { is_login, st_user } from "$lib/stores/user";
    import { needMoreNeuronsModal } from "$lib/stores/modal";
    import { theme } from "$lib/stores/themeStore";
    import type { User } from "$lib/types";

    /* ────────────── SvelteKit 내장 ────────────── */
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import Icon from "@iconify/svelte";

    /* ────────────── PWA: Service Worker ────────────── */
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/service-worker.js").then(
                (r) => console.log("Service Worker registered:", r),
                (e) => console.error("Service Worker registration failed:", e),
            );
        });
    }

    /* ────────────── 테마 (다크/라이트/시스템) ────────────── */
    $: if (browser) {
        const prefersDark = window.matchMedia(
            "(prefers-color-scheme: dark)",
        ).matches;
        const html = document.documentElement;
        if ($theme === "dark" || ($theme === "system" && prefersDark)) {
            html.classList.add("dark");
        } else {
            html.classList.remove("dark");
        }
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
        try {
            const user = (await getCurrentUser()) as User | null;
            if (!user) {
                is_login.set(false);
                return;
            }
            st_user.set(user);
            if (user.state === "new") consentModal = true;
        } catch {
            is_login.set(false);
        }
    });

    /* ────────────── 로그인 후 세션 로드 ────────────── */
    $: if ($is_login) {
        loadChatSessions();
        loadCharacterSessions();
    }

    function handleBack() {
        history.length > 1 ? history.back() : goto("/hub");
    }
</script>

<!-- ────────────── 레이아웃 ────────────── -->
<div class="layout">
    {#if !isMobile}
        <Sidebar /> <!-- 모바일에선 아예 렌더하지 않는다 -->
    {/if}

    <main>
        {#if !$is_login && !["/hub", "/feed", "/profile", "/"].includes($page.url.pathname)}
            <Login />
        {:else}
            <slot />
        {/if}

        <CheatConsole
            isVisible={showCheatConsole}
            on:close={() => (showCheatConsole = false)}
        />
    </main>

    {#if isMobile}
        <NavBottom />
    {/if}

    <!-- ────────────── 모달 ────────────── -->
    <NeedMoreNeuronsModal
        bind:isOpen={$needMoreNeuronsModal}
        isNeedNeurons={true}
    />
    <ConsentModal
        isOpen={consentModal}
        on:confirm={async () => {
            const u = await confirmConsent();
            st_user.set(u);
            consentModal = false;
            welcomeModal = true;
        }}
    />
    <WelcomeModal neuronAmount={200} isOpen={welcomeModal} />

    {#if !"/hub".includes($page.url.pathname)}
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
        background: var(--color-bg);
        color: var(--color-text);
        font-family: "Segoe UI", sans-serif;
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
        grid-template-rows: 1fr auto;
        flex-direction: column;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        height: 100%;
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

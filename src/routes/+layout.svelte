
<script lang="ts">
    import "$lib/styles/theme.css"; // 이미 적용된 글로벌 CSS
    import Sidebar from "$lib/components/sidebar/Sidebar.svelte"; // 사이드바 컴포넌트
    import { loadCharacterSessions, loadChatSessions } from "$lib/api/sessions";
    import { is_login, st_user } from "$lib/stores/user";
    import { onMount } from "svelte";
    import Login from "$lib/components/login/login.svelte";
    import { confirmConsent, getCurrentUser } from "$lib/api/auth";
    import "../app.css";
    import CheatConsole from "$lib/components/cheat/CheatConsole.svelte"; // 치트 콘솔 컴포넌트 임포트
    import { page } from "$app/stores"; // 현재 페이지 정보 가져오기
    import NeedMoreNeuronsModal from "$lib/components/modal/NeedMoreNeuronsModal.svelte";
    import { needMoreNeuronsModal } from "$lib/stores/modal";
    import type { User } from "$lib/types";
    import ConsentModal from "$lib/components/modal/ConsentModal.svelte";
    import WelcomeModal from "$lib/components/modal/WelcomeModal.svelte";
    import { theme } from "$lib/stores/themeStore";
    import { browser } from "$app/environment";

    // theme 스토어 값이 바뀌거나, OS의 다크 모드 설정이 바뀔 때마다 실행되는 반응형 로직
    $: {
        if (browser) {
            const doc = document.documentElement;
            // OS 설정을 확인하기 위한 변수
            const prefersDark = window.matchMedia(
                "(prefers-color-scheme: dark)",
            ).matches;

            if ($theme === "dark" || ($theme === "system" && prefersDark)) {
                doc.classList.add("dark");
            } else {
                doc.classList.remove("dark");
            }
        }
    }
    let showCheatConsole = false; // 치트 콘솔 표시 여부
    let showSidebar = true; // 사이드바 표시 여부
    let consentModal = false;
    let welcomeModal = false;

    $: $page.url.pathname, (showSidebar = false);

    onMount(async () => {
        try {
            let user = (await getCurrentUser()) as User | null;
            if (user == null) {
                is_login.set(false);
                return;
            }
            st_user.set(user);
            if (user.state == "new") {
                consentModal = true;
            }
        } catch (error) {
            is_login.set(false);
        }
    });

    $: {
        const login = $is_login;
        if (login) {
            loadChatSessions();
            loadCharacterSessions();
        }
    }
</script>

<div class="layout">
    <Sidebar bind:showSidebar />
    <main>
        {#if !$is_login}
            <Login />
        {:else}
            <slot />
        {/if}
        <CheatConsole
            isVisible={showCheatConsole}
            on:close={() => (showCheatConsole = false)}
        />
    </main>

    
    <NeedMoreNeuronsModal
        bind:isOpen={$needMoreNeuronsModal}
        isNeedNeurons={true}
    />
    <ConsentModal
        isOpen={consentModal}
        on:confirm={async () => {
            const user_ = await confirmConsent();
            st_user.set(user_);
            consentModal = false;
            welcomeModal = true;
        }}
    />
    <WelcomeModal neuronAmount={200} isOpen={welcomeModal} />
</div>

<style>
    :global(body) {
        margin: 0;
        background: var(--color-bg);
        color: var(--color-text);
        font-family: "Segoe UI", sans-serif;
    }

    .layout {
        display: flex; /* 기본이 row, 그래서 Sidebar가 ‘옆’ */
        height: 100vh; /* min-height → height 로 정확히 고정 */
        overflow: hidden; /* 바깥 스크롤 차단 */
    }

    main {
        flex: 1 1 0;
        display: flex;
        flex-direction: column;
        min-height: 0; /* 내부 shrink 허용 (1 px 오버 방지) */
    }
</style>

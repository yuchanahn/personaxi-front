<!-- src/routes/+layout.svelte -->
<script lang="ts">
    import "$lib/styles/theme.css"; // 이미 적용된 글로벌 CSS
    import Sidebar from "$lib/components/sidebar/Sidebar.svelte"; // 사이드바 컴포넌트
    import { loadCharacterSessions, loadChatSessions } from "$lib/api/sessions";
    import { is_login } from "$lib/stores/user";
    import { onMount } from "svelte";
    import Login from "$lib/components/login/login.svelte";
    import { getCurrentUser } from "$lib/api/auth";
    import "../app.css";
    import CheatConsole from "$lib/components/cheat/CheatConsole.svelte"; // 치트 콘솔 컴포넌트 임포트
    import { page } from "$app/stores"; // 현재 페이지 정보 가져오기

    let showCheatConsole = false; // 치트 콘솔 표시 여부
    let showSidebar = true; // 사이드바 표시 여부

    $: $page.url.pathname, (showSidebar = false);

    onMount(async () => {
        console.log("login 시도");

        try {
            let user = await getCurrentUser();
            if (user == null) {
                console.log("login 실패 1");
                is_login.set(false);
                return;
            }
        } catch (error) {
            console.log("login 실패 2");
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

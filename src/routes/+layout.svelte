<!-- src/routes/+layout.svelte -->
<script lang="ts">
    import "$lib/styles/theme.css"; // 이미 적용된 글로벌 CSS
    import Sidebar from "$lib/components/sidebar/Sidebar.svelte"; // 사이드바 컴포넌트
    import { loadCharacterSessions, loadChatSessions } from "$lib/api/sessions";
    import { is_login } from "$lib/stores/user";
    import { onDestroy, onMount } from "svelte";
    import Login from "$lib/components/login/login.svelte";
    import { getCurrentUser } from "$lib/api/auth";
    import "../app.css";
    import CheatConsole from "$lib/components/cheat/CheatConsole.svelte"; // 치트 콘솔 컴포넌트 임포트
    import { page } from "$app/stores"; // 현재 페이지 정보 가져오기

    let showCheatConsole = false; // 치트 콘솔 표시 여부
    let showSidebar = true; // 사이드바 표시 여부

    $: $page.url.pathname, (showSidebar = false);

    onMount(async () => {
        let user = await getCurrentUser();
        if (user == null) {
            is_login.set(false);
            return;
        }
    });

    onDestroy(() => {
        // ✨ 컴포넌트 파괴 시 이벤트 리스너 제거 (메모리 누수 방지)
        window.removeEventListener("keydown", handleGlobalKeydown);
    });

    // ✨ 전역 키다운 핸들러
    function handleGlobalKeydown(event: KeyboardEvent) {
        // '`' (백틱) 키 또는 '~' 키를 누르면 콘솔 토글
        if (event.key === "`") {
            event.preventDefault(); // 기본 동작 방지 (텍스트 필드에 `가 입력되는 것 등)
            showCheatConsole = !showCheatConsole;

            console.log("Key Pressed");
        }
    }

    $: {
        const login = $is_login;
        if (login) {
            loadChatSessions();
            loadCharacterSessions();
        }
    }

    let currentYear = new Date().getFullYear(); // 현재 연도
</script>

<div class="layout">
    <Sidebar bind:showSidebar />
    <main>
        {#if !$is_login}
            <Login />
        {:else}
            <slot />
            <!-- 하위 라우트의 페이지 콘텐츠가 여기에 렌더링 -->
        {/if}
        <CheatConsole
            isVisible={showCheatConsole}
            on:close={() => (showCheatConsole = false)}
        />
    </main>
    <!-- <footer>
        <p>&copy; {currentYear} PersonaXI. All rights reserved.</p>
        <nav>
            <a href="/policy">개인정보처리방침</a> |
            <a href="/terms">이용약관</a> |
            <a href="/licenses">라이선스 및 크레딧</a> |
            <a href="/privacy-chat-logs">채팅/로그 데이터 수집 동의</a>
        </nav>
    </footer> -->
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

    /*
    footer {
        bottom: 0; 
        width: 100%; 
        padding: 20px;
        text-align: center;
        font-size: 0.9em;
        border-top: 1px solid #646464;
    }
    footer nav a {
        margin: 0 10px;
        color: #007bff;
        text-decoration: none;
    }
    footer nav a:hover {
        text-decoration: underline;
    }
    */
</style>

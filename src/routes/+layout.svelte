<!-- src/routes/+layout.svelte -->
<script>
    import "$lib/styles/theme.css"; // 이미 적용된 글로벌 CSS
    import Sidebar from "$lib/components/sidebar/Sidebar.svelte"; // 사이드바 컴포넌트
    import { loadCharacterSessions, loadChatSessions } from "$lib/api/sessions";
    import { is_login } from "$lib/stores/user";
    import { onMount } from "svelte";
    import Login from "$lib/components/login/login.svelte";
    import { getCurrentUser } from "$lib/api/auth";

    onMount(async () => {
        let user = await getCurrentUser();
        if (user == null) {
            is_login.set(false);
            return;
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
    <Sidebar />
    <main>
        {#if !$is_login}
            <Login />
        {:else}
            <slot />
            <!-- 하위 라우트의 페이지 콘텐츠가 여기에 렌더링 -->
        {/if}
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
        display: flex;
    }
    main {
        flex: 1;
    }
</style>

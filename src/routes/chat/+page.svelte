<script lang="ts">
    import { goto } from "$app/navigation";
    import { handleSelect } from "$lib/services/sessionManager";
    import { chatSessions } from "$lib/stores/chatSessions"; // 스토어 경로를 확인해주세요.
    import Icon from "@iconify/svelte";

    function navigateToChat(sessionId: string) {
        // 동적 라우트인 [id] 페이지로 이동합니다.
        //goto(`/chat/${sessionId}`);

        handleSelect(sessionId);
    }
</script>

<div class="chat-page-container">
    <header class="page-header">
        <h1>채팅</h1>
    </header>

    <div class="chat-list-wrapper">
        <ul class="chat-list">
            {#each $chatSessions as session (session.id)}
                <li>
                    <button
                        class="chat-item"
                        on:click={() => navigateToChat(session.id)}
                    >
                        <div class="icon-wrapper">
                            {#if session.type === "2D"}
                                <Icon
                                    icon="ph:user-duotone"
                                    width="24"
                                    height="24"
                                />
                            {:else if session.type === "3D"}
                                <Icon
                                    icon="ph:user-focus-duotone"
                                    width="24"
                                    height="24"
                                />
                            {:else}
                                <Icon
                                    icon="ph:chat-circle-dots-duotone"
                                    width="24"
                                    height="24"
                                />
                            {/if}
                        </div>
                        <div class="chat-info">
                            <span class="chat-name">{session.name}</span>
                        </div>
                        <div class="caret-wrapper">
                            <Icon icon="ph:caret-right-bold" />
                        </div>
                    </button>
                </li>
            {:else}
                <div class="empty-state">
                    <Icon icon="ph:chats-circle" width="60" height="60" />
                    <h2>아직 대화가 없습니다</h2>
                    <p>새로운 페르소나와 대화를 시작해보세요.</p>
                    <a href="/hub" class="explore-button">탐색하러 가기</a>
                </div>
            {/each}
        </ul>
    </div>
</div>

<style>
    .chat-page-container {
        padding: 1rem 1rem calc(70px + 1rem) 1rem; /* 하단 네비게이션 높이만큼 패딩 추가 */
        background-color: var(--background);
        min-height: 100vh;
        color: var(--foreground);
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        margin-left: 2.5rem; /* 뒤로가기 버튼 공간 확보 */
    }

    .page-header h1 {
        font-size: 2rem;
        font-weight: 800;
    }

    .chat-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .chat-item {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 1rem;
        gap: 1rem;
        background-color: var(--card);
        border: 1px solid var(--border);
        border-radius: 12px;
        cursor: pointer;
        text-align: left;
        color: var(--foreground);
        transition:
            background-color 0.2s,
            transform 0.2s;
    }
    .chat-item:hover {
        background-color: var(--muted);
        transform: translateY(-2px);
    }

    .icon-wrapper {
        flex-shrink: 0;
        color: var(--primary);
    }

    .chat-info {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .chat-name {
        font-weight: 600;
        font-size: 1rem;
    }

    .chat-meta {
        font-size: 0.8rem;
        color: var(--muted-foreground);
    }

    .caret-wrapper {
        color: var(--muted-foreground);
    }

    /* 채팅 목록이 비어있을 때 */
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 4rem 1rem;
        color: var(--muted-foreground);
        gap: 0.5rem;
    }
    .empty-state h2 {
        font-size: 1.25rem;
        color: var(--foreground);
        margin-top: 1rem;
        margin-bottom: 0.5rem;
    }
    .explore-button {
        margin-top: 1rem;
        background-color: var(--primary);
        color: var(--primary-foreground);
        padding: 0.7rem 1.5rem;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
    }
</style>

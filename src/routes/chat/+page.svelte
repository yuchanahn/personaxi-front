<script lang="ts">
    import { goto } from "$app/navigation";
    import { handleSelect } from "$lib/services/sessionManager";
    import { chatSessions } from "$lib/stores/chatSessions";
    import ChatSessionItem from "$lib/components/chat/ChatSessionItem.svelte";
    import Icon from "@iconify/svelte";
    import { t } from "svelte-i18n";

    function navigateToChat(sessionId: string) {
        // 동적 라우트인 [id] 페이지로 이동합니다.
        //goto(`/chat/${sessionId}`);

        handleSelect(sessionId);
    }
</script>

<div class="chat-page-container">
    <header class="page-header">
        <h1>{$t("chatPage.title")}</h1>
    </header>

    <div class="chat-list-wrapper">
        <div class="chat-list">
            {#each $chatSessions as session (session.id)}
                <div class="chat-item-wrapper">
                    <ChatSessionItem
                        {session}
                        onClick={() => navigateToChat(session.id)}
                        onDelete={() => {}}
                    />
                </div>
            {:else}
                <div class="empty-state">
                    <Icon icon="ph:chats-circle" width="60" height="60" />
                    <h2>{$t("chatPage.noChats")}</h2>
                    <p>{$t("chatPage.startNewChat")}</p>
                    <a href="/hub" class="explore-button"
                        >{$t("chatPage.goExplore")}</a
                    >
                </div>
            {/each}
        </div>
    </div>
</div>

<style>
    .chat-page-container {
        padding: 1rem 1rem calc(70px + 1rem) 1rem; /* 하단 네비게이션 높이만큼 패딩 추가 */
        background-color: var(--background);
        min-height: 100vh;
        color: var(--foreground);
        overflow-x: hidden; /* 가로 스크롤 방지 */
        box-sizing: border-box;
        width: 100%;
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
        display: flex;
        flex-direction: column;
        width: 100%;
    }

    .chat-item-wrapper {
        border-bottom: 1px solid var(--border);
    }
    .chat-item-wrapper:last-child {
        border-bottom: none;
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

    @media (max-width: 768px) {
        .page-header {
            margin-left: 0; /* 모바일에서는 여백 제거 */
            justify-content: center; /* 중앙 정렬 */
        }
        .page-header h1 {
            font-size: 1.5rem;
        }
        .chat-page-container {
            padding-left: 0.5rem;
            padding-right: 0.5rem;
        }
    }
</style>

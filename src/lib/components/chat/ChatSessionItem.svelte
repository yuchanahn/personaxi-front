<script>
    import { ChatSessionType } from "$lib/stores/chatSessions";

    export let session = { id: "", name: "", type: ChatSessionType.CHAT };
    export let onClick;
    export let onDelete;
</script>

<div class="slot" class:space={session.type === ChatSessionType.SPACE}>
    {#if session.type !== ChatSessionType.SPACE}
        <button on:click={onClick}>{session.name}</button>
    {:else}
        <span>{session.name}</span>
    {/if}
</div>

<style>
    .slot {
        display: flex;
        height: 100%;
        color: var(--foreground);
        font-size: 1.1rem;
        border-radius: 8px;
        padding: 0.5rem 1rem;
    }

    .slot:not(.space):hover {
        background-color: var(--secondary);
    }

    .slot button {
        overflow: hidden;
        background: none;
        border: none;
        color: inherit;
        font-size: inherit;
        cursor: pointer;
        border-radius: 8px;
        transition: background-color 0.3s ease;
        white-space: nowrap;
        text-overflow: ellipsis;

        /* ❗ 아래 속성들을 수정/추가합니다. */
        padding: 0; /* 패딩 제거 */
        width: 100%;
        height: 100%;
        text-align: left; /* 텍스트를 왼쪽 정렬 */
    }

    .slot-delete {
        margin-left: auto;
    }

    .space {
        background: none;
        cursor: default;
        padding: 0.5rem 1rem;
    }

    .space span {
        color: var(--muted-foreground);
        font-size: 0.9rem;
        font-weight: 600;
    }
</style>

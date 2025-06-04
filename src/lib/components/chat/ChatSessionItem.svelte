<script>
    import { ChatSessionType } from "$lib/stores/chatSessions";

    export let session = { id: "", name: "", type: ChatSessionType.CHAT };
    export let onClick;
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
        justify-content: left;
        align-items: center;
        height: 100%;
        color: white;
        font-size: 1.1rem;
        border-radius: 8px;
    }

    .slot:not(.space):hover {
        background-color: #3e3f4b;
    }

    .slot button {
        overflow: hidden;
        background: none;
        border: none;
        color: inherit;
        font-size: inherit;
        cursor: pointer;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        transition: background-color 0.3s ease;
        /* 여기부터 추가 */
        white-space: nowrap; /* 텍스트가 다음 줄로 넘어가지 않게 */
        text-overflow: ellipsis; /* 넘치는 텍스트를 ...으로 표시 */
        max-width: 100%; /* 부모 요소의 너비를 넘지 않도록 (필요하다면 추가) */
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
        color: inherit;
        font-size: inherit;
    }
</style>

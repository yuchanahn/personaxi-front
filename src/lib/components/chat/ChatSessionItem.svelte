<script>
    import { ChatSessionType } from "$lib/stores/chatSessions";

    export let session = { id: "", name: "", type: ChatSessionType.CHAT };
    export let onClick;
    export let onDelete;
</script>

<div class="slot" class:space={session.type === ChatSessionType.SPACE}>
    {#if session.type !== ChatSessionType.SPACE}
        <button on:click={onClick}>{session.name}</button>
        {#if session.type !== ChatSessionType.SYSTEM}
            <button on:click={onDelete} class="slot-delete">...</button>
        {/if}
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
        background: none;
        border: none;
        color: inherit;
        font-size: inherit;
        cursor: pointer;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        transition: background-color 0.3s ease;
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

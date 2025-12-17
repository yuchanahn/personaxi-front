<script lang="ts">
    import {
        ChatSessionType,
        type ChatSession,
    } from "$lib/stores/chatSessions";
    import AssetPreview from "$lib/components/AssetPreview.svelte";

    export let session: ChatSession = {
        id: "",
        name: "",
        type: ChatSessionType.CHAT,
        avatar: "",
        lastMessage: "",
        lastMessageAt: "",
        llmType: "",
        createdAt: "",
    };
    export let onClick;
    export let onDelete;

    function formatTime(dateString: string) {
        if (!dateString) return "";
        try {
            const date = new Date(dateString);
            return date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch (e) {
            return "";
        }
    }
</script>

<div class="slot" class:space={session.type === ChatSessionType.SPACE}>
    {#if session.type !== ChatSessionType.SPACE}
        <button on:click={onClick}>
            {#if session.avatar}
                <div class="avatar-container">
                    <AssetPreview
                        asset={{
                            url: session.avatar,
                            description: "avatar",
                            // type is undefined to allow auto-detection
                        }}
                    />
                </div>
            {/if}
            <div class="text-container">
                <div class="header">
                    <span class="name">{session.name}</span>
                    {#if session.lastMessageAt}
                        <span class="time"
                            >{formatTime(session.lastMessageAt)}</span
                        >
                    {/if}
                </div>
                {#if session.lastMessage}
                    <div class="message">
                        {session.lastMessage.replace(
                            /<system-input>[\s\S]*?<\/system-input>/g,
                            "[상호작용]",
                        )}
                    </div>
                {/if}
            </div>
        </button>
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
        padding: 0.5rem; /* Add padding back */
        width: 100%;
        height: 100%;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .avatar-container {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
        background-color: var(--muted);
    }

    .text-container {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 2px;
    }

    .name {
        font-weight: 600;
        font-size: 1rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .time {
        font-size: 0.75rem;
        color: var(--muted-foreground);
        flex-shrink: 0;
        margin-left: 8px;
    }

    .message {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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

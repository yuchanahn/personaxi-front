<script lang="ts">
    import {
        ChatSessionType,
        type ChatSession,
    } from "$lib/stores/chatSessions";
    import AssetPreview from "$lib/components/AssetPreview.svelte";
    import { locale, t } from "svelte-i18n";
    import moment from "moment";
    import "moment/dist/locale/ko";

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

    $: currentLocale = $locale || "en";

    function formatTime(dateString: string, loc: string) {
        if (!dateString) return "";
        try {
            const date = moment(dateString);

            // Set moment locale based on stored locale
            // Map 'en'->'en', 'ko'->'ko' (assuming moment supports 'ko')
            moment.locale(loc === "ko" ? "ko" : "en");

            const now = moment();

            if (date.isSame(now, "day")) {
                // Determine format based on locale (English: 12h, Korean: may want '오후 2:00' or 24h)
                // Using standard LT format which is localized
                return date.format("LT");
            } else {
                // Return 'X days ago' or 'X일 전'
                return date.fromNow();
            }
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
                            >{formatTime(
                                session.lastMessageAt,
                                currentLocale,
                            )}</span
                        >
                    {/if}
                </div>
                {#if session.lastMessage}
                    <div class="message">
                        {session.lastMessage.replace(
                            /<system-input>[\s\S]*?<\/system-input>/g,
                            $t("chatWindow.selectionComplete"),
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

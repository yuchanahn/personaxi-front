<script lang="ts">
    import { t } from "svelte-i18n";
    export let onSend: (msg: string) => void;
    let text = "";

    function submit() {
        if (text.trim()) {
            onSend(text.trim());
            text = "";
        }
    }
</script>

<div class="broadcast-chat-input">
    <input
        bind:value={text}
        on:keydown={(e) => e.key === "Enter" && submit()}
        placeholder={$t("broadcastChatInput.placeholder")}
    />
    <button on:click={submit}>{$t("broadcastChatInput.sendButton")}</button>
</div>

<style>
    .broadcast-chat-input {
        display: flex;
        padding: 0.75rem 1rem;
        border-top: 1px solid #333;
        background: #292929;
    }

    input {
        flex: 1;
        background: #1e1e1e;
        color: white;
        border: none;
        padding: 0.5rem;
        border-radius: 6px;
        margin-right: 0.5rem;
        font-size: 0.9rem;
    }

    button {
        background: #3f3f3f;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
    }

    button:hover {
        background: #666;
    }
</style>

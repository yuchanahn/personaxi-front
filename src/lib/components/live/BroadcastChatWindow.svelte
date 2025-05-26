<script lang="ts">
    import type { BroadcastMessage } from "$lib/services/broadcast";
    import { onMount } from "svelte";
    import type { Writable } from "svelte/store";

    export let messages: Writable<BroadcastMessage[]>;

    onMount(() => {
        const el = document.querySelector(".broadcast-chat-window");
        const observer = new MutationObserver(() => {
            el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        });
        if (el) observer.observe(el, { childList: true, subtree: true });
        return () => observer.disconnect();
    });
</script>

<div class="broadcast-chat-window">
    {#each $messages as message, i (i)}
        <div class="chat-message">
            <strong class="username">{message.user}</strong>: {message.msg}
        </div>
    {/each}
</div>

<style>
    .broadcast-chat-window {
        flex: 1;
        padding: 1rem;
        overflow-y: auto;
        background: #1e1e1e;
        color: #fff;
        font-size: 0.9rem;
    }

    .chat-message {
        margin-bottom: 0.4rem;
        word-break: break-word;
    }

    .username {
        color: #facc15;
        margin-right: 0.3rem;
    }
</style>

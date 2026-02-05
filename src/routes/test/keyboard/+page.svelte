<script lang="ts">
    import { onMount, tick } from "svelte";
    import { initKeyboardViewport } from "$lib/helpers/keyboardViewport";

    let text = "";
    let realInput: HTMLTextAreaElement;

    let keyboardHeight = 0;
    let isKeyboardOpen = false;

    async function openKeyboard(e: Event) {
        e.preventDefault();
        await tick();
        realInput?.focus({ preventScroll: true });
    }

    onMount(() => {
        const handle = initKeyboardViewport({
            inputEl: () => realInput ?? null,
            setKeyboardHeight: (px) => (keyboardHeight = px),
            setIsKeyboardOpen: (open) => (isKeyboardOpen = open),
            threshold: 10,
            maxCloseFrames: 30,
        });

        return handle.destroy;
    });
</script>

<footer
    class="visual-chat-bar"
    style:transform="translateY(-{keyboardHeight}px)"
>
    <div class="input-container">
        {#if !isKeyboardOpen}
            <textarea
                class="input-button"
                value="클릭하세요"
                on:click={openKeyboard}
            ></textarea>
        {/if}

        <textarea
            bind:this={realInput}
            bind:value={text}
            class="real-input"
            class:shown={isKeyboardOpen}
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
        ></textarea>
    </div>

    <button class="send-btn" type="button">전송</button>
</footer>

<style>
    :global(html, body) {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden !important;
        position: fixed;
    }

    .visual-chat-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        background: white;
        color: black;
        padding: 10px 16px;
        display: flex;
        gap: 10px;
        box-sizing: border-box;
        border-top: 1px solid #ddd;
        z-index: 100;
        transition: transform 0.1s ease-out;
    }

    .input-container {
        position: relative;
        flex: 1;
        min-height: 40px;
        display: flex;
        align-items: center;
    }

    .input-button {
        width: 100%;
        min-height: 40px;
        background: #f1f1f1;
        border-radius: 20px;
        padding: 10px 15px;
        font-size: 16px;
        display: flex;
        align-items: center;
        border: none;
        text-align: left;
        white-space: pre-wrap;
    }

    .real-input {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 40px;
        padding: 10px 15px;
        font-size: 16px;
        box-sizing: border-box;
        border: none;
        outline: none;
        background: #f1f1f1;
        border-radius: 20px;

        opacity: 0;
        pointer-events: none;
    }

    .real-input.shown {
        opacity: 1;
        pointer-events: auto;
    }

    .send-btn {
        background: #007bff;
        color: white;
        border: none;
        border-radius: 20px;
        padding: 0 18px;
        font-weight: bold;
    }
</style>

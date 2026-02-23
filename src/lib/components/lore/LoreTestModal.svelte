<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { fade } from "svelte/transition";
    import Icon from "@iconify/svelte";
    import { loreApi, type LoreEntry } from "$lib/api/lore";
    import { t } from "svelte-i18n";

    export let personaId: string;
    export let activeLoreIds: string[] = [];

    const dispatch = createEventDispatcher();

    let message = "";
    let loading = false;
    let results: (LoreEntry & { lore_name?: string })[] = [];
    let tested = false;

    async function runTest() {
        if (!message.trim()) return;
        loading = true;
        try {
            results = await loreApi.testContext(
                personaId,
                message,
                activeLoreIds,
            );
            tested = true;
        } catch (e) {
            console.error(e);
            alert("Failed to test context");
        } finally {
            loading = false;
        }
    }

    function closeModal() {
        dispatch("close");
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") closeModal();
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);
        document.body.style.overflow = "hidden";
    });

    onDestroy(() => {
        window.removeEventListener("keydown", handleKeydown);
        document.body.style.overflow = "";
    });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-backdrop" on:click={closeModal} transition:fade>
    <div class="modal-container" on:click|stopPropagation>
        <button class="close-button" on:click={closeModal} aria-label="Close">
            <Icon icon="ph:x-bold" />
        </button>

        <h2 class="title">
            <Icon icon="ph:flask-duotone" />
            {$t("lorebook.test.title")}
        </h2>

        <div class="test-body">
            <p class="desc">
                {$t("lorebook.test.placeholder")}
            </p>

            <textarea
                bind:value={message}
                class="input-msg"
                placeholder="e.g. I walk into the ancient forest..."
                rows="3"
            ></textarea>

            <button
                class="btn-test"
                on:click={runTest}
                disabled={loading || !message.trim()}
            >
                {#if loading}
                    <span class="spin"><Icon icon="ph:spinner-gap-bold" /></span
                    >
                {:else}
                    <Icon icon="ph:play-bold" /> {$t("lorebook.test.run")}
                {/if}
            </button>

            {#if tested}
                <div class="results">
                    <h3>{$t("lorebook.test.result")} ({results.length})</h3>
                    {#if results.length === 0}
                        <div class="empty-result">
                            {$t("lorebook.test.noResult")}
                        </div>
                    {:else}
                        <div class="result-list">
                            {#each results as entry}
                                <div class="result-item">
                                    <div class="match-info">
                                        <span class="keyword-match"
                                            >id: {entry.id}</span
                                        >
                                        <span class="prio"
                                            >Prio: {entry.priority}</span
                                        >
                                    </div>
                                    <div class="content">{entry.content}</div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: hsla(0, 0%, 0%, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 20000;
        backdrop-filter: blur(5px);
    }
    .modal-container {
        position: relative;
        background: var(--background);
        color: var(--foreground);
        padding: 1.5rem;
        border-radius: 12px;
        width: 90%;
        max-width: 600px;
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-height: 80vh;
    }
    .close-button {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        font-size: 1.25rem;
    }
    .title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        font-size: 1.2rem;
    }
    .desc {
        font-size: 0.9rem;
        color: var(--muted-foreground);
        margin: 0;
    }

    .input-msg {
        width: 100%;
        padding: 0.75rem;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--input);
        color: var(--foreground);
        resize: vertical;
        font-family: inherit;
        box-sizing: border-box;
    }

    .btn-test {
        padding: 0.75rem;
        border-radius: 8px;
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
    }
    .btn-test:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .results {
        margin-top: 1rem;
        border-top: 1px solid var(--border);
        padding-top: 1rem;
        flex: 1;
        overflow-y: auto;
    }
    .results h3 {
        margin: 0 0 0.5rem 0;
        font-size: 0.95rem;
    }

    .result-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .result-item {
        padding: 0.75rem;
        border-radius: 8px;
        background: var(--muted);
        border: 1px solid var(--border);
    }
    .match-info {
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;
        color: var(--muted-foreground);
        margin-bottom: 0.25rem;
    }
    .content {
        font-size: 0.9rem;
        white-space: pre-wrap;
    }

    .spin {
        display: inline-block;
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        100% {
            transform: rotate(360deg);
        }
    }
    .empty-result {
        text-align: center;
        color: var(--muted-foreground);
        padding: 1rem;
    }

    .test-body {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        overflow: hidden;
        flex: 1;
    }

    @media (max-width: 768px) {
        .modal-backdrop {
            padding: 0;
            align-items: flex-end;
        }
        .modal-container {
            width: 100%;
            height: 95dvh;
            max-height: 95dvh;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            border-bottom: none;
            padding-bottom: env(safe-area-inset-bottom);
        }
    }
</style>

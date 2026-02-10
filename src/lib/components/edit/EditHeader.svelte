<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import type { Persona } from "$lib/types";

    export let persona: Persona;
    export let loading: boolean;
    export let showSuccess: boolean;
    export let uploadProgress: number;
    export let onSave: () => void;
    export let onStartChat: () => void;
</script>

<div class="header">
    <div class="header-title">{$t("editPage.title")}</div>
    <div class="header-actions">
        {#if persona.id}
            <button class="chat-button secondary" on:click={onStartChat}>
                <Icon icon="ph:chat-circle-dots-bold" />
                <span>{$t("profilePage.startChatButton")}</span>
            </button>
        {/if}
        <button
            class="save-button"
            type="submit"
            on:click={onSave}
            disabled={loading || showSuccess}
        >
            {#if loading}
                <span
                    >{$t("editPage.saveButtonLoading")} ({Math.round(
                        uploadProgress,
                    )}%)</span
                >
            {:else if showSuccess}
                <span>{$t("editPage.saveButtonSuccess")}</span>
            {:else}
                <span>{$t("editPage.saveButton")}</span>
            {/if}
        </button>
    </div>
</div>

<style>
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem 0;
        flex-shrink: 0;
        border-bottom: 1px solid var(--border);
    }
    .header-title {
        font-size: 1.5rem;
        font-weight: 600;
        margin-left: 3rem;
    }
    .header-actions {
        display: flex;
        gap: 1rem;
        align-items: center;
    }
    .chat-button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        border-radius: var(--radius-button);
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid var(--border);
        background: var(--secondary);
        color: var(--secondary-foreground);
    }

    .chat-button:hover {
        background: var(--secondary-hover);
        transform: translateY(-1px);
    }
    .save-button {
        padding: 0.6rem 1.2rem;
        font-size: 0.9rem;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        background: var(--primary-gradient);
        border: 1px solid var(--primary-gradient);
        color: var(--primary-foreground);

        background-size: 200% 200%;
        animation: gradient-animation 3s ease infinite;
    }
    .save-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .save-button:hover:not(:disabled) {
        opacity: 0.9;
    }

    /* Mobile: Hide header button */
    @media (max-width: 768px) {
        .header .save-button {
            display: none;
        }
    }
</style>

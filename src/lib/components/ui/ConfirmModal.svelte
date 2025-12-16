<script lang="ts">
    import { fade, scale } from "svelte/transition";
    import { confirmStore } from "$lib/stores/confirm";
    import Icon from "@iconify/svelte";
    import { t } from "svelte-i18n";

    function handleConfirm() {
        confirmStore.close(true);
    }

    function handleCancel() {
        confirmStore.close(false);
    }

    // Close on Escape
    function handleKeydown(event: KeyboardEvent) {
        if ($confirmStore.isOpen && event.key === "Escape") {
            handleCancel();
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $confirmStore.isOpen}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class="backdrop"
        on:click|self={handleCancel}
        transition:fade={{ duration: 200 }}
    >
        <div
            class="modal"
            transition:scale={{ duration: 200, start: 0.95 }}
            role="dialog"
            aria-modal="true"
        >
            <div class="content">
                {#if $confirmStore.options.title}
                    <h3>{$confirmStore.options.title}</h3>
                {/if}
                <p class="message">{$confirmStore.options.message}</p>
            </div>

            <div class="actions">
                <button class="btn cancel" on:click={handleCancel}>
                    {$confirmStore.options.cancelText ||
                        $t("common.cancel") ||
                        "Cancel"}
                </button>
                <button
                    class="btn confirm"
                    class:danger={$confirmStore.options.type === "danger"}
                    on:click={handleConfirm}
                >
                    {$confirmStore.options.confirmText ||
                        $t("common.confirm") ||
                        "Confirm"}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        z-index: 10000; /* Higher than toast */
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .modal {
        background: var(--popover, #2a2a2a);
        color: var(--popover-foreground, #fff);
        width: 90%;
        max-width: 400px;
        padding: 24px;
        border-radius: 16px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        border: 1px solid var(--border, #444);
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .content h3 {
        margin: 0 0 8px 0;
        font-size: 1.25rem;
        font-weight: 600;
    }

    .message {
        margin: 0;
        font-size: 1rem;
        line-height: 1.5;
        color: var(--muted-foreground, #ccc);
    }

    .actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
    }

    .btn {
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition:
            transform 0.1s,
            opacity 0.2s;
    }

    .btn:active {
        transform: scale(0.98);
    }

    .btn.cancel {
        background: var(--muted, #444);
        color: var(--muted-foreground, #ccc);
    }
    .btn.cancel:hover {
        background: var(--muted-hover, #555);
        color: #fff;
    }

    .btn.confirm {
        background: var(--primary, #3f51b5);
        color: #fff;
    }
    .btn.confirm:hover {
        filter: brightness(1.1);
    }

    .btn.confirm.danger {
        background: var(--danger, #d32f2f);
    }
</style>

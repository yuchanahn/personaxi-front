<script lang="ts">
    import { onMount } from "svelte";
    import { fly, fade } from "svelte/transition";
    import { toast, type Toast } from "$lib/stores/toast";
    import Icon from "@iconify/svelte";

    export let item: Toast;

    function close() {
        toast.remove(item.id);
    }

    const icons = {
        success: "ph:check-circle-fill",
        error: "ph:warning-circle-fill",
        info: "ph:info-fill",
        warning: "ph:warning-fill",
    };

    const colors = {
        success: "var(--primary, #4caf50)", // Default fallback
        error: "var(--danger, #f44336)",
        info: "var(--info, #2196f3)",
        warning: "var(--warning, #ff9800)",
    };
</script>

<div
    class="toast {item.type}"
    transition:fly={{ y: 20, duration: 300 }}
    role="alert"
>
    <div class="icon">
        <Icon icon={icons[item.type]} width="24" />
    </div>
    <div class="message">{item.message}</div>
    <button class="close-btn" on:click={close}>
        <Icon icon="ph:x-bold" />
    </button>
</div>

<style>
    .toast {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--popover, #333);
        color: var(--popover-foreground, #fff);
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        margin-bottom: 10px;
        border-left: 4px solid transparent;
        min-width: 300px;
        max-width: 400px;
        pointer-events: auto;
    }

    .toast.success {
        border-color: var(--primary, #4caf50);
    }
    .toast.error {
        border-color: var(--danger, #f44336);
    }
    .toast.info {
        border-color: var(--info, #2196f3);
    }
    .toast.warning {
        border-color: var(--warning, #ff9800);
    }

    .icon {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    :global(.toast.success .icon) {
        color: var(--primary, #4caf50);
    }
    :global(.toast.error .icon) {
        color: var(--danger, #f44336);
    }
    :global(.toast.info .icon) {
        color: var(--info, #2196f3);
    }
    :global(.toast.warning .icon) {
        color: var(--warning, #ff9800);
    }

    .message {
        flex: 1;
        font-size: 0.95rem;
        line-height: 1.4;
    }

    .close-btn {
        background: transparent;
        border: none;
        color: var(--muted-foreground, #aaa);
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 4px;
        border-radius: 50%;
        transition:
            background 0.2s,
            color 0.2s;
    }

    .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
    }
</style>

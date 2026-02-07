<script lang="ts">
    import { toast } from "$lib/stores/toast";
    import Toast from "./Toast.svelte";
</script>

<div class="toast-container">
    {#each $toast as item (item.id)}
        <Toast {item} />
    {/each}
</div>

<style>
    .toast-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        pointer-events: none; /* Allow clicks to pass through empty space */
        gap: 8px; /* Spacing between toasts */
    }

    /* Mobile adjustments */
    @media (max-width: 600px) {
        .toast-container {
            top: 20px;
            bottom: auto;
            left: 20px;
            right: 20px;
            align-items: center;
        }
    }
</style>

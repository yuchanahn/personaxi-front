<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { fade } from "svelte/transition";
    import Icon from "@iconify/svelte";
    import LoreEditor from "./LoreEditor.svelte";
    import { hideBackButton } from "$lib/utils/LayoutUtils";

    export let loreId: string | null = null;

    const dispatch = createEventDispatcher();

    function closeModal() {
        dispatch("close");
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            closeModal();
        }
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);
        document.body.style.overflow = "hidden"; // Prevent background scrolling
        hideBackButton.hide();
    });

    onDestroy(() => {
        window.removeEventListener("keydown", handleKeydown);
        document.body.style.overflow = "";
        hideBackButton.show();
    });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-backdrop" on:click={closeModal} transition:fade>
    <div class="modal-container" on:click|stopPropagation>
        <button class="close-button" on:click={closeModal} aria-label="Close">
            <Icon icon="ph:x-bold" />
        </button>

        <div class="modal-content">
            <LoreEditor {loreId} on:close={closeModal} />
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
        padding: 1rem; /* prevent edge touching on small screens */
        box-sizing: border-box;
    }

    .modal-container {
        position: relative;
        background: var(--background);
        color: var(--foreground);
        padding: 0; /* content handles padding */
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        width: 100%;
        max-width: 900px;
        height: 85dvh; /* Fixed height for editor */
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .close-button {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        background: rgba(0, 0, 0, 0.1);
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        font-size: 1.25rem;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        z-index: 10;
    }
    .close-button:hover {
        background: var(--destructive);
        color: white;
    }

    .modal-content {
        flex: 1;
        overflow: hidden; /* Editor handles its own scroll */
        display: flex;
        flex-direction: column;
    }

    @media (max-width: 768px) {
        .modal-backdrop {
            padding: 0;
            align-items: flex-end;
        }
        .modal-container {
            height: 95dvh; /* Almost full height */
            max-height: 95dvh;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            border-bottom: none;
            padding-bottom: env(
                safe-area-inset-bottom
            ); /* Fix home bar crash on iOS */
        }
    }
</style>

<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { page } from "$app/stores";
    import { onDestroy, onMount } from "svelte";
    import { t } from "svelte-i18n";
    import Login from "$lib/components/login/login.svelte";
    import { authGate, closeAuthGate } from "$lib/stores/authGate";

    let dragOffsetY = 0;
    let dragStartY = 0;
    let dragPointerId: number | null = null;
    let dragStartedAt = 0;
    let isDragging = false;

    $: isOpen = $authGate.isOpen;

    $: if (
        isOpen &&
        ($page.url.pathname === "/signup" || $page.url.pathname === "/login")
    ) {
        closeAuthGate();
    }

    $: if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("auth-modal-open", isOpen);
        document.body.classList.toggle("auth-modal-open", isOpen);
    }

    function resetDrag() {
        isDragging = false;
        dragPointerId = null;
        dragStartY = 0;
        dragStartedAt = 0;
        dragOffsetY = 0;
    }

    function handleBackdropClose(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            closeAuthGate();
        }
    }

    function handleEscape(event: KeyboardEvent) {
        if (event.key === "Escape" && isOpen) {
            closeAuthGate();
        }
    }

    function handleDragStart(event: PointerEvent) {
        if (event.pointerType === "mouse" && event.button !== 0) return;

        dragPointerId = event.pointerId;
        dragStartY = event.clientY;
        dragStartedAt = performance.now();
        dragOffsetY = 0;
        isDragging = true;

        (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(
            event.pointerId,
        );
    }

    function handleDragMove(event: PointerEvent) {
        if (!isDragging || dragPointerId !== event.pointerId) return;
        dragOffsetY = Math.max(0, event.clientY - dragStartY);
    }

    function handleDragEnd(event: PointerEvent) {
        if (!isDragging || dragPointerId !== event.pointerId) return;

        const elapsed = Math.max(1, performance.now() - dragStartedAt);
        const velocity = dragOffsetY / elapsed;
        const shouldClose = dragOffsetY > 140 || (dragOffsetY > 36 && velocity > 0.9);

        resetDrag();

        if (shouldClose) {
            closeAuthGate();
        }
    }

    onMount(() => {
        if (typeof window !== "undefined") {
            window.addEventListener("keydown", handleEscape);
        }
    });

    onDestroy(() => {
        if (typeof document !== "undefined") {
            document.documentElement.classList.remove("auth-modal-open");
            document.body.classList.remove("auth-modal-open");
        }
        if (typeof window !== "undefined") {
            window.removeEventListener("keydown", handleEscape);
        }
    });
</script>

{#if isOpen}
    <div
        class="auth-modal-backdrop"
        on:click={handleBackdropClose}
        transition:fade={{ duration: 180 }}
    >
        <div
            class="auth-sheet-shell"
            in:fly={{ y: 32, duration: 220 }}
            out:fly={{ y: 32, duration: 180 }}
            style={`transform: translateY(${dragOffsetY}px); transition-duration: ${isDragging ? 0 : 220}ms;`}
        >
            <div
                class="auth-sheet-handle-zone"
                on:pointerdown={handleDragStart}
                on:pointermove={handleDragMove}
                on:pointerup={handleDragEnd}
                on:pointercancel={handleDragEnd}
            >
                <span class="auth-sheet-handle"></span>
            </div>

            <div class="auth-sheet-header">
                <div class="auth-sheet-header-copy">
                    <h2>{$t("login.signIn")}</h2>
                    <p>{$t("login.modalSubtitle")}</p>
                </div>
            </div>

            <div class="auth-sheet-body">
                <Login isModal={true} postLoginPath={$authGate.returnTo} />
            </div>
        </div>
    </div>
{/if}

<style>
    .auth-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 12000;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 1rem;
        background:
            linear-gradient(
                180deg,
                rgba(8, 12, 20, 0.16),
                rgba(8, 12, 20, 0.34)
            );
        backdrop-filter: blur(16px) saturate(1.04);
        -webkit-backdrop-filter: blur(16px) saturate(1.04);
    }

    .auth-sheet-shell {
        width: min(100%, 460px);
        max-height: min(86vh, 720px);
        border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
        border-radius: 28px;
        background: var(--card);
        box-shadow:
            0 30px 80px rgba(0, 0, 0, 0.24),
            0 8px 24px rgba(0, 0, 0, 0.12);
        overflow: hidden;
        transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
        will-change: transform;
    }

    .auth-sheet-handle-zone {
        display: flex;
        justify-content: center;
        padding: 0.9rem 0 0.15rem;
        touch-action: none;
        cursor: grab;
    }

    .auth-sheet-handle-zone:active {
        cursor: grabbing;
    }

    .auth-sheet-handle {
        width: 52px;
        height: 5px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--muted-foreground) 28%, transparent);
    }

    .auth-sheet-header {
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        gap: 1rem;
        padding: 0.25rem 1.15rem 0.85rem;
    }

    .auth-sheet-header-copy h2 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--foreground);
    }

    .auth-sheet-header-copy p {
        margin: 0.32rem 0 0;
        font-size: 0.88rem;
        color: var(--muted-foreground);
    }

    .auth-sheet-body {
        padding: 0 1.15rem 1.15rem;
    }

    :global(html.auth-modal-open),
    :global(body.auth-modal-open) {
        overflow: hidden;
    }

    @media (max-width: 640px) {
        .auth-modal-backdrop {
            padding: 0;
        }

        .auth-sheet-shell {
            width: 100%;
            max-height: 88vh;
            border-radius: 28px 28px 0 0;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
        }

        .auth-sheet-body {
            padding-bottom: calc(1.15rem + env(safe-area-inset-bottom, 0px));
        }
    }
</style>

<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { fade } from "svelte/transition";
    import Icon from "@iconify/svelte";
    import { API_BASE_URL } from "$lib/constants";
    import { t } from "svelte-i18n";

    const dispatch = createEventDispatcher();

    let feedbackText = "";
    let isLoading = false;
    let isSuccess = false;

    async function submitFeedback(text: string) {
        const res = await fetch(`${API_BASE_URL}/api/feedback`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ text }),
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to submit feedback");
        }
    }

    async function handleSubmit() {
        if (!feedbackText.trim() || isLoading) return;
        isLoading = true;
        try {
            await submitFeedback(feedbackText);
            isSuccess = true;
            setTimeout(() => {
                dispatch("close");
            }, 1500);
        } catch (error) {
            console.error("Feedback submission error:", error);
            alert($t("feedbackModal.submitFailed"));
            isLoading = false;
        }
    }

    function closeModal() {
        if (isLoading) return;
        dispatch("close");
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            closeModal();
        }
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);
    });

    onDestroy(() => {
        window.removeEventListener("keydown", handleKeydown);
    });
</script>

<div class="modal-backdrop" on:click={closeModal} transition:fade>
    <div class="modal-container" on:click|stopPropagation>
        <button class="close-button" on:click={closeModal} aria-label="닫기">
            <Icon icon="ph:x-bold" />
        </button>

        {#if isSuccess}
            <div class="success-message">
                <Icon icon="ph:check-circle-duotone" />
                <h2>{$t("feedbackModal.thanks")}</h2>
                <p>{$t("feedbackModal.thanksMessage")}</p>
            </div>
        {:else}
            <div class="modal-content">
                <h2 class="modal-title">{$t("feedbackModal.title")}</h2>
                <p class="modal-body">
                    {$t("feedbackModal.body1")}
                    <br />
                    {$t("feedbackModal.body2")}
                </p>
                <textarea
                    bind:value={feedbackText}
                    placeholder={$t("feedbackModal.placeholder")}
                    disabled={isLoading}
                />
                <button
                    class="submit-button"
                    on:click={handleSubmit}
                    disabled={isLoading || !feedbackText.trim()}
                >
                    {#if isLoading}
                        <span>{$t("feedbackModal.sending")}</span>
                    {:else}
                        <span>{$t("feedbackModal.send")}</span>
                    {/if}
                </button>
            </div>
        {/if}
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: hsl(from var(--dark) h s l / 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    }

    .modal-container {
        position: relative;
        background: var(--popover);
        color: var(--foreground);
        padding: 2.5rem;
        border-radius: 16px;
        box-shadow: var(--shadow-popover);
        width: 90%;
        max-width: 500px;
        border: 1px solid var(--border);
    }

    .close-button {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        font-size: 1.5rem;
        line-height: 1;
        padding: 0.5rem;
        transition: color 0.2s;
    }
    .close-button:hover {
        color: var(--foreground);
    }

    .modal-content {
        text-align: center;
    }

    .modal-title {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 0.75rem 0;
        color: var(--foreground);
    }

    .modal-body {
        font-size: 0.95rem;
        line-height: 1.6;
        color: var(--muted-foreground);
    }

    textarea {
        width: 100%;
        min-height: 150px;
        margin: 1.5rem 0;
        padding: 0.75rem;
        background: var(--input);
        border: 1px solid var(--border-input);
        border-radius: var(--radius-input);
        color: var(--foreground);
        font-size: 1rem;
        resize: vertical;
        transition:
            border-color 0.2s,
            box-shadow 0.2s;
    }

    textarea:focus {
        outline: none;
        border-color: var(--ring);
        box-shadow: 0 0 0 3px hsl(from var(--ring) h s l / 0.3);
    }

    .submit-button {
        width: 100%;
        padding: 0.8rem;
        font-size: 1rem;
        font-weight: bold;
        color: #fff;
        background: linear-gradient(45deg, #ff79c6, #bd93f9);
        border: none;
        border-radius: var(--radius-button);
        cursor: pointer;
        transition: all 0.3s ease;
    }
    .submit-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }
    .submit-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
    }

    .success-message {
        text-align: center;
        padding: 2rem 0;
    }
    .success-message :global(svg) {
        font-size: 4rem;
        color: #4caf50;
        margin-bottom: 1rem;
    }
</style>

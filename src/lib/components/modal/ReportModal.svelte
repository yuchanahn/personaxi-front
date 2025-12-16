<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { fade } from "svelte/transition";
    import Icon from "@iconify/svelte";
    import { t } from "svelte-i18n";
    import { api } from "$lib/api";
    import { toast } from "$lib/stores/toast";

    export let personaId: string = "";
    export let personaName: string = "";

    const dispatch = createEventDispatcher();

    let reportText = "";
    let selectedType = "spam";
    let isLoading = false;
    let isSuccess = false;

    const reportTypes = [
        { id: "spam", label: "spam" },
        { id: "inappropriate", label: "inappropriate" },
        { id: "copyright", label: "copyright" },
        { id: "other", label: "other" },
    ];

    async function submitReport(type: string, content: string) {
        // Construct the payload to be stringified
        const reportData = {
            type: type,
            content: content,
            targetId: personaId,
            targetName: personaName,
            timestamp: new Date().toISOString(),
        };

        const payload = {
            text: JSON.stringify(reportData),
        };

        const res = await api.post(`/api/feedback`, payload);
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to submit report");
        }
    }

    async function handleSubmit() {
        if (!reportText.trim() || isLoading) return;
        isLoading = true;
        try {
            await submitReport(selectedType, reportText);
            isSuccess = true;
            setTimeout(() => {
                dispatch("close");
            }, 1500);
        } catch (error) {
            console.error("Report submission error:", error);
            toast.error(
                $t("feedbackModal.submitFailed") || "Failed to submit report",
            );
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

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-backdrop" on:click={closeModal} transition:fade>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal-container" on:click|stopPropagation>
        <button class="close-button" on:click={closeModal} aria-label="닫기">
            <Icon icon="ph:x-bold" />
        </button>

        {#if isSuccess}
            <div class="success-message">
                <Icon icon="ph:check-circle-duotone" />
                <h2>{$t("reportModal.thanks") || "Thank you"}</h2>
                <p>
                    {$t("reportModal.thanksMessage") ||
                        "Your report has been submitted."}
                </p>
            </div>
        {:else}
            <div class="modal-content">
                <h2 class="modal-title">
                    <Icon
                        icon="ph:warning-circle-bold"
                        style="vertical-align: middle; margin-right: 8px; color: #ff9800;"
                    />
                    {$t("reportModal.title") || "Report Content"}
                </h2>

                <div class="type-selector">
                    <label class="input-label"
                        >{$t("reportModal.selectType") ||
                            "Reason for reporting"}</label
                    >
                    <div class="radio-group">
                        {#each reportTypes as type}
                            <label class="radio-label">
                                <input
                                    type="radio"
                                    bind:group={selectedType}
                                    value={type.id}
                                    disabled={isLoading}
                                />
                                <span
                                    >{$t(`reportModal.types.${type.label}`) ||
                                        type.id}</span
                                >
                            </label>
                        {/each}
                    </div>
                </div>

                <div class="text-input-group">
                    <label class="input-label"
                        >{$t("reportModal.details") || "Details"}</label
                    >
                    <textarea
                        bind:value={reportText}
                        placeholder={$t("reportModal.placeholder") ||
                            "Please describe the issue..."}
                        disabled={isLoading}
                    ></textarea>
                </div>

                <button
                    class="submit-button"
                    on:click={handleSubmit}
                    disabled={isLoading || !reportText.trim()}
                >
                    {#if isLoading}
                        <span
                            >{$t("feedbackModal.sending") || "Sending..."}</span
                        >
                    {:else}
                        <span
                            >{$t("reportModal.submit") || "Submit Report"}</span
                        >
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
        text-align: left;
    }

    .modal-title {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 1.5rem 0;
        color: var(--foreground);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .input-label {
        display: block;
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--muted-foreground);
        margin-bottom: 0.5rem;
    }

    .type-selector {
        margin-bottom: 1.5rem;
    }

    .radio-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background: var(--input);
        padding: 1rem;
        border-radius: var(--radius-input);
        border: 1px solid var(--border-input);
    }

    .radio-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        font-size: 0.95rem;
    }

    .radio-label input[type="radio"] {
        accent-color: var(--primary);
    }

    .text-input-group {
        margin-bottom: 1.5rem;
    }

    textarea {
        width: 100%;
        min-height: 100px;
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
        background: linear-gradient(
            45deg,
            #f44336,
            #d32f2f
        ); /* Red gradient for report */
        border: none;
        border-radius: var(--radius-button);
        cursor: pointer;
        transition: all 0.3s ease;
    }
    .submit-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(244, 67, 54, 0.3);
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

<script lang="ts">
    import { goto } from "$app/navigation";
    import { t } from "svelte-i18n";
    import MediaUploadForm from "$lib/components/edit/MediaUploadForm.svelte";
    import type { Persona } from "$lib/types";

    export let persona: Persona;
    export let originalPersona: Persona | null;
    export let allVoices: any[] = [];
    export let selectedVoiceId: string;

    // Forward metadata event up
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    $: isLive2DPersona = persona?.personaType === "2.5D";

    function openAdvancedLive2DEditor() {
        if (!persona?.id) return;
        const returnUrl = `/edit?c=${persona.id}`;
        goto(
            `/edit-live2d?c=${encodeURIComponent(persona.id)}&return=${encodeURIComponent(returnUrl)}`,
        );
    }
</script>

<div class="step-media">
    <div class="section-header">
        <div class="header-main">
            <h3>{$t("edit3.media.title")}</h3>
            <p class="section-desc">
                {$t("edit3.media.desc")}
            </p>
        </div>
        {#if isLive2DPersona}
            <div class="header-actions">
                <button
                    class="advanced-btn"
                    disabled={!persona.id}
                    on:click={openAdvancedLive2DEditor}
                >
                    {$t("edit3.media.live2dAdvancedEdit", {
                        default: "Live2D 고급 편집",
                    })}
                </button>
                {#if !persona.id}
                    <p class="hint">
                        {$t("edit3.media.saveFirstHint", {
                            default: "먼저 저장 후 사용",
                        })}
                    </p>
                {/if}
            </div>
        {/if}
    </div>

    <MediaUploadForm
        bind:persona
        {originalPersona}
        {allVoices}
        bind:selectedVoiceId
        on:metadataLoaded
    />

</div>

<style>
    .step-media {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .section-header h3 {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--foreground);
        margin: 0 0 0.25rem;
    }

    .section-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
    }

    .header-main {
        min-width: 0;
    }

    .header-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.3rem;
        flex-shrink: 0;
    }

    .section-desc {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        margin: 0;
    }

    .advanced-btn {
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--foreground);
        padding: 0.5rem 0.7rem;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
    }

    .advanced-btn:hover:not(:disabled) {
        background: var(--accent);
    }

    .advanced-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .hint {
        margin: 0;
        font-size: 0.72rem;
        color: var(--muted-foreground);
    }

    @media (max-width: 768px) {
        .section-header {
            flex-direction: column;
            align-items: stretch;
        }

        .header-actions {
            align-items: flex-start;
        }
    }
</style>

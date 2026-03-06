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

    function openAdvancedLive2DEditor() {
        if (!persona?.id) return;
        const returnUrl = `/edit3?c=${persona.id}`;
        goto(
            `/edit-live2d?c=${encodeURIComponent(persona.id)}&return=${encodeURIComponent(returnUrl)}`,
        );
    }
</script>

<div class="step-media">
    <div class="section-header">
        <h3>{$t("edit3.media.title")}</h3>
        <p class="section-desc">
            {$t("edit3.media.desc")}
        </p>
    </div>

    <MediaUploadForm
        bind:persona
        {originalPersona}
        {allVoices}
        bind:selectedVoiceId
        on:metadataLoaded
    />

    {#if persona.personaType === "2D" || persona.personaType === "2.5D"}
        <div class="live2d-advanced">
            <button
                class="advanced-btn"
                disabled={!persona.id}
                on:click={openAdvancedLive2DEditor}
            >
                {$t("Live2D 고급 편집", { default: "Live2D 고급 편집" })}
            </button>
            {#if !persona.id}
                <p class="hint">먼저 페르소나를 저장한 후 사용할 수 있습니다.</p>
            {/if}
        </div>
    {/if}
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

    .section-desc {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        margin: 0;
    }

    .live2d-advanced {
        margin-top: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .advanced-btn {
        align-self: flex-start;
        border: 1px solid var(--border);
        background: var(--muted);
        color: var(--foreground);
        padding: 0.55rem 0.8rem;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
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
        font-size: 0.78rem;
        color: var(--muted-foreground);
    }
</style>

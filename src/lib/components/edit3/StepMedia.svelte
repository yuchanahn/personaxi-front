<script lang="ts">
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
</script>

<div class="step-media">
    <div class="section-header">
        <h3>미디어 & 에셋</h3>
        <p class="section-desc">
            캐릭터의 프로필 이미지, 에셋, 모델 파일을 업로드하세요.
        </p>
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

    .section-desc {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        margin: 0;
    }
</style>

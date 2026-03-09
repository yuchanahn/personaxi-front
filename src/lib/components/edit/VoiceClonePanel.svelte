<script lang="ts">
    import { onDestroy } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { toast } from "$lib/stores/toast";
    import {
        createVoiceClone,
        getVoiceCloneStatus,
        testVoiceCloneSynthesis,
        type VoiceCloneStatus,
    } from "$lib/api/voice_clone";

    export let personaType: string;
    export let allVoices: any[] = [];
    export let selectedVoiceId: string = "";

    type SampleItem = {
        id: string;
        file: File;
        url: string;
        text: string;
        durationSec: number;
    };

    let showCloneModal = false;
    let cloneTitle = "";
    let cloneDescription = "";
    let cloneSamples: SampleItem[] = [];
    let isCreating = false;
    let createResult: VoiceCloneStatus | null = null;
    let pollingTimer: ReturnType<typeof setInterval> | null = null;

    let isRecording = false;
    let recorder: MediaRecorder | null = null;
    let recordingStream: MediaStream | null = null;
    let recordingChunks: Blob[] = [];

    let testText = "Hello. This is a Persona voice clone test.";
    let isTesting = false;
    let testAudioUrl = "";

    $: normalizedType = (personaType || "").trim().toLowerCase();
    $: isModelPersona =
        normalizedType === "2.5d" ||
        normalizedType === "3d" ||
        normalizedType === "live2d" ||
        normalizedType === "vrm3d";
    $: hasSelectedPresetVoice = !!allVoices.find(
        (v) => v._id === selectedVoiceId,
    );
    $: selectedVoiceFallbackLabel =
        selectedVoiceId && !hasSelectedPresetVoice
            ? `${$t("editPage.voiceClone.customVoice")} (${selectedVoiceId.slice(
                  0,
                  10,
              )}...)`
            : "";
    $: totalDurationSec = cloneSamples.reduce(
        (acc, s) => acc + (Number.isFinite(s.durationSec) ? s.durationSec : 0),
        0,
    );

    function stopPolling() {
        if (!pollingTimer) return;
        clearInterval(pollingTimer);
        pollingTimer = null;
    }

    function openCloneModal() {
        showCloneModal = true;
    }

    function closeCloneModal() {
        showCloneModal = false;
    }

    async function readDurationSec(file: File): Promise<number> {
        const localUrl = URL.createObjectURL(file);
        try {
            const duration = await new Promise<number>((resolve) => {
                const audio = document.createElement("audio");
                audio.preload = "metadata";
                audio.src = localUrl;
                audio.onloadedmetadata = () =>
                    resolve(
                        Number.isFinite(audio.duration) ? audio.duration : 0,
                    );
                audio.onerror = () => resolve(0);
            });
            return duration;
        } finally {
            URL.revokeObjectURL(localUrl);
        }
    }

    async function refreshCloneStatus() {
        if (!createResult?.model_id) return;
        try {
            const status = await getVoiceCloneStatus(createResult.model_id);
            createResult = status;
            if (status.state === "trained" || status.state === "failed") {
                stopPolling();
            }
        } catch (e) {
            console.warn("voice clone status poll failed", e);
        }
    }

    async function startRecording() {
        if (isRecording) return;
        try {
            recordingStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            recorder = new MediaRecorder(recordingStream);
            recordingChunks = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) recordingChunks.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(recordingChunks, {
                    type: recorder?.mimeType || "audio/webm",
                });
                const ext = blob.type.includes("wav") ? "wav" : "webm";
                const file = new File(
                    [blob],
                    `recording_${Date.now()}.${ext}`,
                    { type: blob.type || "audio/webm" },
                );
                const id = crypto.randomUUID();
                const url = URL.createObjectURL(file);
                cloneSamples = [
                    ...cloneSamples,
                    {
                        id,
                        file,
                        url,
                        text: "",
                        durationSec: 0,
                    },
                ];
                readDurationSec(file).then((sec) => {
                    cloneSamples = cloneSamples.map((s) =>
                        s.id === id ? { ...s, durationSec: sec } : s,
                    );
                });
            };

            recorder.start();
            isRecording = true;
        } catch (e: any) {
            toast.error(e?.message || $t("editPage.voiceClone.micFailed"));
        }
    }

    function stopRecording() {
        if (!recorder || !isRecording) return;
        recorder.stop();
        recordingStream?.getTracks().forEach((track) => track.stop());
        recordingStream = null;
        recorder = null;
        isRecording = false;
    }

    function onVoiceFilesSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const next: SampleItem[] = Array.from(input.files).map((file) => ({
            id: crypto.randomUUID(),
            file,
            url: URL.createObjectURL(file),
            text: "",
            durationSec: 0,
        }));
        cloneSamples = [...cloneSamples, ...next];
        next.forEach((sample) => {
            readDurationSec(sample.file).then((sec) => {
                cloneSamples = cloneSamples.map((s) =>
                    s.id === sample.id ? { ...s, durationSec: sec } : s,
                );
            });
        });
        input.value = "";
    }

    function removeSample(sampleId: string) {
        const target = cloneSamples.find((s) => s.id === sampleId);
        if (target?.url) URL.revokeObjectURL(target.url);
        cloneSamples = cloneSamples.filter((s) => s.id !== sampleId);
    }

    async function handleCreateClone() {
        if (!isModelPersona) return;
        if (!cloneTitle.trim()) {
            toast.warning($t("editPage.voiceClone.titleRequired"));
            return;
        }
        if (cloneSamples.length === 0) {
            toast.warning($t("editPage.voiceClone.samplesRequired"));
            return;
        }
        if (totalDurationSec < 10) {
            toast.warning($t("editPage.voiceClone.minDurationError"));
            return;
        }

        isCreating = true;
        try {
            const result = await createVoiceClone({
                personaType,
                title: cloneTitle.trim(),
                description: cloneDescription.trim(),
                visibility: "private",
                voices: cloneSamples.map((s) => s.file),
                texts: cloneSamples.map((s) => s.text),
            });
            createResult = result;
            selectedVoiceId = result.model_id;
            toast.success($t("editPage.voiceClone.createSuccess"));
            closeCloneModal();

            stopPolling();
            if (result.state !== "trained" && result.state !== "failed") {
                pollingTimer = setInterval(refreshCloneStatus, 5000);
            }
        } catch (e: any) {
            toast.error(e?.message || $t("editPage.voiceClone.createFailed"));
        } finally {
            isCreating = false;
        }
    }

    async function handleTestVoice() {
        if (!selectedVoiceId || !testText.trim()) {
            toast.warning($t("editPage.voiceClone.testInputRequired"));
            return;
        }
        isTesting = true;
        try {
            const blob = await testVoiceCloneSynthesis(
                selectedVoiceId,
                testText.trim(),
            );
            if (testAudioUrl) URL.revokeObjectURL(testAudioUrl);
            testAudioUrl = URL.createObjectURL(blob);
            const audio = new Audio(testAudioUrl);
            await audio.play();
        } catch (e: any) {
            toast.error(e?.message || $t("editPage.voiceClone.testFailed"));
        } finally {
            isTesting = false;
        }
    }

    onDestroy(() => {
        stopPolling();
        stopRecording();
        cloneSamples.forEach((s) => URL.revokeObjectURL(s.url));
        if (testAudioUrl) URL.revokeObjectURL(testAudioUrl);
    });
</script>

{#if isModelPersona}
    <div class="voice-panel">
        <div class="voice-mode-tabs">
            <button type="button" class="active">
                {$t("editPage.voiceClone.modePreset")}
            </button>
            <button type="button" on:click={openCloneModal}>
                {$t("editPage.voiceClone.modeClone")}
            </button>
        </div>

        <div class="voice-select-area">
            <label for="voice-select">{$t("editPage.voiceLabel")}</label>
            <p class="description">{$t("editPage.voiceDescription")}</p>
            {#if allVoices.length > 0}
                <select id="voice-select" bind:value={selectedVoiceId}>
                    <option value="" disabled
                        >{$t("editPage.voiceSelectDefault")}</option
                    >
                    {#if selectedVoiceId && !hasSelectedPresetVoice}
                        <option value={selectedVoiceId}
                            >{selectedVoiceFallbackLabel}</option
                        >
                    {/if}
                    {#each allVoices as voice (voice._id)}
                        <option value={voice._id}
                            >{voice.title} - {voice.description}</option
                        >
                    {/each}
                </select>
            {:else}
                <p>{$t("editPage.voiceLoading")}</p>
            {/if}
        </div>
    </div>

    {#if showCloneModal}
        <div
            class="clone-modal-overlay"
            role="button"
            tabindex="0"
            on:click={closeCloneModal}
            on:keydown={(e) => e.key === "Escape" && closeCloneModal()}
        >
            <div
                class="clone-modal"
                role="dialog"
                aria-modal="true"
                on:click={(e) => e.stopPropagation()}
            >
                <div class="clone-modal-header">
                    <h4>{$t("editPage.voiceClone.modalTitle")}</h4>
                    <button
                        type="button"
                        class="close-btn"
                        on:click={closeCloneModal}
                    >
                        <Icon icon="ph:x-bold" width="16" />
                    </button>
                </div>

                <div class="clone-area">
                    <div class="section intro">
                        <p class="description">
                            {$t("editPage.voiceClone.description")}
                        </p>
                        <p class="notice">
                            {$t("editPage.voiceClone.minDurationNotice")}
                        </p>
                    </div>

                    <div class="section">
                        <div class="field">
                            <label>{$t("editPage.voiceClone.titleLabel")}</label>
                            <input
                                type="text"
                                bind:value={cloneTitle}
                                placeholder={$t(
                                    "editPage.voiceClone.titlePlaceholder",
                                )}
                            />
                        </div>

                        <div class="field">
                            <label>{$t("editPage.voiceClone.descLabel")}</label>
                            <input
                                type="text"
                                bind:value={cloneDescription}
                                placeholder={$t(
                                    "editPage.voiceClone.descPlaceholder",
                                )}
                            />
                        </div>
                    </div>

                    <div class="section">
                        <div class="sample-actions">
                            <button
                                type="button"
                                class="btn secondary"
                                on:click={isRecording
                                    ? stopRecording
                                    : startRecording}
                            >
                                <Icon
                                    icon={isRecording
                                        ? "ph:stop-circle-bold"
                                        : "ph:microphone-bold"}
                                />
                                <span
                                    >{isRecording
                                        ? $t("editPage.voiceClone.stopRecord")
                                        : $t("editPage.voiceClone.startRecord")}</span
                                >
                            </button>

                            <label
                                class="btn secondary file-btn"
                                for="clone-voice-files"
                            >
                                <Icon icon="ph:upload-simple-bold" />
                                <span>{$t("editPage.voiceClone.addFiles")}</span>
                            </label>
                            <input
                                id="clone-voice-files"
                                type="file"
                                accept="audio/*"
                                multiple
                                on:change={onVoiceFilesSelected}
                            />
                        </div>

                        <div class="sample-list">
                            {#if cloneSamples.length === 0}
                                <p class="empty">
                                    {$t("editPage.voiceClone.noSamples")}
                                </p>
                            {:else}
                                {#each cloneSamples as sample, idx (sample.id)}
                                    <div class="sample-item">
                                        <div class="sample-header">
                                            <strong
                                                >{$t("editPage.voiceClone.sample", {
                                                    values: { index: idx + 1 },
                                                })}</strong
                                            >
                                            <button
                                                type="button"
                                                class="remove"
                                                on:click={() =>
                                                    removeSample(sample.id)}
                                            >
                                                {$t("common.delete", {
                                                    default: "Delete",
                                                })}
                                            </button>
                                        </div>
                                        <audio controls src={sample.url}></audio>
                                        <input
                                            type="text"
                                            bind:value={sample.text}
                                            placeholder={$t(
                                                "editPage.voiceClone.sampleTextHint",
                                            )}
                                        />
                                        <p class="sample-meta">
                                            {$t("editPage.voiceClone.sampleDuration", {
                                                values: {
                                                    sec: Math.max(
                                                        0,
                                                        Math.round(
                                                            sample.durationSec,
                                                        ),
                                                    ),
                                                },
                                            })}
                                        </p>
                                    </div>
                                {/each}
                            {/if}
                        </div>
                        <p class="sample-meta total">
                            {$t("editPage.voiceClone.totalDuration", {
                                values: { sec: Math.round(totalDurationSec) },
                            })}
                        </p>
                    </div>

                    <div class="section">
                        <button
                            type="button"
                            class="btn primary create"
                            on:click={handleCreateClone}
                            disabled={isCreating}
                        >
                            {#if isCreating}
                                <Icon icon="ph:spinner-bold" class="spin" />
                            {/if}
                            <span>{$t("editPage.voiceClone.createButton")}</span>
                        </button>

                        {#if createResult}
                            <div class="result-box">
                                <p>
                                    <strong
                                        >{$t("editPage.voiceClone.modelId")}:</strong
                                    >
                                    {createResult.model_id}
                                </p>
                                <p>
                                    <strong
                                        >{$t("editPage.voiceClone.status")}:</strong
                                    >
                                    {createResult.state}
                                </p>
                            </div>
                        {/if}
                    </div>

                    <div class="section test-box">
                        <label>{$t("editPage.voiceClone.testLabel")}</label>
                        <textarea rows="2" bind:value={testText}></textarea>
                        <button
                            type="button"
                            class="btn secondary"
                            on:click={handleTestVoice}
                            disabled={isTesting || !selectedVoiceId}
                        >
                            {#if isTesting}
                                <Icon icon="ph:spinner-bold" class="spin" />
                            {/if}
                            <span>{$t("editPage.voiceClone.testButton")}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    {/if}
{/if}

<style>
    .voice-panel {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    .voice-mode-tabs {
        display: flex;
        gap: 0.5rem;
    }
    .voice-mode-tabs button {
        border: 1px solid var(--border);
        background: var(--muted);
        color: var(--muted-foreground);
        padding: 0.45rem 0.8rem;
        border-radius: 10px;
        cursor: pointer;
    }
    .voice-mode-tabs button.active {
        background: var(--primary);
        color: var(--primary-foreground);
        border-color: var(--primary);
    }
    .voice-select-area select,
    .field input,
    .sample-item input,
    .test-box textarea {
        width: 100%;
        background: var(--background);
        color: var(--foreground);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0.55rem 0.7rem;
    }
    .description {
        font-size: 0.83rem;
        color: var(--muted-foreground);
        margin: 0;
    }
    .notice {
        margin: 0.2rem 0 0;
        font-size: 0.8rem;
        color: #fbbf24;
    }
    .clone-area {
        display: grid;
        gap: 0.75rem;
    }
    .section {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 0.65rem;
        background: color-mix(in oklab, var(--card) 92%, black 8%);
        display: grid;
        gap: 0.55rem;
    }
    .section.intro {
        background: transparent;
        border: none;
        padding: 0.1rem 0.1rem 0.2rem;
    }
    .field {
        display: grid;
        gap: 0.3rem;
    }
    .field label {
        font-size: 0.84rem;
        font-weight: 700;
    }
    .sample-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0.5rem 0.8rem;
        cursor: pointer;
        font-weight: 600;
    }
    .btn.primary {
        background: var(--primary);
        color: var(--primary-foreground);
        border-color: var(--primary);
    }
    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .btn.secondary {
        background: var(--muted);
        color: var(--foreground);
    }
    .file-btn {
        margin: 0;
    }
    #clone-voice-files {
        display: none;
    }
    .sample-list {
        display: grid;
        gap: 0.5rem;
    }
    .sample-item {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0.6rem;
        background: var(--card);
        display: grid;
        gap: 0.45rem;
    }
    .sample-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .sample-meta {
        margin: 0;
        font-size: 0.78rem;
        color: var(--muted-foreground);
    }
    .sample-meta.total {
        margin-top: 0.1rem;
    }
    .remove {
        border: none;
        background: transparent;
        color: var(--muted-foreground);
        cursor: pointer;
        font-size: 0.8rem;
    }
    .empty {
        color: var(--muted-foreground);
        font-size: 0.82rem;
        margin: 0;
    }
    .create {
        width: 100%;
        justify-content: center;
    }
    .result-box,
    .test-box {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0.6rem;
        background: var(--card);
        display: grid;
        gap: 0.4rem;
    }
    .clone-modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
    }
    .clone-modal {
        width: min(800px, 100%);
        max-height: 88vh;
        overflow: auto;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--card);
        padding: 1rem;
    }
    .clone-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.8rem;
        padding: 0 0.1rem;
    }
    .clone-modal-header h4 {
        margin: 0;
        font-size: 1.05rem;
    }
    .close-btn {
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--muted);
        color: var(--foreground);
        width: 34px;
        height: 34px;
        cursor: pointer;
        display: grid;
        place-items: center;
    }
    .spin {
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>

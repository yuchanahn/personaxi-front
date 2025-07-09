<script lang="ts">
    import Icon from "@iconify/svelte";

    export let voices: any[] = [];
    export let onSelect: (voiceId: string) => void = () => {};

    // --- ▼ 추가/수정된 변수 및 로직 ▼ ---

    // 현재 드롭다운에서 선택된 voice_id를 저장할 변수
    let selectedVoiceId: string | null =
        voices.length > 0 ? voices[0].voice_id : null;

    // 선택된 voice_id에 해당하는 전체 voice 객체를 찾아내는 반응형 변수
    $: selectedVoice = voices.find((v) => v.voice_id === selectedVoiceId);

    // 선택된 voice_id가 변경될 때마다 onSelect 콜백 호출
    $: if (selectedVoiceId) {
        onSelect(selectedVoiceId);
    }

    let audioPlayer: HTMLAudioElement | null = null;
    let currentlyPlayingId: string | null = null;

    function togglePreview(voiceId: string, previewUrl: string) {
        if (currentlyPlayingId === voiceId) {
            if (audioPlayer) {
                audioPlayer.pause();
            }
            currentlyPlayingId = null;
        } else {
            if (audioPlayer) {
                audioPlayer.pause();
            }
            audioPlayer = new Audio(previewUrl);
            audioPlayer.play();
            currentlyPlayingId = voiceId;
            audioPlayer.onended = () => {
                currentlyPlayingId = null;
            };
        }
    }

    // 컴포넌트가 파괴될 때 오디오 정지
    import { onDestroy } from "svelte";
    onDestroy(() => {
        if (audioPlayer) {
            audioPlayer.pause();
        }
    });
    // --- ▲ 추가/수정된 변수 및 로직 ▲ ---
</script>

<div class="voice-selector-container">
    <select class="voice-dropdown" bind:value={selectedVoiceId}>
        {#each voices as voice (voice.voice_id)}
            <option value={voice.voice_id}>{voice.name}</option>
        {/each}
    </select>

    {#if selectedVoice}
        <div class="selected-voice-details">
            <div class="voice-labels">
                {#each Object.entries(selectedVoice.labels) as [key, value]}
                    {#if value && typeof value === "string"}
                        <span class="label-tag {key}">{value}</span>
                    {/if}
                {/each}
            </div>
            <div class="voice-actions">
                <button
                    class="action-button"
                    title="미리듣기"
                    on:click={() =>
                        togglePreview(
                            selectedVoice.voice_id,
                            selectedVoice.preview_url,
                        )}
                >
                    <Icon
                        icon={currentlyPlayingId === selectedVoice.voice_id
                            ? "material-symbols:pause"
                            : "material-symbols:play-arrow"}
                        width="24"
                    />
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    /* 기존 style 내용을 아래 코드로 전부 교체해주세요. */
    .voice-selector-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 1rem;
        background-color: #2e2e2e;
        border-radius: 8px;
    }

    .voice-dropdown {
        width: 100%;
        padding: 12px 16px;
        background-color: #4a4a4a;
        color: #f0f0f0;
        border: 1px solid #666;
        border-radius: 6px;
        font-size: 1.1rem;
        font-weight: 600;
        cursor: pointer;
    }

    .voice-dropdown:focus {
        outline: none;
        border-color: #3e6f9f;
    }

    .selected-voice-details {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0 0 0; /* 위쪽 드롭다운과의 간격 */
        border-top: 1px solid #4a4a4a;
    }

    .voice-labels {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
    .label-tag {
        background-color: #4a4a4a;
        color: #ccc;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.75rem;
        text-transform: capitalize;
    }
    .label-tag.gender {
        background-color: #2a4a6a;
    }
    .label-tag.age {
        background-color: #6a4a2a;
    }
    .voice-actions {
        display: flex;
        gap: 10px;
    }
    .action-button {
        background-color: #555;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        transition: background-color 0.2s ease;
    }
    .action-button:hover {
        background-color: #777;
    }
    .action-button.select {
        background-color: #3e6f9f;
    }
    .action-button.select:hover {
        background-color: #5a8fbf;
    }
</style>

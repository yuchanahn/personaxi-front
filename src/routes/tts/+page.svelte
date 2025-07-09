<script lang="ts">
    import VoiceSelector from "$lib/components/tts/VoiceSelector.svelte";
    import { onMount } from "svelte";

    let voiceList: any[] = [];

    onMount(async () => {
        try {
            const response = await fetch("/voices.json"); // static 폴더의 파일을 가리킴
            if (response.ok) {
                const data = await response.json();
                voiceList = data.voices;
            } else {
                console.error("Failed to fetch voices.json");
            }
        } catch (error) {
            console.error("Error loading voices.json:", error);
        }
    });

    function handleVoiceSelect(selectedId: string) {
        alert(`목소리 ID: ${selectedId}를 선택했습니다!`);
        // 여기에 실제로 목소리를 변경하는 로직을 추가하면 됩니다.
    }
</script>

<div class="some-parent-container">
    <VoiceSelector voices={voiceList} onSelect={handleVoiceSelect} />
</div>

<style>
    .some-parent-container {
        width: 100%;
        height: 80vh; /* 부모 컨테이너에 반드시 구체적인 높이가 있어야 합니다 */
        max-width: 500px;
        margin: 2rem auto;
        border: 1px solid #444;
        border-radius: 12px;
        overflow: hidden;
    }
</style>

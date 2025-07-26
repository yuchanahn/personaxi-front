<script lang="ts">
    import Icon from "@iconify/svelte";
    import { ttsState } from "$lib/stores/ttsStore";
    import { t } from "svelte-i18n";
    import type { TTSState } from "$lib/stores/ttsStore";

    // --- 컴포넌트 내부에서 모든 상태를 관리 ---
    let isModalOpen = false;

    const ttsTooltip: Record<TTSState, string> = {
        connecting: "TTS 연결 중...",
        connected: "TTS 연결 완료: 캐릭터 음성이 출력됩니다.",
        disconnected: "TTS 연결 끊김",
    };

    function toggleModal() {
        isModalOpen = !isModalOpen;
    }

    export let impl_connectTTS = () => {};
    export let impl_disconnectTTS = () => {};

    export function connectTTS() {
        console.log("TTS 연결 시도...");
        ttsState.set("connecting");
        impl_connectTTS();
        isModalOpen = false; // 버튼을 누르면 모달은 닫히도록
    }

    export function disconnectTTS() {
        console.log("TTS 연결 끊기...");
        ttsState.set("disconnected");
        impl_disconnectTTS();
        isModalOpen = false; // 버튼을 누르면 모달은 닫히도록
    }

    // --- 모달 외부 클릭 감지 로직 ---
    function clickOutside(node: HTMLElement) {
        const handleClick = (event: MouseEvent) => {
            if (node && !node.contains(event.target as Node)) {
                isModalOpen = false;
            }
        };
        document.addEventListener("click", handleClick, true);
        return {
            destroy() {
                document.removeEventListener("click", handleClick, true);
            },
        };
    }
</script>

<div class="tts-status-wrapper" use:clickOutside>
    <button
        class="tts-status-button {$ttsState}"
        title={ttsTooltip[$ttsState]}
        on:click|stopPropagation={toggleModal}
    >
        {#if $ttsState === "connected"}
            <Icon icon="ph:speaker-high-bold" width="24" height="24" />
        {:else if $ttsState === "disconnected"}
            <Icon icon="ph:speaker-slash-bold" width="24" height="24" />
        {:else}
            <Icon icon="ph:dots-three-bold" width="24" height="24" />
        {/if}
    </button>

    {#if isModalOpen}
        <div class="tts-modal">
            {#if $ttsState === "connected"}
                <p>{$t("tts.connectedMessage")}</p>
                <button class="modal-button disconnect" on:click={disconnectTTS}
                    >{$t("tts.disconnectButton")}</button
                >
            {:else if $ttsState === "disconnected"}
                <p>{$t("tts.disconnectedMessage")}</p>
                <button class="modal-button connect" on:click={connectTTS}
                    >{$t("tts.reconnectButton")}</button
                >
            {:else}
                <p>{$t("tts.connectingMessage")}</p>
            {/if}
        </div>
    {/if}
</div>

<style>
    .tts-status-wrapper {
        position: absolute;
        top: 110px;
        right: 20px;
        z-index: 100;
    }

    .tts-status-button {
        padding: 8px;
        border-radius: 50%;
        background-color: rgba(0, 0, 0, 0.5);
        color: white;
        transition: all 0.3s ease;
        border: none;
        cursor: pointer;
        display: flex; /* 아이콘 중앙 정렬을 위해 */
        align-items: center;
        justify-content: center;
    }

    .tts-status-button:hover {
        background-color: rgba(0, 0, 0, 0.7);
    }

    .tts-status-button.connecting {
        color: #9ca3af; /* 회색 */
    }
    .tts-status-button.connected {
        color: #4ade80; /* 초록색 */
    }
    .tts-status-button.disconnected {
        color: #f87171; /* 붉은색 */
    }

    .tts-modal {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 8px;
        width: 220px;
        background-color: #1e1e1e;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 1rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        color: #e0e0e0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .tts-modal p {
        margin: 0;
        font-size: 0.9rem;
    }

    .modal-button {
        width: 100%;
        padding: 0.5rem;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .modal-button.connect {
        background-color: #4a90e2;
        color: white;
    }
    .modal-button.connect:hover {
        background-color: #62a2e9;
    }

    .modal-button.disconnect {
        background-color: #e24a4a;
        color: white;
    }
    .modal-button.disconnect:hover {
        background-color: #ff6b6b;
    }
</style>

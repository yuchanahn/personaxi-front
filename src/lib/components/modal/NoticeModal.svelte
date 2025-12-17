<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { fade } from "svelte/transition";
    import { onMount, onDestroy } from "svelte";
    import Icon from "@iconify/svelte";
    import { t } from "svelte-i18n";
    import AssetPreview from "../AssetPreview.svelte";
    import type { ImageMetadata } from "$lib/types";

    const dispatch = createEventDispatcher();

    function closeModal() {
        dispatch("close");
    }

    // Escape 키를 누르면 모달이 닫히도록 설정
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

    let asset: ImageMetadata = {
        description: "PersonaXi",
        url: "/event_01.mp4",
        type: "video",
    };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="modal-backdrop"
    on:click={closeModal}
    transition:fade={{ duration: 200 }}
>
    <div class="modal-container" on:click|stopPropagation>
        <button class="close-button" on:click={closeModal} aria-label="닫기">
            <Icon icon="ph:x-bold" />
        </button>
        <div class="modal-content">
            <h2 class="modal-title">
                <Icon icon="ph:sparkle-duotone" />
                <span>{$t("noticeModal.title")}</span>
            </h2>
            <p class="subtitle">{$t("noticeModal.subtitle")}</p>

            <div class="modal-body">
                <AssetPreview {asset} />
                <p>
                    {@html $t("noticeModal.description1")}
                    <br /><br />
                    {@html $t("noticeModal.description2")}
                </p>

                <div class="info-section benefits">
                    <h3 class="info-title">
                        <Icon icon="ph:gift-duotone" />
                        {$t("noticeModal.benefitTitle")}
                    </h3>
                    <ul class="benefit-list">
                        <li>{@html $t("noticeModal.benefit1")}</li>
                        <li>{@html $t("noticeModal.benefit2")}</li>
                    </ul>
                    <p class="benefit-total">
                        {@html $t("noticeModal.benefitTotal")}
                    </p>
                </div>

                <div class="info-section notice">
                    <h3 class="info-title">
                        <Icon icon="ph:megaphone-duotone" />
                        {$t("noticeModal.noteTitle")}
                    </h3>
                    <ul class="notice-list">
                        <li>{$t("noticeModal.note1")}</li>
                        <li>{$t("noticeModal.note2")}</li>
                    </ul>
                </div>
            </div>

            <button class="confirm-button" on:click={closeModal}>
                <Icon icon="ph:rocket-launch-duotone" />
                <span>{$t("noticeModal.confirm")}</span>
            </button>
        </div>
    </div>
</div>

<!-- 
<div
    class="modal-backdrop"
    on:click={closeModal}
    transition:fade={{ duration: 200 }}
>
    <div class="modal-container" on:click|stopPropagation>
        <button class="close-button" on:click={closeModal} aria-label="닫기">
            <Icon icon="ph:x-bold" />
        </button>

        <div class="modal-content">
            <h2 class="modal-title">
                <Icon icon="ph:sparkle-duotone" />
                <span>{$t("noticeModal.title")}</span>
            </h2>

            <div class="modal-body">
                <p>
                    {@html $t("noticeModal.description1")}
                    <br /><br />
                    {@html $t("noticeModal.description2")}
                </p>

                <div class="info-section">
                    <h3 class="info-title">
                        <Icon icon="ph:robot-duotone" />
                        {$t("noticeModal.techStackTitle")}
                    </h3>
                    <p>
                        {$t("noticeModal.techStackDescription")}
                    </p>
                    <ul class="tech-list">
                        <li>
                            <strong>{$t("noticeModal.aiModel")}</strong> Google Gemini
                            2.5 Flash & Lite
                        </li>
                        <li>
                            <strong>{$t("noticeModal.ttsModel")}</strong> ElevenLabs
                        </li>
                        <li>
                            <strong>{$t("noticeModal.vrmModel")}</strong> Pixiv VRM
                        </li>
                    </ul>
                </div>

                <div class="info-section">
                    <h3 class="info-title">
                        <Icon icon="ph:warning-circle-duotone" />
                        {$t("noticeModal.aiWarningTitle")}
                    </h3>
                    <p>
                        {@html $t("noticeModal.aiWarningDescription")}
                    </p>
                </div>
            </div>

            <button class="confirm-button" on:click={closeModal}>
                <span>{$t("noticeModal.confirm")}</span>
            </button>
        </div>
    </div>
</div> -->

<style>
    .modal-backdrop {
        position: fixed;
        top: 10%;
        left: 0;
        bottom: 20%;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    }

    .modal-container {
        position: relative;
        background: #2a2a2a;
        color: #e0e0e0;
        padding: 2.5rem;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        width: 90%;
        max-width: 500px;
        border: 1px solid #444;

        /* --- 스크롤을 위한 핵심 스타일 --- */
        max-height: 85vh;
        display: flex;
        flex-direction: column;
    }

    .close-button {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        color: #888;
        cursor: pointer;
        font-size: 1.5rem;
        line-height: 1;
        padding: 0.5rem;
        transition: color 0.2s;
    }
    .close-button:hover {
        color: white;
    }

    .modal-content {
        display: flex;
        flex-direction: column;
        flex-grow: 1; /* 남는 공간을 모두 차지 */
        overflow: hidden; /* 내부 body가 스크롤되도록 */
    }

    .modal-title {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 1rem 0;
        color: white;
        flex-shrink: 0; /* 제목은 줄어들지 않도록 */
    }

    .modal-body {
        text-align: left;
        font-size: 0.95rem;
        line-height: 1.6;
        margin: 0 0 2rem 0;
        color: #ccc;

        /* --- 스크롤을 위한 핵심 스타일 --- */
        flex-grow: 1;
        overflow-y: auto;
        padding-right: 1rem; /* 스크롤바와 내용 간격 */
    }

    /* --- strong 태그 스타일 수정 --- */
    .modal-body strong {
        font-weight: 700;
        color: #ffffff;
    }

    .confirm-button {
        width: 100%;
        padding: 0.8rem;
        font-size: 1rem;
        font-weight: bold;
        color: #fff;
        background: linear-gradient(45deg, #ff79c6, #bd93f9);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    .confirm-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }
    .confirm-button span {
        margin-left: 0.5rem;
    }

    .info-section {
        background-color: rgba(0, 0, 0, 0.2);
        border: 1px solid #444;
        border-radius: 12px;
        padding: 1rem 1.5rem;
        margin: 1.5rem 0;
    }

    .info-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.1rem;
        font-weight: 600;
        color: #e0e0e0;
        margin: 0 0 0.5rem 0;
    }

    .tech-list {
        list-style-type: "⚡️";
        padding-left: 1.5rem;
    }

    .tech-list li {
        padding-left: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .final-notice strong {
        font-weight: 700;
    }

    /* --- 이벤트 모달 스타일 --- */
    .subtitle {
        font-size: 1.2rem;
        font-weight: 600;
        color: #ffd700;
        text-align: center;
        margin: 0 0 1rem 0;
    }

    .benefit-list,
    .notice-list {
        list-style: none;
        padding: 0;
        margin: 0.5rem 0;
    }

    .benefit-list li {
        padding: 0.5rem 0;
        padding-left: 1.5rem;
        position: relative;
    }

    .benefit-list li::before {
        content: "✓";
        position: absolute;
        left: 0;
        color: #4ade80;
    }

    .notice-list li {
        padding: 0.3rem 0;
        padding-left: 1.5rem;
        position: relative;
        font-size: 0.9rem;
        color: #aaa;
    }

    .notice-list li::before {
        content: "•";
        position: absolute;
        left: 0.5rem;
    }

    .benefit-total {
        text-align: center;
        font-size: 1.1rem;
        padding: 0.75rem;
        margin: 0.5rem 0 0 0;
        background: linear-gradient(
            135deg,
            rgba(255, 215, 0, 0.1),
            rgba(255, 215, 0, 0.05)
        );
        border-radius: 8px;
        border: 1px solid rgba(255, 215, 0, 0.3);
    }

    .benefits {
        border-color: rgba(255, 215, 0, 0.3);
        background: rgba(255, 215, 0, 0.05);
    }

    /* --- 스크롤바 디자인 --- */
    .modal-body::-webkit-scrollbar {
        width: 8px;
    }
    .modal-body::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
    }
    .modal-body::-webkit-scrollbar-thumb {
        background: #555;
        border-radius: 4px;
    }
    .modal-body::-webkit-scrollbar-thumb:hover {
        background: #777;
    }
</style>

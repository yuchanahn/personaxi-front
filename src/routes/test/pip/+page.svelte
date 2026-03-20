<script lang="ts">
    import { browser } from "$app/environment";
    import { onDestroy } from "svelte";

    type DocumentPictureInPictureAPI = {
        window: Window | null;
        requestWindow(options?: {
            width?: number;
            height?: number;
            disallowReturnToOpener?: boolean;
        }): Promise<Window>;
    };

    let status = "대기 중";
    let isOpen = false;
    let pipWindow: Window | null = null;
    let shareStatus = "대기 중";
    let captureStream: MediaStream | null = null;
    let previewVideoEl: HTMLVideoElement | null = null;

    function getDocumentPiP(): DocumentPictureInPictureAPI | undefined {
        if (!browser) return undefined;

        return (window as Window & {
            documentPictureInPicture?: DocumentPictureInPictureAPI;
        }).documentPictureInPicture;
    }

    function setStatus(next: string) {
        status = next;
    }

    function setShareStatus(next: string) {
        shareStatus = next;
    }

    function getDisplayMediaSupported() {
        if (!browser) return false;
        return typeof navigator.mediaDevices?.getDisplayMedia === "function";
    }

    function writePiPMarkup(target: Window) {
        const doc = target.document;

        doc.body.innerHTML = `
            <div class="mini-bar" role="dialog" aria-label="떠있는 미니 바">
                <div class="mini-bar__left">
                    <div class="mini-bar__dot"></div>
                    <div class="mini-bar__copy">
                        <strong>PersonaXi Mini Bar</strong>
                        <span>브라우저 밖에 뜨는 Document PiP 데모</span>
                    </div>
                </div>
                <div class="mini-bar__actions">
                    <button class="mini-bar__button mini-bar__button--ghost" data-action="ping" type="button">
                        핑
                    </button>
                    <button class="mini-bar__button mini-bar__button--primary" data-action="close" type="button">
                        닫기
                    </button>
                </div>
            </div>
        `;

        const style = doc.createElement("style");
        style.textContent = `
            :root {
                color-scheme: dark;
            }

            html, body {
                margin: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: transparent;
                font-family: Inter, "Segoe UI", system-ui, sans-serif;
            }

            body {
                display: flex;
                align-items: stretch;
                justify-content: stretch;
                padding: 0;
            }

            .mini-bar {
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                width: 100%;
                height: 100%;
                padding: 10px 12px;
                border: 1px solid rgba(255,255,255,.12);
                border-radius: 16px;
                background: linear-gradient(180deg, rgba(24,27,36,.98), rgba(14,17,24,.98));
                color: #f4f7fb;
                box-shadow:
                    0 12px 24px rgba(0,0,0,.32),
                    inset 0 1px 0 rgba(255,255,255,.04);
            }

            .mini-bar__left {
                display: flex;
                align-items: center;
                gap: 10px;
                min-width: 0;
                flex: 1 1 auto;
            }

            .mini-bar__dot {
                flex: 0 0 auto;
                width: 10px;
                height: 10px;
                border-radius: 999px;
                background: #34d399;
                box-shadow: 0 0 16px rgba(52, 211, 153, .65);
            }

            .mini-bar__copy {
                display: flex;
                flex-direction: column;
                min-width: 0;
            }

            .mini-bar__copy strong {
                font-size: 13px;
                line-height: 1.2;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .mini-bar__copy span {
                font-size: 11px;
                line-height: 1.3;
                color: rgba(244,247,251,.66);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .mini-bar__actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 0 0 auto;
            }

            .mini-bar__button {
                appearance: none;
                -webkit-appearance: none;
                min-height: 34px;
                padding: 0 12px;
                border-radius: 10px;
                border: 1px solid rgba(255,255,255,.12);
                color: #f4f7fb;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
            }

            .mini-bar__button--ghost {
                background: rgba(255,255,255,.06);
            }

            .mini-bar__button--primary {
                background: linear-gradient(180deg, #3b82f6, #2563eb);
                border-color: rgba(59,130,246,.45);
            }
        `;

        doc.head.innerHTML = "";
        doc.head.appendChild(style);

        doc.body.querySelector('[data-action="ping"]')?.addEventListener("click", () => {
            window.dispatchEvent(new CustomEvent("pip-demo-message", { detail: "핑 버튼 눌림" }));
        });

        doc.body.querySelector('[data-action="close"]')?.addEventListener("click", () => {
            target.close();
        });
    }

    async function openMiniBar() {
        const dpip = getDocumentPiP();
        if (!dpip) {
            setStatus("이 브라우저는 Document PiP를 지원하지 않음");
            return;
        }

        if (pipWindow && !pipWindow.closed) {
            pipWindow.focus();
            setStatus("이미 떠 있음");
            return;
        }

        try {
            const win = await dpip.requestWindow({
                width: 460,
                height: 86,
                disallowReturnToOpener: true,
            });

            pipWindow = win;
            isOpen = true;
            writePiPMarkup(win);
            setStatus("미니 바 열림");

            win.addEventListener("pagehide", () => {
                pipWindow = null;
                isOpen = false;
                setStatus("미니 바 닫힘");
            });
        } catch (error) {
            console.error(error);
            setStatus("열기 실패");
        }
    }

    function closeMiniBar() {
        if (!pipWindow || pipWindow.closed) {
            setStatus("닫을 창 없음");
            return;
        }

        pipWindow.close();
    }

    function bindPreviewStream(stream: MediaStream | null) {
        if (!previewVideoEl) return;
        previewVideoEl.srcObject = stream;
    }

    function stopActiveShare(markStatus = true) {
        captureStream?.getTracks().forEach((track) => track.stop());
        captureStream = null;
        bindPreviewStream(null);
        if (markStatus) {
            setShareStatus("화면공유 중지됨");
        }
    }

    async function startScreenShare() {
        if (!getDisplayMediaSupported()) {
            setShareStatus("이 브라우저는 getDisplayMedia를 지원하지 않음");
            return;
        }

        if (captureStream) {
            setShareStatus("이미 화면공유 중");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
            });

            captureStream = stream;
            bindPreviewStream(stream);
            setShareStatus("화면공유 시작됨");

            const [videoTrack] = stream.getVideoTracks();
            videoTrack?.addEventListener("ended", () => {
                captureStream = null;
                bindPreviewStream(null);
                setShareStatus("브라우저/사용자에 의해 화면공유 종료됨");
            });
        } catch (error) {
            console.error(error);
            setShareStatus("화면공유 시작 실패 또는 취소");
        }
    }

    if (browser) {
        window.addEventListener("pip-demo-message", ((event: CustomEvent<string>) => {
            setStatus(event.detail);
        }) as EventListener);
    }

    onDestroy(() => {
        stopActiveShare(false);
        if (pipWindow && !pipWindow.closed) {
            pipWindow.close();
        }
    });
</script>

<svelte:head>
    <title>Document PiP Test</title>
</svelte:head>

<div class="page">
    <div class="panel">
        <div class="eyebrow">/test/pip</div>
        <h1>떠있는 미니 바 데모</h1>
        <p class="desc">
            이건 브라우저가 화면공유 때 띄우는 특권 UI 자체는 아니고, 웹에서 제일 비슷하게 만들 수
            있는 <code>Document Picture-in-Picture</code> 데모입니다.
        </p>

        <div class="actions">
            <button class="action action--primary" on:click={openMiniBar}>미니 바 열기</button>
            <button class="action" on:click={closeMiniBar}>닫기</button>
        </div>

        <div class="status-box">
            <div><strong>지원 여부</strong>: {getDocumentPiP() ? "지원됨" : "지원 안 됨"}</div>
            <div><strong>상태</strong>: {status}</div>
            <div><strong>열림</strong>: {isOpen ? "yes" : "no"}</div>
        </div>

        <ul class="notes">
            <li>Chrome/Edge 계열에서만 기대하는 게 맞습니다.</li>
            <li>일반 웹페이지 DOM이 아니라 별도 PiP 창으로 뜹니다.</li>
            <li>이 안에 HTML, 버튼, canvas, Live2D 캔버스도 넣을 수는 있습니다.</li>
            <li>다만 화면공유 컨트롤 바 자체처럼 브라우저 특권 UI를 그대로 복제하는 건 아닙니다.</li>
        </ul>

        <hr />

        <h2>gifcap 방식 확인</h2>
        <p class="desc">
            아래 버튼은 <code>getDisplayMedia()</code>를 직접 호출합니다. 이걸 누르면 gifcap처럼
            브라우저가 자기 공유 컨트롤 바를 띄워야 합니다.
        </p>

        <div class="actions">
            <button class="action action--primary" on:click={startScreenShare}>화면공유 시작</button>
            <button class="action" on:click={() => stopActiveShare()}>화면공유 중지</button>
        </div>

        <div class="status-box">
            <div><strong>지원 여부</strong>: {getDisplayMediaSupported() ? "지원됨" : "지원 안 됨"}</div>
            <div><strong>상태</strong>: {shareStatus}</div>
            <div><strong>stream</strong>: {captureStream ? "active" : "none"}</div>
        </div>

        <div class="preview-frame">
            <!-- svelte-ignore a11y_media_has_caption -->
            <video bind:this={previewVideoEl} autoplay muted playsinline></video>
        </div>
    </div>
</div>

<style>
    .page {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #0b0d12;
        color: #f3f5f8;
    }

    .panel {
        width: min(100%, 760px);
        padding: 28px;
        border-radius: 24px;
        background: linear-gradient(180deg, #141821, #0f131b);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.32);
    }

    .eyebrow {
        color: #8fb3ff;
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.04em;
    }

    h1 {
        margin: 8px 0 12px;
        font-size: clamp(1.8rem, 3vw, 2.4rem);
        line-height: 1.1;
    }

    .desc {
        margin: 0;
        color: rgba(243, 245, 248, 0.74);
        line-height: 1.7;
    }

    code {
        padding: 0.12rem 0.38rem;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.08);
        font-size: 0.92em;
    }

    .actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 18px;
    }

    .action {
        appearance: none;
        -webkit-appearance: none;
        min-height: 42px;
        padding: 0 14px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.06);
        color: #f3f5f8;
        font-weight: 700;
        cursor: pointer;
    }

    .action--primary {
        background: linear-gradient(180deg, #3b82f6, #2563eb);
        border-color: rgba(59, 130, 246, 0.5);
    }

    .status-box {
        margin-top: 18px;
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        line-height: 1.8;
    }

    .notes {
        margin: 18px 0 0;
        padding-left: 18px;
        color: rgba(243, 245, 248, 0.72);
        line-height: 1.7;
    }

    hr {
        border: 0;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        margin: 22px 0;
    }

    h2 {
        margin: 0 0 12px;
        font-size: 1.2rem;
        line-height: 1.2;
    }

    .preview-frame {
        margin-top: 18px;
        border-radius: 18px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        min-height: 220px;
        display: grid;
        place-items: center;
    }

    .preview-frame video {
        display: block;
        width: 100%;
        min-height: 220px;
        background: #05070c;
        object-fit: contain;
    }

    @media (max-width: 640px) {
        .panel {
            padding: 20px;
            border-radius: 18px;
        }
    }
</style>

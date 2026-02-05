<script lang="ts">
    import { onMount } from "svelte";
    import { tick } from "svelte";

    let text = "";
    let realInput: HTMLInputElement;

    let keyboardHeight = 0;
    let isKeyboardOpen = false;
    let closing = false;

    function computeDiff() {
        const vv = window.visualViewport;
        if (!vv) return 0;
        const diff = window.innerHeight - vv.height - vv.offsetTop;
        return Math.max(0, diff);
    }

    function applyFromViewport() {
        const diff = computeDiff();

        if (!closing) isKeyboardOpen = diff > 10;
        keyboardHeight = closing ? 0 : diff > 10 ? diff : 0;
    }

    async function openKeyboard(e: Event) {
        // iOS: 사용자 제스처 콜스택 안에서 focus가 일어나야 함
        e.preventDefault();

        // 1) 먼저 UI를 "열림 상태"로 만들어서 input이 실제로 보이게
        closing = false;
        isKeyboardOpen = true;

        // 2) DOM 반영을 기다린 뒤(한 틱) focus
        await tick();

        // 3) 바로 focus + 커서 보이게
        realInput?.focus({ preventScroll: true });
    }

    onMount(() => {
        const vv = window.visualViewport;

        const onVV = () => applyFromViewport();

        const onFocusIn = (e: FocusEvent) => {
            if (e.target === realInput) {
                closing = false;
                isKeyboardOpen = true;
                applyFromViewport();
            }
        };

        const onFocusOut = (e: FocusEvent) => {
            if (e.target === realInput) {
                closing = true;
                isKeyboardOpen = false;
                keyboardHeight = 0;

                let tries = 0;
                const tickClose = () => {
                    tries++;
                    const d = computeDiff();
                    if (d < 10 || tries > 30) {
                        closing = false;
                        keyboardHeight = 0;
                        return;
                    }
                    requestAnimationFrame(tickClose);
                };
                requestAnimationFrame(tickClose);
            }
        };

        vv?.addEventListener("resize", onVV, { passive: true });
        vv?.addEventListener("scroll", onVV, { passive: true });

        document.addEventListener("focusin", onFocusIn, true);
        document.addEventListener("focusout", onFocusOut, true);

        applyFromViewport();

        return () => {
            vv?.removeEventListener("resize", onVV);
            vv?.removeEventListener("scroll", onVV);
            document.removeEventListener("focusin", onFocusIn, true);
            document.removeEventListener("focusout", onFocusOut, true);
        };
    });
</script>

<div class="app-wrapper" style:height="100dvh">
    <main class="scroll-area">
        <div class="content-padding">
            {#each Array(30) as _, i}
                <div class="card">채팅 내역 {i + 1}</div>
            {/each}
        </div>
    </main>

    <footer
        class="visual-chat-bar"
        style:transform="translateY(-{keyboardHeight}px)"
    >
        <div class="input-container">
            <!-- 닫힘 상태: 버튼 -->
            {#if !isKeyboardOpen}
                <button
                    type="button"
                    class="input-button"
                    on:pointerdown={openKeyboard}
                >
                    {#if text}
                        {text}
                    {:else}
                        <span class="placeholder">메시지를 입력하세요...</span>
                    {/if}
                </button>
            {/if}

            <!-- 열림 상태: 실제 인풋 -->
            <input
                bind:this={realInput}
                bind:value={text}
                type="text"
                class="real-input"
                class:shown={isKeyboardOpen}
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
            />
        </div>

        <button class="send-btn" type="button">전송</button>
    </footer>
</div>

<style>
    :global(html, body) {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden !important;
        position: fixed;
    }

    .app-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .scroll-area {
        flex: 1;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
    }

    .content-padding {
        padding: 16px 16px 80px 16px;
    }

    .card {
        background: rgba(255, 255, 255, 0.8);
        margin-bottom: 12px;
        padding: 15px;
        border-radius: 12px;
    }

    .visual-chat-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        background: white;
        color: black;
        padding: 10px 16px;
        display: flex;
        gap: 10px;
        box-sizing: border-box;
        border-top: 1px solid #ddd;
        z-index: 100;
        transition: transform 0.1s ease-out;
    }

    .input-container {
        position: relative;
        flex: 1;
        min-height: 40px;
        display: flex;
        align-items: center;
    }

    /* 버튼처럼 보이는 가짜 입력 */
    .input-button {
        width: 100%;
        min-height: 40px;
        background: #f1f1f1;
        border-radius: 20px;
        padding: 10px 15px;
        font-size: 16px;
        display: flex;
        align-items: center;
        border: none;
        text-align: left;
        white-space: pre-wrap;
    }

    /* 실제 input: 기본은 같은 위치에 있으나 "비활성/투명" */
    .real-input {
        position: absolute;
        left: 0;
        top: 0; /* ✅ 화면 밖으로 보내지 말기 */
        width: 100%;
        height: 40px;
        padding: 10px 15px;
        font-size: 16px;
        box-sizing: border-box;
        border: none;
        outline: none;
        background: #f1f1f1;
        border-radius: 20px;

        opacity: 0;
        pointer-events: none;
    }

    /* 열리면 보이고 입력 가능 */
    .real-input.shown {
        opacity: 1;
        pointer-events: auto;
    }

    .send-btn {
        background: #007bff;
        color: white;
        border: none;
        border-radius: 20px;
        padding: 0 18px;
        font-weight: bold;
    }

    .placeholder {
        color: #888;
    }
</style>

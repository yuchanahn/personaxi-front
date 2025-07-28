<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from "svelte";
    import { api } from "$lib/api";

    export let isVisible: boolean = false; // 콘솔의 가시성 제어 (부모 컴포넌트에서 바인딩)

    let commandInput: string = ""; // 입력 필드의 값
    let messages: string[] = []; // 콘솔 메시지 (실행 결과 등)
    let currentCredits: number = 0; // 유저 크레딧 표시용

    const dispatch = createEventDispatcher(); // 이벤트 디스패처 (콘솔 닫기 이벤트 등)

    // 치트 명령어를 실행하는 함수
    async function performCheat(cmd: string) {
        if (!cmd.trim()) {
            // 입력이 비어있으면 아무것도 안 함
            addMessage("❌ 명령어를 입력해주세요.");
            return;
        }

        addMessage(`➡️ ${cmd} 명령어 실행 중...`);

        try {
            const response = await api.get(`/api/cheat?cmd=${cmd}`);

            if (response.ok) {
                const message = `✅ '${cmd}' 치트 실행 성공!`;
                addMessage(message);
            } else {
                const errorText = await response.text();
                const message = `❌ '${cmd}' 치트 실행 실패: ${response.status} - ${errorText}`;
                addMessage(message);
            }
        } catch (error: any) {
            // 'any' 타입으로 캐스팅하여 error.message 접근
            const message = `⚠️ '${cmd}' 실행 중 네트워크 오류: ${error.message}`;
            addMessage(message);
        }
    }

    // 엔터 키 입력 시 명령어 실행
    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "Enter") {
            event.preventDefault(); // 기본 엔터 동작 방지 (예: 폼 제출)
            performCheat(commandInput);
            commandInput = ""; // 입력 필드 초기화
        } else if (event.key === "Escape") {
            // ESC 키로 콘솔 닫기
            dispatch("close");
        }
    }

    // 메시지를 콘솔에 추가하고 스크롤을 맨 아래로 내림
    function addMessage(msg: string) {
        messages = [...messages, msg];
        // 콘솔이 렌더링된 후에 스크롤해야 함
        setTimeout(() => {
            const consoleOutput = document.querySelector(".console-output");
            if (consoleOutput) {
                consoleOutput.scrollTop = consoleOutput.scrollHeight;
            }
        }, 0);
    }

    // 컴포넌트 파괴 시 스토어 구독 해제
    onDestroy(() => {
        //unsubscribe();
    });

    // 콘솔이 열릴 때 입력 필드에 포커스
    $: if (isVisible) {
    }
</script>

{#if isVisible}
    <div class="cheat-console-overlay" role="dialog" aria-modal="true">
        <div class="console-window">
            <div class="console-header">
                <h3>console</h3>
                <button class="close-btn" on:click={() => dispatch("close")}
                    >&times;</button
                >
            </div>
            <div class="console-output">
                {#each messages as msg}
                    <p>{msg}</p>
                {/each}
            </div>
            <div class="console-input-area">
                <span>$</span>
                <input
                    type="text"
                    bind:value={commandInput}
                    on:keydown={handleKeyDown}
                    class="console-input"
                    placeholder="명령어를 입력하세요"
                />
            </div>
        </div>
    </div>
{/if}

<style>
    .cheat-console-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.7); /* 반투명 배경 */
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000; /* 다른 요소 위에 표시 */
        backdrop-filter: blur(5px); /* 배경 흐림 효과 */
    }

    .console-window {
        background: #1a1a1a;
        border: 1px solid #444;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
        width: 80%;
        max-width: 700px;
        height: 70%;
        max-height: 500px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .console-header {
        background: #2a2a2a;
        padding: 0.8rem 1.2rem;
        border-bottom: 1px solid #444;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #eee;
    }

    .console-header h3 {
        margin: 0;
        font-size: 1.2em;
    }

    .console-header p {
        margin: 0;
        font-size: 0.9em;
        color: #bbb;
    }

    .close-btn {
        background: none;
        border: none;
        color: #eee;
        font-size: 1.5em;
        cursor: pointer;
        padding: 0.2rem 0.5rem;
        transition: color 0.2s;
    }

    .close-btn:hover {
        color: #ff6b6b;
    }

    .console-output {
        flex: 1;
        padding: 1rem;
        overflow-y: auto; /* 내용이 많으면 스크롤 */
        font-family: "Consolas", "Monaco", monospace; /* 고정폭 폰트 */
        font-size: 0.9em;
        line-height: 1.4;
        color: #eee;
        background: #000; /* 출력 배경을 더 어둡게 */
        border-bottom: 1px solid #444;
    }

    .console-output p {
        margin: 0;
        white-space: pre-wrap; /* 긴 줄 자동 줄 바꿈 */
    }

    .console-output p:first-child {
        margin-top: 0;
    }
    .console-output p:last-child {
        margin-bottom: 0;
    }

    /* 메시지 타입별 색상 */
    .console-output p:has(span) {
        /* span이 포함된 p 태그 */
        color: #fff; /* 기본 */
    }
    .console-output p:has(span.error) {
        color: #ff6b6b; /* 빨간색 */
    }
    .console-output p:has(span.success) {
        color: #4caf50; /* 초록색 */
    }
    .console-output p:has(span.warning) {
        color: #ffc107; /* 노란색 */
    }
    .console-output p:has(span.info) {
        color: #2196f3; /* 파란색 */
    }

    .console-input-area {
        display: flex;
        align-items: center;
        padding: 0.8rem 1rem;
        background: #222;
        border-top: 1px solid #444;
    }

    .console-input-area span {
        color: #888;
        margin-right: 0.5rem;
        font-family: "Consolas", "Monaco", monospace;
        font-size: 1em;
    }

    .console-input {
        flex: 1;
        background: #333;
        border: 1px solid #555;
        border-radius: 4px;
        padding: 0.6rem;
        color: #eee;
        font-family: "Consolas", "Monaco", monospace;
        font-size: 1em;
        outline: none; /* 포커스 시 테두리 제거 */
        transition: border-color 0.2s;
    }

    .console-input:focus {
        border-color: #007bff; /* 포커스 시 강조색 */
    }
</style>

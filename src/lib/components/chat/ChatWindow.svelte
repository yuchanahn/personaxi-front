<script lang="ts">
  import { onMount } from "svelte";
  import { marked } from "marked";
  import { messages } from "$lib/stores/messages";
  import SettingsModal from "$lib/components/modal/SettingModal.svelte";

  export let isLoading: boolean = false;
  export let cssid: string;
  export let showChat: boolean = true; // 채팅 표시 여부

  let isThink: boolean = false;

  onMount(() => {
    const el = document.querySelector(".chat-window");
    const observer = new MutationObserver(() => {
      el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    if (el) observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect(); // 컴포넌트 언마운트 시 정리
  });

  function stripEmotions(text: string) {
    text = text.replace(/<emo:[^>]+>/g, "");
    text = text.replace(/<act:[^>]+>/g, "");
    return text.replace(/<표정:[^>]+>/g, "");
  }

  function print(text: string) {
    const think_start = text.includes("<think>");
    const think_end = text.includes("</think>");

    if (think_start && !think_end) {
      isThink = true;
      text = "";
    }

    if (think_start && think_end) {
      isThink = false;
    }

    //text = text.replace(/<think[^>]*>[\s\S]*?<\/think>/g, "");
    //text = stripEmotions(text);

    return marked(text);
  }

  let isSettingsModalOpen = false;
</script>

<!-- NEW: 설정 버튼 -->
<!-- svelte-ignore a11y_consider_explicit_label -->
<button class="settings-button" on:click={() => (isSettingsModalOpen = true)}>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    ><path
      fill="currentColor"
      fill-rule="evenodd"
      d="M13.984 2.542c.087.169.109.386.152.82c.082.82.123 1.23.295 1.456a1 1 0 0 0 .929.384c.28-.037.6-.298 1.238-.82c.337-.277.506-.415.687-.473a1 1 0 0 1 .702.035c.175.076.33.23.637.538l.894.894c.308.308.462.462.538.637a1 1 0 0 1 .035.702c-.058.181-.196.35-.472.687c-.523.639-.784.958-.822 1.239a1 1 0 0 0 .385.928c.225.172.636.213 1.457.295c.433.043.65.065.82.152a1 1 0 0 1 .47.521c.071.177.071.395.071.831v1.264c0 .436 0 .654-.07.83a1 1 0 0 1-.472.522c-.169.087-.386.109-.82.152c-.82.082-1.23.123-1.456.295a1 1 0 0 0-.384.929c.038.28.299.6.821 1.238c.276.337.414.505.472.687a1 1 0 0 1-.035.702c-.076.175-.23.329-.538.637l-.894.893c-.308.309-.462.463-.637.538a1 1 0 0 1-.702.035c-.181-.058-.35-.196-.687-.472c-.639-.522-.958-.783-1.238-.82a1 1 0 0 0-.929.384c-.172.225-.213.635-.295 1.456c-.043.434-.065.651-.152.82a1 1 0 0 1-.521.472c-.177.07-.395.07-.831.07h-1.264c-.436 0-.654 0-.83-.07a1 1 0 0 1-.522-.472c-.087-.169-.109-.386-.152-.82c-.082-.82-.123-1.23-.295-1.456a1 1 0 0 0-.928-.384c-.281.037-.6.298-1.239.82c-.337.277-.506.415-.687.473a1 1 0 0 1-.702-.035c-.175-.076-.33-.23-.637-.538l-.894-.894c-.308-.308-.462-.462-.538-.637a1 1 0 0 1-.035-.702c.058-.181.196-.35.472-.687c.523-.639.784-.958.821-1.239a1 1 0 0 0-.384-.928c-.225-.172-.636-.213-1.457-.295c-.433-.043-.65-.065-.82-.152a1 1 0 0 1-.47-.521C2 13.286 2 13.068 2 12.632v-1.264c0-.436 0-.654.07-.83a1 1 0 0 1 .472-.522c.169-.087.386-.109.82-.152c.82-.082 1.231-.123 1.456-.295a1 1 0 0 0 .385-.928c-.038-.281-.3-.6-.822-1.24c-.276-.337-.414-.505-.472-.687a1 1 0 0 1 .035-.702c.076-.174.23-.329.538-.637l.894-.893c.308-.308.462-.463.637-.538a1 1 0 0 1 .702-.035c.181.058.35.196.687.472c.639.522.958.783 1.238.821a1 1 0 0 0 .93-.385c.17-.225.212-.635.294-1.456c.043-.433.065-.65.152-.82a1 1 0 0 1 .521-.471c.177-.07.395-.07.831-.07h1.264c.436 0 .654 0 .83.07a1 1 0 0 1 .522.472M12 16a4 4 0 1 0 0-8a4 4 0 0 0 0 8"
      clip-rule="evenodd"
    /></svg
  >
</button>
<div class="chat-window" style:opacity={showChat ? "0.7" : "0"}>
  {#if $messages.length === 0}
    <div class="empty-message">아직 대화가 없습니다. 질문을 입력해보세요.</div>
  {/if}
  {#each $messages as msg, i (i)}
    <div class="message {msg.role}">
      {@html print(msg.content)}
    </div>
  {/each}
  {#if isLoading}
    <div class="loading-dots">
      답변 생성 중<span>.</span><span>.</span><span>.</span>
    </div>
  {/if}
  {#if isThink}
    <div class="loading-dots">
      생각 중<span>.</span><span>.</span><span>.</span>
    </div>
  {/if}
</div>
<!-- NEW: SettingsModal 컴포넌트 렌더링 -->
<SettingsModal
  {cssid}
  isOpen={isSettingsModalOpen}
  on:close={() => (isSettingsModalOpen = false)}
/>

<style>
  /* 뷰포트에 맞게 꽉 채우되 800 px 이상은 넓어지지 않음 */
  .chat-window {
    width: 100%; /* NEW: 가변 폭 */
    max-width: 800px; /* 데스크톱 상한 */
    /* min-width 제거 → 모바일에서 불필요한 여백 감소 */
    min-height: clamp(
      200px,
      50vh,
      300px
    ); /* 200~300px 사이, 화면 높이 50% 목표 */
    margin: 0 auto 1rem; /* 가운데 정렬 */
    padding: 1rem 1rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    background: transparent;
    position: relative;
    padding-top: 50px; /* 설정 버튼 공간 */
  }

  /* 메시지 버블은 컨테이너 폭의 90 % 까지 사용 (모바일 가독성↑) */
  .message {
    width: fit-content;
    max-width: 90%;
    padding: 0.75rem 1rem;
    border-radius: 16px;
    line-height: 1.5;
    word-break: break-word;
    white-space: normal;
  }

  /* 데스크톱(≥ 768 px)에서는 기존 70 % 폭 유지 */
  @media (min-width: 768px) {
    .message {
      max-width: 70%;
    }
  }

  /* NEW: 설정 버튼 스타일 */
  .settings-button {
    position: absolute;
    top: 10px; /* 상단으로부터 10px 아래 */
    right: 10px; /* 오른쪽으로부터 10px 왼쪽 */
    z-index: 10; /* 채팅 메시지 위에 오도록 z-index 설정 */
    background: none;
    border: none;
    color: #bdbdbd; /* 아이콘 색상 */
    font-size: 24px; /* SVG 사이즈에 맞게 */
    cursor: pointer;
    transition:
      color 0.3s ease,
      transform 0.3s ease; /* 호버 효과를 위한 트랜지션 */
    padding: 0;
  }

  .settings-button svg {
    width: 32px; /* 아이콘 크기 설정 */
    height: 32px;
  }

  .settings-button:hover {
    color: #ffffff; /* 호버 시 색상 변경 */
    transform: rotate(30deg); /* 호버 시 살짝 회전 */
    filter: drop-shadow(
      0 0 5px rgba(255, 255, 255, 0.5)
    ); /* 은은한 그림자 효과 */
  }

  .message.user {
    align-self: flex-end;
    background: #2a2a2a;
    color: white;
  }

  .message.assistant {
    align-self: flex-start;
    background: #222222;
    color: #dbdbdb;
  }

  .loading-dots,
  .empty-message {
    align-self: center;
    color: var(--color-secondary-text);
    font-style: italic;
  }

  @keyframes blink {
    0% {
      opacity: 0.2;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.2;
    }
  }
</style>

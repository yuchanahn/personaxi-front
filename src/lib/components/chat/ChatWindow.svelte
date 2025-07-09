<script lang="ts">
  import { onMount, tick } from "svelte"; // tick 추가
  import { marked } from "marked";
  import { messages } from "$lib/stores/messages";
  import SettingsModal from "$lib/components/modal/SettingModal.svelte";
  import { t } from "svelte-i18n"; // svelte-i18n import 추가

  export let isLoading: boolean = false;
  export let cssid: string;
  export let showChat: boolean = true;

  let chatWindowEl: HTMLElement;
  let isThink = false;

  // 반응성($:)을 사용해 messages가 바뀔 때마다 isThink 상태를 자동으로 계산
  $: {
    isThink = false; // 기본값은 false
    if ($messages.length > 0) {
      const lastMessage = $messages[$messages.length - 1];
      if (
        lastMessage.role === "assistant" &&
        lastMessage.content.includes("<think>") &&
        !lastMessage.content.includes("</think>")
      ) {
        isThink = true;
      }
    }
  }

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

  // 자동 스크롤 로직은 onMount 대신 messages가 변경될 때마다 실행하는 것이 더 안정적입니다.
  $: if ($messages && chatWindowEl) {
    // tick()을 사용해 DOM 업데이트가 완료된 후 스크롤
    tick().then(() => {
      chatWindowEl.scrollTo({
        top: chatWindowEl.scrollHeight,
        behavior: "smooth",
      });
    });

    // 마지막 메시지가 user 역할인 경우 로딩 상태를 false로 설정
    if ($messages.length > 0) {
      const lastMessage = $messages[$messages.length - 1];
      if (lastMessage.role === "user") {
        isLoading = true;
      } else {
        isLoading = false;
      }
    }
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
<div
  class="chat-window"
  bind:this={chatWindowEl}
  style:opacity={showChat ? "0.7" : "0"}
>
  {#if $messages.length === 0}
    <div class="empty-message">{$t('chatWindow.noConversation')}</div>
  {/if}
  {#each $messages as msg, i (i)}
    <div class="message {msg.role}">
      {@html print(msg.content)}
    </div>
  {/each}
  {#if isLoading}
    <div class="loading-dots assistant">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        ><circle cx="4" cy="12" r="3" fill="currentColor"
          ><animate
            id="svgSpinners3DotsScale0"
            attributeName="r"
            begin="0;svgSpinners3DotsScale1.end-0.25s"
            dur="0.75s"
            values="3;.2;3"
          /></circle
        ><circle cx="12" cy="12" r="3" fill="currentColor"
          ><animate
            attributeName="r"
            begin="svgSpinners3DotsScale0.end-0.6s"
            dur="0.75s"
            values="3;.2;3"
          /></circle
        ><circle cx="20" cy="12" r="3" fill="currentColor"
          ><animate
            id="svgSpinners3DotsScale1"
            attributeName="r"
            begin="svgSpinners3DotsScale0.end-0.45s"
            dur="0.75s"
            values="3;.2;3"
          /></circle
        ></svg
      >
    </div>
  {/if}
  {#if isThink}
    <div class="loading-dots assistant">
      {$t('chatWindow.thinking')}<span>.</span><span>.</span><span>.</span>
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
  /* .assistant 클래스를 loading-dots와 함께 사용할 수 있도록 수정 */
  .loading-dots.assistant {
    align-self: flex-start; /* assistant 메시지처럼 왼쪽에 표시 */
    background-color: #222222; /* assistant 메시지와 유사한 배경 */
    padding: 0.75rem 1rem;
    border-radius: 16px;
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

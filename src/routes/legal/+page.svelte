<script lang="ts">
    import Icon from "@iconify/svelte";

    /**
     * 링크 정의
     * ─────────────────────────────────────────
     * ‣ href  : 라우트 경로 (SvelteKit <a> 그대로 사용)
     * ‣ label : 사용자에게 보이는 제목
     * ‣ icon  : Iconify 아이콘 이름 (테마에 맞게 교체 가능)
     */
    const links = [
        {
            href: "/policy",
            label: "개인정보처리방침",
            icon: "ph:shield-check-light",
        },
        {
            href: "/terms",
            label: "이용약관",
            icon: "ph:file-text-light",
        },
        {
            href: "/licenses",
            label: "라이선스 · 크레딧",
            icon: "ph:scroll-light",
        },
        {
            href: "/privacy-chat-logs",
            label: "채팅/로그 수집 동의",
            icon: "ph:chat-light",
        },
    ];
</script>

<!--
  Legal Center Page (routes/legal/+page.svelte)
  ────────────────────────────────────────────
  • app.css 에 정의된 색상·폰트·다크모드 토큰을 그대로 사용
  • Tailwind 를 쓰고 있다면 class 기준으로 커스터마이징 가능
-->
<main class="mx-auto w-full max-w-screen-md px-6 py-10">
    <h1 class="mb-8 flex items-center gap-2 text-3xl font-bold">
        <Icon icon="ph:scales-light" width="32" />
        Legal Center
    </h1>

    <div class="grid gap-6 sm:grid-cols-2">
        {#each links as { href, label, icon }}
            <a
                {href}
                class="flex items-center gap-3 rounded-lg bg-neutral-800/60 p-5 transition hover:bg-neutral-700/70"
            >
                <Icon {icon} width="28" />
                <span class="text-lg">{label}</span>
            </a>
        {/each}
    </div>
</main>

<style>
    :global(a) {
        text-decoration: none;
        color: inherit;
    }
</style>

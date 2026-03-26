<script lang="ts">
    import Icon from "@iconify/svelte";
    import { page } from "$app/stores";

    import { t } from "svelte-i18n";
    import { notificationStore } from "$lib/stores/notification";

    const { unreadCount } = notificationStore;

    $: items = [
        { href: "/hub", icon: "ph:compass-duotone", label: $t("nav.explore") },
        {
            href: "/feed",
            icon: "ph:film-script-duotone",
            label: $t("nav.feed"),
        },
        {
            href: "/chat", // ✨ 추가된 채팅 페이지 링크
            icon: "ph:chat-circle-dots-duotone",
            label: $t("nav.chat"),
        },
        {
            href: "/edit3",
            icon: "ph:plus-circle-duotone",
            label: $t("nav.create"),
        },
        {
            href: "/user/setting",
            icon: "ph:gear-six-duotone",
            label: $t("nav.settings"),
        },
    ];

    // 현재 경로 확인
    $: currentPath = $page.url.pathname;
</script>

<nav class="nav-bottom">
    {#each items as { href, icon, label }}
        <a
            class="nav-item"
            class:active={currentPath === href ||
                (href !== "/" && currentPath.startsWith(href))}
            {href}
        >
            <div class="relative">
                <Icon {icon} width="24" height="24" />
                {#if href === "/user/setting" && $unreadCount > 0}
                    <span
                        class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"
                    ></span>
                {/if}
            </div>
            <span class="nav-label">{label}</span>
        </a>
    {/each}
</nav>

<style>
    .nav-bottom {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 70px;
        background: color-mix(in srgb, var(--card) 94%, var(--background) 6%);
        border-top: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
        display: flex;
        justify-content: space-around;
        align-items: center;
        z-index: 9999;
        border-top-left-radius: 20px;
        border-top-right-radius: 20px;
        box-shadow:
            0 -4px 16px rgba(0, 0, 0, 0.1),
            0 -2px 8px rgba(0, 0, 0, 0.06);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        padding: 8px 0;
    }

    .nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 8px 12px;
        border-radius: 12px;
        color: var(--muted-foreground);
        text-decoration: none;
        transition: all 0.2s ease;
        min-width: 60px;
        position: relative;
    }

    .nav-label {
        font-size: 0.65rem;
        font-weight: 500;
        white-space: nowrap;
    }

    .nav-item.active {
        color: var(--primary);
        background-color: color-mix(in srgb, var(--primary) 12%, transparent);
    }

    .nav-item.active::before {
        content: "";
        position: absolute;
        top: -1px;
        left: 50%;
        transform: translateX(-50%);
        width: 30px;
        height: 3px;
        background: var(--primary);
        border-radius: 0 0 6px 6px;
    }

    @media (hover: hover) and (pointer: fine) {
        .nav-item:hover {
            color: var(--foreground);
            background-color: var(--muted);
            transform: translateY(-2px);
        }
    }

    :global([data-theme="dark"]) .nav-bottom {
        box-shadow:
            0 -8px 24px rgba(0, 0, 0, 0.32),
            0 -2px 10px rgba(0, 0, 0, 0.18);
    }

    @media (hover: none), (pointer: coarse) {
        .nav-item:hover {
            color: var(--muted-foreground);
            background-color: transparent;
            transform: none;
        }
    }

    /* 모바일 safe area 대응 */
    @supports (padding-bottom: env(safe-area-inset-bottom)) {
        .nav-bottom {
            padding-bottom: calc(8px + env(safe-area-inset-bottom));
            height: calc(70px + env(safe-area-inset-bottom));
        }
    }
</style>

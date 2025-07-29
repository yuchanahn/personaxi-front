<script lang="ts">
    import Icon from "@iconify/svelte";
    import { page } from "$app/stores";

    import { t } from "svelte-i18n";

    $: items = [
        { href: "/hub", icon: "ph:compass-duotone", label: $t("nav.explore") },
        {
            href: "/feed",
            icon: "material-symbols:smart-display-outline",
            label: $t("nav.feed"),
        },
        {
            href: "/edit",
            icon: "ph:plus-circle-duotone",
            label: $t("nav.create"),
        },
        {
            href: "/user/setting",
            icon: "ph:gear-duotone",
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
            <Icon {icon} width="24" height="24" />
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
        background: var(--card);
        border-top: 1px solid var(--border);
        display: flex;
        justify-content: space-around;
        align-items: center;
        z-index: 9999;
        border-top-left-radius: 20px;
        border-top-right-radius: 20px;
        box-shadow:
            0 -4px 16px rgba(0, 0, 0, 0.1),
            0 -2px 8px rgba(0, 0, 0, 0.06);
        backdrop-filter: blur(10px);
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

    .nav-item:hover {
        color: var(--foreground);
        background-color: var(--muted);
        transform: translateY(-2px);
    }

    .nav-item.active {
        color: var(--primary);
        background-color: hsl(var(--primary) / 0.1);
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

    /* 다크 테마에서 더 진한 그림자 */
    @media (prefers-color-scheme: dark) {
        .nav-bottom {
            box-shadow:
                0 -4px 16px rgba(0, 0, 0, 0.3),
                0 -2px 8px rgba(0, 0, 0, 0.2);
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

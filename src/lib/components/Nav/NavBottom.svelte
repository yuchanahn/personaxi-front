<script lang="ts">
    import Icon from "@iconify/svelte";
    import { onMount } from "svelte";
    import { afterNavigate, goto, preloadCode } from "$app/navigation";
    import { page } from "$app/stores";
    import { accessToken } from "$lib/stores/auth";
    import { st_user } from "$lib/stores/user";
    import { getOptimizedSupabaseImageUrl } from "$lib/utils/mediaTransform";

    import { t } from "svelte-i18n";
    import { notificationStore } from "$lib/stores/notification";
    import { triggerNativeSelectionHaptic } from "$lib/utils/nativeHaptics";

    const { unreadCount } = notificationStore;
    const navHrefs = ["/hub", "/feed", "/chat", "/edit3", "/user/setting"];
    let brokenProfileImage = false;
    let pendingNavHref = "";

    onMount(() => {
        if (typeof window === "undefined") return;

        const preloadNavRoutes = () => {
            navHrefs.forEach((href) => {
                void preloadCode(href);
            });
        };

        const timer = window.setTimeout(preloadNavRoutes, 0);

        return () => {
            window.clearTimeout(timer);
        };
    });

    $: items = [
        {
            href: "/hub",
            icon: "ph:compass-duotone",
            label: $t("nav.explore"),
            requiresAuth: false,
        },
        {
            href: "/feed",
            icon: "material-symbols:smart-display-outline",
            label: $t("nav.feed"),
            requiresAuth: false,
        },
        {
            href: "/chat", // ✨ 추가된 채팅 페이지 링크
            icon: "ph:chats-duotone",
            label: $t("nav.chat"),
            requiresAuth: true,
        },
        {
            href: "/edit3",
            icon: "ph:plus-circle-duotone",
            label: $t("nav.create"),
            requiresAuth: true,
        },
        {
            href: "/user/setting",
            icon: "ph:gear-six-duotone",
            label: $t("nav.settings"),
            requiresAuth: true,
        },
    ];

    function matchesHref(pathname: string, href: string) {
        return pathname === href || (href !== "/" && pathname.startsWith(href));
    }

    function isTouchLikePointer() {
        if (typeof window === "undefined" || !window.matchMedia) return false;
        return window.matchMedia("(hover: none), (pointer: coarse)").matches;
    }

    function isItemActive(
        activePathname: string,
        href: string,
        requiresAuth: boolean,
    ) {
        return matchesHref(activePathname, href);
    }

    function handleNavTap(
        event: MouseEvent,
        href: string,
        requiresAuth: boolean,
    ) {
        event.preventDefault();

        if (isTouchLikePointer()) {
            (event.currentTarget as HTMLAnchorElement | null)?.blur();
        }

        if (href === currentPath) {
            pendingNavHref = "";
            return;
        }

        pendingNavHref = href;
        void triggerNativeSelectionHaptic();
        void goto(href);
    }

    afterNavigate(() => {
        pendingNavHref = "";
    });

    // 현재 경로 확인
    $: currentPath = $page.url.pathname;
    $: activePath = pendingNavHref || currentPath;
    $: profileImageUrl = $st_user?.profile?.trim() || "";
    $: optimizedProfileImageUrl = getOptimizedSupabaseImageUrl(profileImageUrl, {
        width: 96,
        height: 96,
        quality: 70,
        resize: "cover",
    });
    $: if (profileImageUrl) {
        brokenProfileImage = false;
    }

</script>

<nav class="nav-bottom">
    {#each items as { href, icon, label, requiresAuth }}
        <a
            class="nav-item"
            class:active={isItemActive(activePath, href, requiresAuth)}
            href={href}
            on:click={(event) => handleNavTap(event, href, requiresAuth)}
        >
            <div class="relative nav-icon-shell">
                {#if href === "/user/setting" && profileImageUrl && !brokenProfileImage}
                    <img
                        src={optimizedProfileImageUrl || profileImageUrl}
                        alt=""
                        class="nav-avatar"
                        loading="lazy"
                        on:error={() => (brokenProfileImage = true)}
                    />
                {:else}
                    <Icon {icon} width="24" height="24" />
                {/if}
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
        transition: color 0.18s ease;
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
    }

    .nav-item:focus,
    .nav-item:focus-visible {
        outline: none;
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

    .nav-item:active {
        background: transparent;
    }

    .nav-icon-shell {
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .nav-avatar {
        width: 26px;
        height: 26px;
        border-radius: 999px;
        object-fit: cover;
        border: 1.5px solid color-mix(in srgb, var(--border) 82%, transparent);
        background: var(--card);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .nav-item.active .nav-avatar {
        border-color: color-mix(in srgb, var(--primary) 70%, white 30%);
        box-shadow:
            0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent),
            0 1px 4px rgba(0, 0, 0, 0.1);
    }

    @media (hover: hover) and (pointer: fine) {
        .nav-item:hover {
            color: var(--foreground);
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
        }

        .nav-item:focus-visible {
            outline: none;
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

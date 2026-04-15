<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { fade, fly } from "svelte/transition";
    import Icon from "@iconify/svelte";
    import NotificationList from "./NotificationList.svelte";
    import { t } from "svelte-i18n";
    import { notificationStore } from "$lib/stores/notification";
    import type { NotificationFilter } from "$lib/utils/notification";
    import {
        isAnnouncementNotification,
        matchesNotificationFilter,
    } from "$lib/utils/notification";

    export let isOpen = false;

    const dispatch = createEventDispatcher();
    let activeTab: NotificationFilter = "all";

    $: notificationCounts = {
        all: $notificationStore.length,
        announcement: $notificationStore.filter((notification) =>
            isAnnouncementNotification(notification),
        ).length,
        activity: $notificationStore.filter((notification) =>
            matchesNotificationFilter(notification, "activity"),
        ).length,
    };

    const tabs: Array<{
        id: NotificationFilter;
        labelKey: string;
        countKey: keyof typeof notificationCounts;
    }> = [
        {
            id: "all",
            labelKey: "notifications.tabAll",
            countKey: "all",
        },
        {
            id: "announcement",
            labelKey: "notifications.tabAnnouncements",
            countKey: "announcement",
        },
        {
            id: "activity",
            labelKey: "notifications.tabActivity",
            countKey: "activity",
        },
    ];

    function close() {
        dispatch("close");
    }

    $: if (isOpen) {
        notificationStore.fetchNotifications();
    }
</script>

{#if isOpen}
    <!-- Backdrop -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        transition:fade={{ duration: 200 }}
        on:click={close}
    ></div>

    <!-- Drawer -->
    <div
        class="fixed inset-y-0 right-0 w-full max-w-md shadow-2xl z-50 flex flex-col border-l"
        style="background-color: var(--card); border-color: var(--border);"
        transition:fly={{ x: 300, duration: 300 }}
    >
        <!-- Header -->
        <div
            class="grid grid-cols-5 items-center p-4 border-b"
            style="border-color: var(--border);"
        >
            <div class="col-span-1 flex justify-start"></div>

            <h2
                class="col-span-3 text-lg font-semibold flex items-center justify-center gap-2 whitespace-nowrap"
                style="color: var(--foreground);"
            >
                <Icon icon="lucide:bell" class="w-5 h-5 flex-shrink-0" />
                <span class="truncate">{$t("notifications.title")}</span>
            </h2>

            <div class="col-span-1 flex justify-end">
                <button
                    class="p-2 text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    on:click={close}
                >
                    <Icon icon="lucide:x" class="w-5 h-5" />
                </button>
            </div>
        </div>

        <div class="drawer-tabs" style="border-color: var(--border);">
            {#each tabs as tab}
                <button
                    type="button"
                    class="drawer-tab"
                    class:is-active={activeTab === tab.id}
                    on:click={() => (activeTab = tab.id)}
                >
                    <span>{$t(tab.labelKey)}</span>
                    <span class="drawer-tab__count">
                        {notificationCounts[tab.countKey]}
                    </span>
                </button>
            {/each}
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto drawer-content">
            <NotificationList filter={activeTab} />
        </div>
    </div>
{/if}

<style>
    .drawer-tabs {
        display: flex;
        gap: 0.5rem;
        padding: 0.8rem 1rem 0.7rem;
        border-bottom: 1px solid;
    }

    .drawer-tab {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.48rem 0.8rem;
        border-radius: 999px;
        border: 1px solid transparent;
        background: color-mix(in srgb, var(--muted) 72%, transparent);
        color: var(--muted-foreground);
        font-size: 0.82rem;
        font-weight: 700;
        transition:
            background 0.18s ease,
            border-color 0.18s ease,
            color 0.18s ease;
    }

    .drawer-tab.is-active {
        color: var(--foreground);
        border-color: color-mix(in srgb, var(--primary) 38%, var(--border));
        background: color-mix(in srgb, var(--primary) 10%, var(--card));
    }

    .drawer-tab__count {
        min-width: 1.2rem;
        text-align: center;
        color: inherit;
        opacity: 0.8;
    }

    /* 하단 네비바 가림 방지 패딩 */
    .drawer-content {
        padding-bottom: 2rem; /* 데스크톱 기본값 */
    }

    @media (max-width: 768px) {
        .drawer-tabs {
            padding-left: 0.85rem;
            padding-right: 0.85rem;
            overflow-x: auto;
        }

        .drawer-content {
            /* 네비바 높이(약 70px) + 여유공간 1rem */
            padding-bottom: calc(
                70px + 1rem + env(safe-area-inset-bottom)
            ) !important;
            box-sizing: border-box;
        }
    }
</style>

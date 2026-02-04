<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { fade, fly } from "svelte/transition";
    import Icon from "@iconify/svelte";
    import NotificationList from "./NotificationList.svelte";
    import { t } from "svelte-i18n";
    import { notificationStore } from "$lib/stores/notification";

    export let isOpen = false;

    const dispatch = createEventDispatcher();

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

        <!-- Content -->
        <div class="flex-1 overflow-y-auto drawer-content">
            <NotificationList />
        </div>
    </div>
{/if}

<style>
    /* 하단 네비바 가림 방지 패딩 */
    .drawer-content {
        padding-bottom: 2rem; /* 데스크톱 기본값 */
    }

    @media (max-width: 768px) {
        .drawer-content {
            /* 네비바 높이(약 70px) + 여유공간 1rem */
            padding-bottom: calc(
                70px + 1rem + env(safe-area-inset-bottom)
            ) !important;
            box-sizing: border-box;
        }
    }
</style>

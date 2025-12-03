<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { fade, fly } from "svelte/transition";
    import Icon from "@iconify/svelte";
    import NotificationList from "./NotificationList.svelte";
    import { notificationStore } from "$lib/stores/notification";
    import { t } from "svelte-i18n";

    export let isOpen = false;

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
    }

    function markAllRead() {
        // notificationStore.markAllAsRead();
        // For now, just close or show toast?
        // Backend doesn't support bulk read yet efficiently, but we can iterate.
        // Or just leave it for now.
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
            class="flex items-center justify-between p-4 border-b"
            style="border-color: var(--border);"
        >
            <h2
                class="text-lg font-semibold flex items-center gap-2"
                style="color: var(--foreground);"
            >
                <Icon icon="lucide:bell" class="w-5 h-5" />
                {$t("notifications.title")}
            </h2>
            <div class="flex items-center gap-2">
                <!-- 
                <button 
                    class="p-2 text-gray-500 hover:text-blue-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Mark all as read"
                    on:click={markAllRead}
                >
                    <Icon icon="lucide:check-check" class="w-5 h-5" />
                </button>
                -->
                <button
                    class="p-2 text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    on:click={close}
                >
                    <Icon icon="lucide:x" class="w-5 h-5" />
                </button>
            </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-hidden">
            <NotificationList />
        </div>
    </div>
{/if}

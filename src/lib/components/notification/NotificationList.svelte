<script lang="ts">
    import { notificationStore } from "$lib/stores/notification";
    import NotificationItem from "./NotificationItem.svelte";
    import { onMount } from "svelte";
    import Icon from "@iconify/svelte";
    import { t } from "svelte-i18n";

    export let compact = false;

    const { subscribe, loading, initialized } = notificationStore;

    let offset = 0;
    const limit = 20;

    function loadMore() {
        offset += limit;
        notificationStore.fetchNotifications(limit, offset);
    }

    // Reset offset when component mounts if needed, or just rely on store state
    // Ideally we want to keep the list if we navigate away and back,
    // but for a drawer we might want to refresh or keep it.
    // The store keeps the state.
</script>

<div class="flex flex-col h-full">
    {#if $loading && $notificationStore.length === 0}
        <div class="flex items-center justify-center p-8 text-gray-400">
            <Icon icon="lucide:loader-2" class="animate-spin w-6 h-6" />
        </div>
    {:else if $notificationStore.length === 0 && $initialized}
        <div
            class="flex flex-col items-center justify-center p-8 text-gray-400 text-center"
        >
            <Icon icon="lucide:bell-off" class="w-12 h-12 mb-3 opacity-50" />
            <p class="text-sm">{$t("notifications.empty")}</p>
        </div>
    {:else}
        <div class="flex-1 overflow-y-auto">
            {#each $notificationStore as notification (notification.id)}
                <NotificationItem {notification} />
            {/each}

            {#if $notificationStore.length >= limit}
                <div class="p-4 text-center">
                    <button
                        class="text-sm text-blue-500 hover:text-blue-600 font-medium disabled:opacity-50"
                        on:click={loadMore}
                        disabled={$loading}
                    >
                        {#if $loading}
                            {$t("notifications.loading")}
                        {:else}
                            {$t("notifications.loadMore")}
                        {/if}
                    </button>
                </div>
            {/if}
        </div>
    {/if}
</div>

<script lang="ts">
    import Icon from "@iconify/svelte";
    import type { Notification } from "$lib/types";
    import { notificationStore } from "$lib/stores/notification";
    import { createEventDispatcher } from "svelte";
    import { t } from "svelte-i18n";
    import { get } from "svelte/store";

    export let notification: Notification;

    const dispatch = createEventDispatcher();

    function timeAgo(dateString: string) {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        // Use get(t) to access the translation function inside a helper
        const $t = get(t);

        if (seconds < 60) return $t("time.now");
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return $t("time.minutesAgo", { count: minutes });
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return $t("time.hoursAgo", { count: hours });
        const days = Math.floor(hours / 24);
        if (days < 7) return $t("time.daysAgo", { count: days });
        return date.toLocaleDateString();
    }

    function handleClick() {
        if (!notification.isRead) {
            notificationStore.markAsRead(
                notification.id,
                notification.title ? "announcement" : "notification",
            );
        }
        dispatch("click", notification);
    }

    function getIcon(type: string) {
        switch (type) {
            case "comment":
                return "lucide:message-circle";
            case "like":
                return "lucide:heart";
            case "follow":
                return "lucide:user-plus";
            case "auction_bid":
                return "lucide:gavel";
            case "auction_win":
                return "lucide:trophy";
            case "system":
                return "lucide:info";
            case "info":
                return "lucide:info";
            case "warning":
                return "lucide:alert-triangle";
            case "maintenance":
                return "lucide:wrench";
            case "update":
                return "lucide:sparkles";
            default:
                return "lucide:bell";
        }
    }

    function getColor(type: string) {
        switch (type) {
            case "like":
                return "text-red-500";
            case "auction_win":
                return "text-yellow-500";
            case "warning":
                return "text-orange-500";
            case "maintenance":
                return "text-blue-500";
            default:
                return "text-gray-500";
        }
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
    class="flex items-start gap-3 p-4 border-b cursor-pointer transition-colors"
    style="border-color: var(--border); {notification.isRead
        ? 'opacity: 0.6;'
        : 'background-color: var(--muted);'}"
    on:click={handleClick}
>
    <div class="mt-1 {getColor(notification.type)}">
        <Icon icon={getIcon(notification.type)} width="20" height="20" />
    </div>

    <div class="flex-1 min-w-0">
        {#if notification.title}
            <h4
                class="text-sm font-semibold mb-0.5"
                style="color: var(--foreground);"
            >
                {notification.title}
            </h4>
        {/if}

        <p
            class="text-sm break-words leading-relaxed"
            style="color: var(--muted-foreground);"
        >
            {notification.content}
        </p>

        <span
            class="text-xs mt-1.5 block"
            style="color: var(--muted-foreground); opacity: 0.7;"
        >
            {timeAgo(notification.createdAt)}
        </span>
    </div>

    {#if !notification.isRead}
        <div class="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0"></div>
    {/if}
</div>

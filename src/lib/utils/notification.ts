import type { Notification } from "$lib/types";

export type NotificationFilter = "all" | "announcement" | "activity";
export type NotificationReadTarget = "notification" | "announcement";

export function isAnnouncementNotification(notification: Notification) {
    return !!notification.title?.trim();
}

export function getNotificationReadTarget(
    notification: Notification,
): NotificationReadTarget {
    return isAnnouncementNotification(notification)
        ? "announcement"
        : "notification";
}

export function matchesNotificationFilter(
    notification: Notification,
    filter: NotificationFilter,
) {
    if (filter === "all") return true;
    if (filter === "announcement") {
        return isAnnouncementNotification(notification);
    }
    return !isAnnouncementNotification(notification);
}

export function canDeleteNotification(notification: Notification) {
    return !isAnnouncementNotification(notification);
}

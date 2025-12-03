import { writable, derived, get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import type { Notification } from '$lib/types';
import { accessToken } from './auth';
import { st_user } from './user'; // Assuming user store has the current user info

function createNotificationStore() {
    const { subscribe, set, update } = writable<Notification[]>([]);
    const unreadCount = writable<number>(0);
    const loading = writable<boolean>(false);
    const initialized = writable<boolean>(false);

    let realtimeChannel: any = null;

    async function fetchNotifications(limit = 20, offset = 0) {
        const token = get(accessToken);
        if (!token) return;

        loading.set(true);
        try {
            const res = await fetch(`/api/notifications?limit=${limit}&offset=${offset}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (offset === 0) {
                    set(data || []);
                } else {
                    update(n => [...n, ...(data || [])]);
                }
            }
        } catch (e) {
            console.error("Failed to fetch notifications", e);
        } finally {
            loading.set(false);
            initialized.set(true);
        }
    }

    async function fetchUnreadCount() {
        const token = get(accessToken);
        if (!token) return;

        try {
            const res = await fetch(`/api/notifications/unread-count`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                unreadCount.set(data.count);
            }
        } catch (e) {
            console.error("Failed to fetch unread count", e);
        }
    }

    async function markAsRead(id: string, type: 'notification' | 'announcement' = 'notification') {
        const token = get(accessToken);
        if (!token) return;

        // Check if it was unread BEFORE updating the list
        const currentList = get({ subscribe });
        const item = currentList.find(i => i.id === id);

        if (item && !item.isRead) {
            unreadCount.update(c => Math.max(0, c - 1));
        }

        // Optimistic update
        update(n => n.map(item => {
            if (item.id === id) {
                return { ...item, isRead: true };
            }
            return item;
        }));

        try {
            await fetch(`/api/notifications/${id}/read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type })
            });
        } catch (e) {
            console.error("Failed to mark as read", e);
            // Revert?
        }
    }

    async function markAllAsRead() {
        // Not implemented in backend yet as a single call, but UI might want it.
        // For now, we iterate or add a bulk endpoint later.
    }

    function initRealtime(userId: string) {
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }

        // Subscribe to INSERT events on notifications table for this user
        realtimeChannel = supabase
            .channel('public:notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('New notification received!', payload);
                    const newNotif = payload.new as Notification;

                    // Add to list
                    update(n => [newNotif, ...n]);

                    // Increment unread count
                    unreadCount.update(c => c + 1);

                    // Optional: Trigger native bridge or sound
                }
            )
            .subscribe();
    }

    return {
        subscribe,
        unreadCount: { subscribe: unreadCount.subscribe },
        loading: { subscribe: loading.subscribe },
        initialized: { subscribe: initialized.subscribe },
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        init: (userId: string) => {
            fetchNotifications();
            fetchUnreadCount();
            initRealtime(userId);
        }
    };
}

export const notificationStore = createNotificationStore();

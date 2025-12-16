import { writable } from "svelte/store";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
    id: number;
    message: string;
    type: ToastType;
    duration: number;
}

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    let count = 0;

    function add(message: string, type: ToastType = "info", duration = 3000) {
        const id = count++;
        const toast: Toast = { id, message, type, duration };
        update((toasts) => [...toasts, toast]);

        if (duration > 0) {
            setTimeout(() => {
                remove(id);
            }, duration);
        }
    }

    function remove(id: number) {
        update((toasts) => toasts.filter((t) => t.id !== id));
    }

    return {
        subscribe,
        success: (msg: string, duration = 3000) =>
            add(msg, "success", duration),
        error: (msg: string, duration = 3000) => add(msg, "error", duration),
        info: (msg: string, duration = 3000) => add(msg, "info", duration),
        warning: (msg: string, duration = 3000) =>
            add(msg, "warning", duration),
        remove,
    };
}

export const toast = createToastStore();

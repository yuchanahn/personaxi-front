import { writable } from "svelte/store";

export interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: "info" | "warning" | "danger";
}

interface ConfirmState {
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
}

function createConfirmStore() {
    const { subscribe, set, update } = writable<ConfirmState>({
        isOpen: false,
        options: { message: "" },
        resolve: () => { },
    });

    function ask(
        message: string,
        optionOverrides: Partial<ConfirmOptions> = {},
    ): Promise<boolean> {
        return new Promise((resolve) => {
            update((state) => ({
                isOpen: true,
                options: {
                    message,
                    confirmText: "Yes",
                    cancelText: "No",
                    type: "info",
                    ...optionOverrides,
                },
                resolve,
            }));
        });
    }

    function close(result: boolean) {
        update((state) => {
            state.resolve(result);
            return { ...state, isOpen: false };
        });
    }

    return {
        subscribe,
        ask,
        close,
    };
}

export const confirmStore = createConfirmStore();

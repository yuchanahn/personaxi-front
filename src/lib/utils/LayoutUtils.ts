import { writable } from 'svelte/store';

const { subscribe, set, update } = writable(false);

export const hideBackButton = {
    subscribe,
    hide: () => set(true),
    show: () => set(false),
};
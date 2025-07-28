import { writable } from 'svelte/store';
import type { User } from '$lib/types';

export let st_user = writable<User | null>(null)
import { writable } from 'svelte/store';
import type { User } from '$lib/types';


export let is_login = writable(true)
export let st_user = writable<User | null>(null)
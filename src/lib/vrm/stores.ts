import { writable } from 'svelte/store';

type Spark = { id: string; x: number; y: number; angle: number };

export const sparks = writable<Spark[]>([]);

/** 새 스파크 추가                                      */
export function addSpark(x: number, y: number, angle = Math.random() * 360) {
    sparks.update(a => [...a, { id: crypto.randomUUID(), x, y, angle }]);
}

// src/lib/helpers/keyboardViewport.ts
import type { Writable } from "svelte/store";

export type KeyboardViewportOptions = {
    inputEl: () => HTMLInputElement | HTMLTextAreaElement | null; // bind:this로 잡힌 input을 "getter"로 받기 (null 안전)
    setKeyboardHeight: (px: number) => void; // store든 let이든 상관없이 주입
    setIsKeyboardOpen: (open: boolean) => void;
    threshold?: number; // 기본 10
    maxCloseFrames?: number; // 기본 30
};

export type KeyboardViewportHandle = {
    refresh: () => void;
    destroy: () => void;
};

export function initKeyboardViewport(opts: KeyboardViewportOptions): KeyboardViewportHandle {
    const threshold = opts.threshold ?? 10;
    const maxCloseFrames = opts.maxCloseFrames ?? 30;

    // SSR 방어: 브라우저 아니면 아무 것도 안 함
    if (typeof window === "undefined" || typeof document === "undefined") {
        return { refresh: () => { }, destroy: () => { } };
    }

    const vv = window.visualViewport ?? null;

    let closing = false;

    const computeDiff = () => {
        if (!vv) return 0;
        const diff = window.innerHeight - vv.height - vv.offsetTop;
        return Math.max(0, diff);
    };

    const applyFromViewport = () => {
        const diff = computeDiff();
        if (!closing) opts.setIsKeyboardOpen(diff > threshold);
        opts.setKeyboardHeight(closing ? 0 : diff > threshold ? diff : 0);
    };

    const onVV = () => applyFromViewport();

    const onFocusIn = (e: FocusEvent) => {
        const input = opts.inputEl();
        if (input && e.target === input) {
            closing = false;
            opts.setIsKeyboardOpen(true);
            applyFromViewport();
        }
    };

    const onFocusOut = (e: FocusEvent) => {
        const input = opts.inputEl();
        if (input && e.target === input) {
            closing = true;
            opts.setIsKeyboardOpen(false);
            opts.setKeyboardHeight(0);

            // 키보드가 천천히 내려가며 diff가 남는 기기 대비
            let frames = 0;
            const tickClose = () => {
                frames++;
                const d = computeDiff();
                if (d < threshold || frames > maxCloseFrames) {
                    closing = false;
                    opts.setKeyboardHeight(0);
                    return;
                }
                requestAnimationFrame(tickClose);
            };
            requestAnimationFrame(tickClose);
        }
    };

    // attach
    vv?.addEventListener("resize", onVV, { passive: true });
    vv?.addEventListener("scroll", onVV, { passive: true });
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);

    applyFromViewport();

    return {
        refresh: applyFromViewport,
        destroy: () => {
            vv?.removeEventListener("resize", onVV);
            vv?.removeEventListener("scroll", onVV);
            document.removeEventListener("focusin", onFocusIn, true);
            document.removeEventListener("focusout", onFocusOut, true);
        }
    };
}

export function bindKeyboardViewportStores(params: {
    inputEl: () => HTMLInputElement | null;
    keyboardHeight: Writable<number>;
    isKeyboardOpen: Writable<boolean>;
    threshold?: number;
    maxCloseFrames?: number;
}): KeyboardViewportHandle {
    return initKeyboardViewport({
        inputEl: params.inputEl,
        setKeyboardHeight: (px) => params.keyboardHeight.set(px),
        setIsKeyboardOpen: (open) => params.isKeyboardOpen.set(open),
        threshold: params.threshold,
        maxCloseFrames: params.maxCloseFrames
    });
}

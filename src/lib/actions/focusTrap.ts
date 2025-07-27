export function focusTrap(node: HTMLElement) {
    const focusable = 'a, button, textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const first = () => node.querySelectorAll<HTMLElement>(focusable)[0];
    const last = () => {
        const list = node.querySelectorAll<HTMLElement>(focusable);
        return list[list.length - 1];
    };

    function handle(e: KeyboardEvent) {
        if (e.key !== 'Tab') return;
        const f = first();
        const l = last();
        if (!f || !l) return;
        if (e.shiftKey && document.activeElement === f) {
            l.focus();
            e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === l) {
            f.focus();
            e.preventDefault();
        }
    }

    node.addEventListener('keydown', handle);
    first()?.focus();
    return { destroy() { node.removeEventListener('keydown', handle); } };
}

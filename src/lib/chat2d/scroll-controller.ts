const AUTO_SCROLL_BOTTOM_THRESHOLD = 48;
const AUTO_SCROLL_RESUME_DELAY_MS = 2200;

export class Chat2DScrollController {
    private autoFollow = true;
    private suspendedUntil = 0;
    private lastKnownScrollTop = 0;
    private readonly element: HTMLElement;

    constructor(element: HTMLElement) {
        this.element = element;
        this.lastKnownScrollTop = element.scrollTop;
    }

    suspendByUserIntent() {
        this.autoFollow = false;
        this.suspendedUntil = Date.now() + AUTO_SCROLL_RESUME_DELAY_MS;
    }

    handleScroll() {
        if (this.isNearBottom()) {
            this.autoFollow = true;
            this.suspendedUntil = 0;
        } else if (
            Date.now() < this.suspendedUntil ||
            this.element.scrollTop < this.lastKnownScrollTop
        ) {
            this.autoFollow = false;
        }

        this.lastKnownScrollTop = this.element.scrollTop;
    }

    canAutoFollow() {
        return this.autoFollow;
    }

    resumeAutoFollow() {
        this.autoFollow = true;
        this.suspendedUntil = 0;
    }

    isNearBottom() {
        const distance =
            this.element.scrollHeight -
            this.element.scrollTop -
            this.element.clientHeight;
        return distance <= AUTO_SCROLL_BOTTOM_THRESHOLD;
    }

    scrollToBottom(forceInstant = false) {
        const behavior = forceInstant || isIOSStandalonePwa() ? "auto" : "smooth";
        this.element.scrollTo({
            top: this.element.scrollHeight,
            behavior,
        });

        if (!forceInstant && isIOSStandalonePwa()) {
            requestAnimationFrame(() => {
                this.element.scrollTop = this.element.scrollHeight;
            });
        }
    }
}

function isIOSStandalonePwa(): boolean {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent || "";
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    return isIOS && standalone;
}

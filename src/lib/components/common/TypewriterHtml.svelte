<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from "svelte";

    export let content: string = "";
    export let speed: number = 30; // ms per char
    export let active: boolean = false;
    export let instant: boolean = false;

    const dispatch = createEventDispatcher();

    let container: HTMLDivElement;
    let interval: number | null = null;
    let currentProcessingContent = "";

    // Track visual progress
    let isTyping = false;
    let visibleCharCount = 0;

    // React to content/active/instant changes
    $: {
        if (instant) {
            stopTyping();
            if (container) {
                container.innerHTML = content;
                dispatch("type");
                dispatch("complete");
            }
        } else if (active) {
            if (content !== currentProcessingContent) {
                // Trust that if we are active and content updates, it's the same message streaming.
                // We do NOT reset visibleCharCount.
                // We let the Fast Forward logic (in startTypingEffect) match what it can.
                // This handles Markdown transformation (e.g. *italic* -> <i>italic</i>) gracefully
                // because visibleCharCount just tracks "how much text we showed".

                currentProcessingContent = content;
                startTypingEffect();
            } else if (!isTyping && active) {
                // Active but not typing (maybe re-enabled?)
                startTypingEffect();
            }
        } else {
            // Not active
            stopTyping();
            visibleCharCount = 0;
            currentProcessingContent = "";
            if (container) container.innerHTML = "";
        }
    }

    async function startTypingEffect() {
        if (interval) clearInterval(interval);
        if (!container) return;

        isTyping = true;

        // 1. Draw Full HTML (invisible state management via JS)
        container.innerHTML = content;

        // 2. Extract Text Nodes
        const textNodes: { node: Node; text: string }[] = [];
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
        );

        let currentNode: Node | null;
        while ((currentNode = walker.nextNode())) {
            // Only non-empty text
            if (currentNode.textContent) {
                textNodes.push({
                    node: currentNode,
                    text: currentNode.textContent,
                });
            }
        }

        // 3. Fast Forward & Restore Logic
        let nodeIndex = 0;
        let charIndex = 0;
        let currentGlobalChar = 0;

        // Clamp visibleCharCount to avoid glitches if content shrank
        // (Though usually we reset if content shrank/changed branch)

        // Restore visibility state
        textNodes.forEach((item, idx) => {
            const len = item.text.length;

            if (currentGlobalChar + len <= visibleCharCount) {
                // This node was fully visible
                // leave item.node.textContent as is (full text)
                currentGlobalChar += len;

                // If we exactly finished here, next char starts at next node
                nodeIndex = idx + 1;
                charIndex = 0;
            } else if (currentGlobalChar < visibleCharCount) {
                // Partially visible
                const visiblePart = visibleCharCount - currentGlobalChar;
                item.node.textContent = item.text.slice(0, visiblePart);

                currentGlobalChar += visiblePart;
                nodeIndex = idx;
                charIndex = visiblePart;
            } else {
                // Not visible at all yet
                item.node.textContent = "";

                // If we haven't set start indices yet (first invisible node), set them
                if (
                    currentGlobalChar === visibleCharCount &&
                    nodeIndex === 0 &&
                    idx > 0
                ) {
                    nodeIndex = idx;
                    charIndex = 0;
                }
            }
        });

        // Safety: If completely done?
        if (visibleCharCount >= content.length && textNodes.length > 0) {
            // Just make sure everything is visible?
            // Logic above should handle it (leaves textContent alone).
            nodeIndex = textNodes.length;
        }

        // ensure nodeIndex is valid ref
        if (nodeIndex > textNodes.length) nodeIndex = textNodes.length;

        // 4. Typing Loop
        interval = window.setInterval(() => {
            if (nodeIndex >= textNodes.length) {
                stopTyping();
                dispatch("complete");
                return;
            }

            const currentItem = textNodes[nodeIndex];
            const targetText = currentItem.text;

            if (charIndex < targetText.length) {
                // Append next char
                // Using slice ensures we don't duplicate if we used += on a potentially modified node
                // But efficient way: Just append one char?
                // node.textContent is reliable here.
                // Resetting it via slice is safer against drifts.
                const nextChar = targetText[charIndex];
                currentItem.node.textContent += nextChar;

                charIndex++;
                visibleCharCount++;
                dispatch("type");
            } else {
                nodeIndex++;
                charIndex = 0;
            }
        }, speed);
    }

    function stopTyping() {
        if (interval) {
            clearInterval(interval);
            interval = null;
        }
        isTyping = false;
    }

    onDestroy(() => {
        stopTyping();
    });
</script>

<div class="typewriter-container" bind:this={container}></div>

<style>
    .typewriter-container {
        display: inline;
    }
</style>

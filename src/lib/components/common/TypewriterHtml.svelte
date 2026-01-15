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

    // Track if we are currently typing to avoid race conditions
    let isTyping = false;

    // React to content/active/instant changes
    $: {
        if (instant) {
            stopTyping();
            if (container) container.innerHTML = content;
        } else if (active) {
            if (content !== currentProcessingContent || !isTyping) {
                currentProcessingContent = content;
                startTypingEffect();
            }
        } else {
            // Not active, not instant -> Clear or keep empty
            if (container) container.innerHTML = "";
        }
    }

    async function startTypingEffect() {
        if (interval) clearInterval(interval);
        if (!container) return;

        isTyping = true;

        // Reset container with full content invisible first (or process logic)
        // NOTE: If we re-run this due to content change (streaming), we should try to preserve what was typed?
        // For simplicity, we restart typing structure but fast-forward if needed?
        // Actually, streaming appends text.
        // If we just reset, it flickers.
        // Better strategy: Only add NEW text nodes? Complex.
        // Simplify: Since streaming updates content rapidly, let's just let it type.
        // If we restart, the user sees re-typing of the *whole block*? That's bad.

        // FIX: If content startsWith currentProcessingContent (streaming), preserve visible?
        // A simple Typewriter is hard with full HTML replacement.
        // Given the constraints and the user's "just sequential" request:
        // Maybe we just allow resetting for now. The chunks are usually small blocks (Narration, Dialogue).

        container.innerHTML = content;

        // Walker logic
        const textNodes: { node: Node; text: string }[] = [];
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
        );

        let currentNode: Node | null;
        while ((currentNode = walker.nextNode())) {
            if (
                currentNode.textContent &&
                currentNode.textContent.trim().length > -1
            ) {
                textNodes.push({
                    node: currentNode,
                    text: currentNode.textContent,
                });
                currentNode.textContent = "";
            }
        }

        let nodeIndex = 0;
        let charIndex = 0;

        interval = window.setInterval(() => {
            if (nodeIndex >= textNodes.length) {
                // Check if truly done
                stopTyping();
                dispatch("complete");
                return;
            }

            const currentItem = textNodes[nodeIndex];
            const targetText = currentItem.text;

            if (charIndex < targetText.length) {
                currentItem.node.textContent += targetText[charIndex];
                charIndex++;
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

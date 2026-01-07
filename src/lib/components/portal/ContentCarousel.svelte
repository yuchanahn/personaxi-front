<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import Icon from "@iconify/svelte";
    import CharacterCard from "../card/CharacterCard.svelte";
    import { t } from "svelte-i18n";
    import type { PersonaDTO } from "$lib/types";

    export let title: string;
    export let contents: PersonaDTO[] = [];
    export let isLoading: boolean = false;
    export let hasMore: boolean = true;
    export let emptyMessage: string = "No content available.";

    const dispatch = createEventDispatcher();

    let carouselContainer: HTMLElement;
    let showLeftButton = false;
    let showRightButton = true;

    function handleCardClick(content: PersonaDTO) {
        dispatch("select", content);
    }

    let lastScrollTime = 0;

    function checkScroll() {
        if (!carouselContainer) return;
        const { scrollLeft, scrollWidth, clientWidth } = carouselContainer;
        showLeftButton = scrollLeft > 0;
        // Allow a small buffer (e.g. 1px) for calculation errors
        showRightButton = scrollLeft + clientWidth < scrollWidth - 1;

        // Infinite Scroll Detection
        // If within 50px of the end and not loading AND has more content
        if (
            !isLoading &&
            hasMore &&
            scrollLeft + clientWidth >= scrollWidth - 50
        ) {
            const now = Date.now();
            // Throttle: only fire once per second to prevent spamming
            if (now - lastScrollTime > 1000) {
                lastScrollTime = now;
                dispatch("loadMore");
            }
        }
    }

    function scroll(direction: "left" | "right") {
        if (!carouselContainer) return;
        const scrollAmount = carouselContainer.clientWidth * 0.8; // Scroll 80% of width
        const targetScroll =
            direction === "left"
                ? carouselContainer.scrollLeft - scrollAmount
                : carouselContainer.scrollLeft + scrollAmount;

        carouselContainer.scrollTo({
            left: targetScroll,
            behavior: "smooth",
        });
    }

    // Check scroll buttons on content change or resize
    $: if (contents) {
        // Wait for DOM update
        setTimeout(checkScroll, 0);
    }

    onMount(() => {
        checkScroll();
        window.addEventListener("resize", checkScroll);
        return () => window.removeEventListener("resize", checkScroll);
    });
</script>

<section class="hub-section">
    <div class="section-header">
        <h3>{title}</h3>
    </div>

    <div class="carousel-wrapper">
        <!-- Left Button -->
        {#if showLeftButton && !isLoading && contents.length > 0}
            <button
                class="nav-button left"
                on:click={() => scroll("left")}
                aria-label="Scroll Left"
            >
                <Icon icon="mdi:chevron-left" width="32" height="32" />
            </button>
        {/if}

        <div
            class="carousel-container"
            bind:this={carouselContainer}
            on:scroll={checkScroll}
        >
            {#if isLoading && contents.length === 0}
                <div class="loading-shim">Loading...</div>
            {:else if contents.length > 0}
                <div class="carousel-track">
                    {#each contents as content (content.id)}
                        <div class="carousel-item">
                            <CharacterCard
                                {content}
                                on:click={() => handleCardClick(content)}
                            />
                        </div>
                    {/each}
                    <!-- Inline Spinner for Infinite Scroll -->
                    {#if isLoading && hasMore}
                        <div class="loading-more">
                            <Icon
                                icon="mdi:loading"
                                width="24"
                                height="24"
                                class="spin"
                            />
                        </div>
                    {/if}
                </div>
            {:else}
                <div class="empty-shim">{emptyMessage}</div>
            {/if}
        </div>

        <!-- Right Button -->
        {#if showRightButton && !isLoading && contents.length > 0}
            <button
                class="nav-button right"
                on:click={() => scroll("right")}
                aria-label="Scroll Right"
            >
                <Icon icon="mdi:chevron-right" width="32" height="32" />
            </button>
        {/if}
    </div>
</section>

<style>
    .hub-section {
        padding: 1.5rem 0 0.5rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .section-header h3 {
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0;
        padding-right: 1.5rem;
    }

    .carousel-wrapper {
        position: relative;
        width: 100%;
        /* Ensure buttons can be positioned relative to this */
    }

    .carousel-container {
        width: 100%;
        overflow-x: auto;
        padding-bottom: 1rem;
        scrollbar-width: none; /* Firefox */
        min-height: 150px;
    }
    .carousel-container::-webkit-scrollbar {
        display: none; /* Chrome/Safari */
    }

    .carousel-track {
        display: flex;
        gap: 1rem;
        padding-right: 1.5rem; /* End padding */
    }

    .carousel-item {
        flex-shrink: 0;
        width: 200px;
    }

    .empty-shim,
    .loading-shim {
        padding: 1rem;
        color: var(--muted-foreground);
        font-style: italic;
    }

    /* Navigation Buttons */
    .nav-button {
        position: absolute;
        top: 50%;
        transform: translateY(-50%) translateY(-0.5rem); /* Adjust for padding-bottom */
        z-index: 20;
        background-color: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: white;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition:
            background-color 0.2s,
            transform 0.2s;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }

    .nav-button:hover {
        background-color: rgba(0, 0, 0, 0.9);
        transform: translateY(-50%) translateY(-0.5rem) scale(1.1);
    }

    .nav-button.left {
        left: 0.5rem; /* Adjust position */
    }

    .nav-button.right {
        right: 1.5rem; /* Align with padding-right */
    }

    @media (max-width: 768px) {
        .carousel-item {
            width: 160px;
        }
    }

    .loading-more {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 1rem;
        color: var(--muted-foreground);
    }

    :global(.spin) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>

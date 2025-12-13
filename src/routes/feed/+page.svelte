<script lang="ts">
    import { onMount, tick } from "svelte";
    import type { Persona } from "$lib/types";
    import { loadContentPaged } from "$lib/api/content"; // Updated API
    import FeedItem from "$lib/components/feed/FeedItem.svelte";
    import { page } from "$app/stores";
    import LoadingAnimation from "$lib/components/utils/LoadingAnimation.svelte";

    let personas: Persona[] = [];
    let loading = false;
    let offset = 0;
    const limit = 10;
    let hasMore = true;

    let feedContainer: HTMLElement;
    let activeIndex = 0;

    // Intersection Observer to detect active item
    let observer: IntersectionObserver;

    async function loadMore() {
        if (loading || !hasMore) return;
        loading = true;
        try {
            const newPersonas = await loadContentPaged(limit, offset);

            if (newPersonas.length < limit) {
                hasMore = false;
            }

            // Filter duplicates (just in case)
            const uniqueNew = newPersonas.filter(
                (np) => !personas.some((p) => p.id === np.id),
            );
            if (uniqueNew.length === 0 && newPersonas.length > 0) {
                // Might be loop or just end
                if (newPersonas.length < limit) hasMore = false;
            }

            personas = [...personas, ...uniqueNew];
            offset += limit;
        } catch (e) {
            console.error("Failed to load feed", e);
        } finally {
            loading = false;
        }
    }

    onMount(async () => {
        await loadMore();
        setupObserver();
    });

    function setupObserver() {
        const options = {
            root: feedContainer, // The scroll container
            threshold: 0.6, // Trigger when 60% visible
        };

        observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const index = Number(
                        entry.target.getAttribute("data-index"),
                    );
                    activeIndex = index;

                    // Specific logic: if nearing end, load more
                    if (index >= personas.length - 2) {
                        loadMore();
                    }
                }
            });
        }, options);
    }

    $: if (personas.length > 0 && feedContainer) {
        tick().then(() => {
            const items = feedContainer.querySelectorAll(".feed-item-wrapper");
            items.forEach((item) => observer.observe(item));
        });
    }
</script>

<div class="feed-page" bind:this={feedContainer}>
    {#each personas as persona, i (persona.id)}
        <div class="feed-item-wrapper" data-index={i}>
            <FeedItem {persona} isActive={i === activeIndex} />
        </div>
    {/each}

    {#if loading}
        <div class="loading-indicator">
            <LoadingAnimation />
        </div>
    {/if}

    {#if !loading && personas.length === 0}
        <div class="empty-state">
            <p>No personas found.</p>
        </div>
    {/if}
</div>

<style>
    .feed-page {
        width: 100%;
        height: 100vh; /* Full viewport height */
        overflow-y: scroll;
        scroll-snap-type: y mandatory;
        background: black;
        position: relative;
        /* Hide scrollbar */
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE and Edge */
    }

    .feed-page::-webkit-scrollbar {
        display: none;
    }

    .feed-item-wrapper {
        width: 100%;
        height: 100vh;
        scroll-snap-align: start;
    }

    .loading-indicator {
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        scroll-snap-align: end;
    }

    .empty-state {
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }
</style>

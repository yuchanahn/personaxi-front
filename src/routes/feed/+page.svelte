<script lang="ts">
    import { onMount, tick } from "svelte";
    import type { Persona } from "$lib/types";
    import { loadContentPaged, loadlikesdata } from "$lib/api/content"; // Updated API
    import FeedItem from "$lib/components/feed/FeedItem.svelte";
    import { t } from "svelte-i18n";
    import LoadingAnimation from "$lib/components/utils/LoadingAnimation.svelte";

    let personas: Persona[] = [];
    let loading = false;
    let offset = 0;
    const limit = 10;
    let hasMore = true;

    let feedContainer: HTMLElement;
    let activeIndex = 0;
    let currentSort: "popular" | "realtime" | "latest" = "realtime";
    let likedPersonaIds = new Set<string>();

    // Intersection Observer to detect active item
    let observer: IntersectionObserver;

    async function loadMore() {
        if (loading || !hasMore) return;
        loading = true;
        try {
            const newPersonas: Persona[] = await loadContentPaged(
                limit,
                offset,
                currentSort,
            );

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
        try {
            const likedIds: string[] = await loadlikesdata();
            likedPersonaIds = new Set(likedIds || []);
        } catch {
            likedPersonaIds = new Set();
        }
        setupObserver();
    });

    async function changeSort(nextSort: "popular" | "realtime" | "latest") {
        if (nextSort === currentSort || loading) return;
        currentSort = nextSort;
        personas = [];
        offset = 0;
        hasMore = true;
        activeIndex = 0;
        await loadMore();
    }

    function handleToggleLike(event: CustomEvent<{ id: string; liked: boolean }>) {
        const { id, liked } = event.detail;
        const next = new Set(likedPersonaIds);
        if (liked) {
            next.add(id);
        } else {
            next.delete(id);
        }
        likedPersonaIds = next;
    }

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
    <div class="sort-controls">
        <button
            class:active={currentSort === "realtime"}
            on:click={() => changeSort("realtime")}
        >
            {$t("sort.realtime")}
        </button>
        <button
            class:active={currentSort === "popular"}
            on:click={() => changeSort("popular")}
        >
            {$t("sort.popular")}
        </button>
        <button
            class:active={currentSort === "latest"}
            on:click={() => changeSort("latest")}
        >
            {$t("sort.latest")}
        </button>
    </div>

    {#each personas as persona, i (persona.id)}
        <div class="feed-item-wrapper" data-index={i}>
            <div class="feed-item-shell">
                <FeedItem
                    {persona}
                    isActive={i === activeIndex}
                    isLiked={likedPersonaIds.has(persona.id)}
                    on:toggleLike={handleToggleLike}
                />
            </div>
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
        height: 100dvh; /* Full viewport height (dynamic) */
        overflow-y: scroll;
        scroll-snap-type: y mandatory;
        background: black;
        overscroll-behavior-y: contain;
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
        height: 100dvh;
        scroll-snap-align: start;
        scroll-snap-stop: always;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .feed-item-shell {
        width: 100%;
        height: 100%;
    }

    .sort-controls {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 40;
        display: flex;
        gap: 8px;
        padding: 6px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--foreground) 20%, transparent);
        backdrop-filter: blur(10px);
        border: 1px solid color-mix(in srgb, var(--foreground) 18%, transparent);
    }

    .sort-controls button {
        border: none;
        border-radius: 999px;
        padding: 7px 12px;
        font-size: 12px;
        line-height: 1;
        font-weight: 600;
        color: color-mix(in srgb, var(--card) 82%, transparent);
        background: transparent;
        cursor: pointer;
        white-space: nowrap;
        word-break: keep-all;
    }

    .sort-controls button.active {
        color: var(--card);
        background: color-mix(in srgb, var(--card) 24%, transparent);
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

    @media (min-width: 1024px) {
        .feed-page {
            background: var(--color-bg, #0b0d12);
        }

        .feed-item-shell {
            width: 100%;
            height: 100dvh;
            max-height: none;
            aspect-ratio: auto;
            border-radius: 0;
            overflow: visible;
            box-shadow: none;
        }
    }
</style>

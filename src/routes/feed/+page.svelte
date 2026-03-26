<script lang="ts">
    import { browser } from "$app/environment";
    import { onMount, tick } from "svelte";
    import { Capacitor } from "@capacitor/core";
    import type { Persona } from "$lib/types";
    import {
        loadFeedRecommended,
        loadFollowedContentPaged,
        loadlikesdata,
    } from "$lib/api/content";
    import FeedItem from "$lib/components/feed/FeedItem.svelte";
    import { t } from "svelte-i18n";
    import LoadingAnimation from "$lib/components/utils/LoadingAnimation.svelte";

    let personas: Persona[] = [];
    let loading = false;
    let offset = 0;
    const isNativeAndroid =
        browser &&
        Capacitor.isNativePlatform() &&
        Capacitor.getPlatform() === "android";
    const limit = isNativeAndroid ? 4 : 10;
    let hasMore = true;

    let feedContainer: HTMLElement;
    let activeIndex = 0;
    let currentTab: "recommended" | "following" = "recommended";
    let likedPersonaIds = new Set<string>();
    let loadError = false;
    let seenTrackTimer: ReturnType<typeof setTimeout> | null = null;
    let recyclingFeed = false;

    const SEEN_STORAGE_KEY = "feed:recommended:seen";
    const SEEN_LIMIT = 50;
    const SEEN_TRACK_DELAY_MS = 1500;

    function getSeenIds(): string[] {
        if (typeof localStorage === "undefined") return [];
        try {
            const raw = localStorage.getItem(SEEN_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed)
                ? parsed.filter((id): id is string => typeof id === "string")
                : [];
        } catch {
            return [];
        }
    }

    function saveSeenIds(ids: string[]) {
        if (typeof localStorage === "undefined") return;
        localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(ids.slice(0, SEEN_LIMIT)));
    }

    function markPersonaSeen(id: string) {
        const current = getSeenIds().filter((item) => item !== id);
        current.unshift(id);
        saveSeenIds(current);
    }

    async function recycleRecommendedFeed() {
        if (recyclingFeed || currentTab !== "recommended") return;
        recyclingFeed = true;
        try {
            saveSeenIds([]);
            personas = [];
            offset = 0;
            hasMore = true;
            activeIndex = 0;
            loadError = false;
            observedIds.clear();
            observer?.disconnect();
            observer = null;
            await loadMore();
            await tick();
            setupObserver();
            feedContainer?.scrollTo({ top: 0, behavior: "auto" });
        } finally {
            recyclingFeed = false;
        }
    }

    // Intersection Observer to detect active item
    let observer: IntersectionObserver | null = null;
    let observedIds = new Set<string>();

    async function loadMore() {
        if (loading || recyclingFeed) return;
        if (!hasMore) {
            if (currentTab === "recommended" && personas.length > 0) {
                await recycleRecommendedFeed();
            }
            return;
        }
        loading = true;
        loadError = false;
        try {
            const newPersonas: Persona[] = currentTab === "recommended"
                ? await loadFeedRecommended(limit, offset, getSeenIds())
                : await loadFollowedContentPaged(limit, offset);

            if (newPersonas.length < limit) {
                hasMore = false;
            }

            // Filter duplicates (just in case)
            const uniqueNew = newPersonas.filter(
                (np) => !personas.some((p) => p.id === np.id),
            );
            if (
                currentTab === "recommended" &&
                personas.length > 0 &&
                (newPersonas.length === 0 || uniqueNew.length === 0)
            ) {
                hasMore = false;
                return;
            }

            if (uniqueNew.length === 0 && newPersonas.length > 0) {
                if (newPersonas.length < limit) hasMore = false;
            }

            personas = [...personas, ...uniqueNew];
            offset += limit;
        } catch (e) {
            console.error("Failed to load feed", e);
            loadError = true;
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        void (async () => {
            await loadMore();
            setupObserver();

            void loadlikesdata()
                .then((likedIds: string[]) => {
                    likedPersonaIds = new Set(likedIds || []);
                })
                .catch(() => {
                    likedPersonaIds = new Set();
                });
        })();
        return () => {
            if (seenTrackTimer) clearTimeout(seenTrackTimer);
            observer?.disconnect();
            observer = null;
            observedIds.clear();
        };
    });

    async function changeTab(nextTab: "recommended" | "following") {
        if (nextTab === currentTab || loading) return;
        currentTab = nextTab;
        personas = [];
        offset = 0;
        hasMore = true;
        activeIndex = 0;
        loadError = false;
        if (seenTrackTimer) {
            clearTimeout(seenTrackTimer);
            seenTrackTimer = null;
        }
        observer?.disconnect();
        observer = null;
        observedIds.clear();
        await loadMore();
        setupObserver();
    }

    $: {
        if (seenTrackTimer) {
            clearTimeout(seenTrackTimer);
            seenTrackTimer = null;
        }

        if (currentTab === "recommended") {
            const activePersona = personas[activeIndex];
            if (!activePersona?.id) {
                // no-op
            } else {
                seenTrackTimer = setTimeout(() => {
                    markPersonaSeen(activePersona.id);
                }, SEEN_TRACK_DELAY_MS);
            }
        }
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
        if (!feedContainer) return;
        observer?.disconnect();
        observedIds.clear();

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

    $: if (personas.length > 0 && feedContainer && observer) {
        tick().then(() => {
            const items = feedContainer.querySelectorAll(".feed-item-wrapper");
            items.forEach((item) => {
                const personaId = item.getAttribute("data-persona-id");
                if (!personaId || observedIds.has(personaId)) return;
                observer?.observe(item);
                observedIds.add(personaId);
            });
        });
    }
</script>

<div class="feed-page" bind:this={feedContainer}>
    <div class="sort-controls">
        <button
            class:active={currentTab === "recommended"}
            on:click={() => changeTab("recommended")}
        >
            {$t("feed.recommendedTab")}
        </button>
        <button
            class:active={currentTab === "following"}
            on:click={() => changeTab("following")}
        >
            {$t("feed.followingTab")}
        </button>
    </div>

    {#each personas as persona, i (persona.id)}
        <div class="feed-item-wrapper" data-index={i} data-persona-id={persona.id}>
            <div class="feed-item-shell">
                <FeedItem
                    {persona}
                    isActive={i === activeIndex}
                    isFirstItem={i === 0}
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
            {#if loadError}
                <p>{$t("feed.loadFailed")}</p>
            {:else if currentTab === "following"}
                <p>{$t("feed.emptyFollowing")}</p>
            {:else}
                <p>{$t("feed.emptyRecommended")}</p>
            {/if}
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

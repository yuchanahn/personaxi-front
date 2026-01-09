<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        loadContent,
        loadContentWithTags,
        loadContentWithName,
        loadFollowedContent,
        loadLikedContent,
    } from "$lib/api/content";
    import type { PersonaDTO } from "$lib/types";
    import { onMount, tick } from "svelte";
    import { writable } from "svelte/store";
    import { t } from "svelte-i18n";
    import CharacterCard from "../card/CharacterCard.svelte";
    import ContentCarousel from "./ContentCarousel.svelte";
    import Icon from "@iconify/svelte";
    import { allCategories } from "$lib/constants";
    import { slide } from "svelte/transition";

    // --- 상수 ---
    const visibleCategories = allCategories.filter(
        (c) => c.id !== 1001 && c.id !== 1002,
    );

    // --- 상태 관리 ---
    let contents = writable<PersonaDTO[]>([]);
    let newContents = writable<PersonaDTO[]>([]);
    let popularContents = writable<PersonaDTO[]>([]);
    let live2dContents = writable<PersonaDTO[]>([]);
    let vrmContents = writable<PersonaDTO[]>([]);

    let isLoading = writable(true);
    let isNewLoading = writable(true);
    let isPopularLoading = writable(true);
    let isLive2dLoading = writable(true);
    let isVrmLoading = writable(true);

    let isSearchModalOpen = false;
    let query = "";
    let searchType: "name" | "tags" = "name";

    let selectedCategory: string | null = null;
    let currentSort = "latest";
    let page = 1;
    let newPage = 1;
    let popularPage = 1;
    let live2dPage = 1;
    let vrmPage = 1;
    const limit = 20;

    let hasMoreNew = true;
    let hasMorePopular = true;
    let hasMoreLive2d = true;
    let hasMoreVrm = true;

    let isCategoryExpanded = false;

    // --- Tab Navigation ---
    type HubTab = "character" | "story" | "companion" | "2d" | "3d";
    let activeTab: HubTab = "character";

    $: currentContentType = activeTab === "story" ? "story" : "character";

    async function setActiveTab(tab: HubTab) {
        if (activeTab === tab) return;
        activeTab = tab;
        await tick();
        if (tab === "character" || tab === "story") {
            selectedCategory = null;
            reloadAll();
        } else if (tab === "2d") {
            filterByCategory("tags.live2d");
        } else if (tab === "3d") {
            filterByCategory("tags.vrm");
        }
    }

    async function reloadAll() {
        isLoading.set(true);
        loadFeaturedSections();
        const data = await loadContent(
            page,
            limit,
            currentSort,
            currentContentType,
        );
        contents.set(data);
        isLoading.set(false);
    }

    onMount(async () => {
        reloadAll();
    });

    async function loadFeaturedSections() {
        // New
        isNewLoading.set(true);
        loadContent(newPage, 10, "latest", currentContentType).then((data) => {
            newContents.set(data);
            if (data.length < 10) hasMoreNew = false;
            isNewLoading.set(false);
        });

        // Popular
        isPopularLoading.set(true);
        loadContent(popularPage, 10, "popular", currentContentType).then(
            (data) => {
                popularContents.set(data);
                if (data.length < 10) hasMorePopular = false;
                isPopularLoading.set(false);
            },
        );

        // Live2D (Only relevant for characters)
        if (currentContentType === "character") {
            isLive2dLoading.set(true);
            loadContentWithTags(
                ["tags.live2d"],
                live2dPage,
                10,
                "popular",
            ).then((data) => {
                live2dContents.set(data);
                if (data.length < 10) hasMoreLive2d = false;
                isLive2dLoading.set(false);
            });

            // VRM (Only relevant for characters)
            isVrmLoading.set(true);
            loadContentWithTags(["tags.vrm"], vrmPage, 10, "popular").then(
                (data) => {
                    vrmContents.set(data);
                    if (data.length < 10) hasMoreVrm = false;
                    isVrmLoading.set(false);
                },
            );
        } else {
            // Clear companion lists for story mode
            live2dContents.set([]);
            vrmContents.set([]);
            isLive2dLoading.set(false);
            isVrmLoading.set(false);
        }
    }

    async function handleLoadMore(type: "new" | "popular" | "live2d" | "vrm") {
        if (type === "new") {
            if ($isNewLoading || !hasMoreNew) return;
            isNewLoading.set(true);
            newPage++;
            const data = await loadContent(
                newPage,
                10,
                "latest",
                currentContentType,
            );
            if (data.length > 0) {
                newContents.update((c) => [...c, ...data]);
                if (data.length < 10) hasMoreNew = false;
            } else {
                hasMoreNew = false;
            }
            isNewLoading.set(false);
        } else if (type === "popular") {
            if ($isPopularLoading || !hasMorePopular) return;
            isPopularLoading.set(true);
            popularPage++;
            const data = await loadContent(
                popularPage,
                10,
                "popular",
                currentContentType,
            );
            if (data.length > 0) {
                popularContents.update((c) => [...c, ...data]);
                if (data.length < 10) hasMorePopular = false;
            } else {
                hasMorePopular = false;
            }
            isPopularLoading.set(false);
        } else if (type === "live2d") {
            if ($isLive2dLoading || !hasMoreLive2d) return;
            isLive2dLoading.set(true);
            live2dPage++;
            const data = await loadContentWithTags(
                ["tags.live2d"],
                live2dPage,
                10,
                "popular",
            );
            if (data.length > 0) {
                live2dContents.update((c) => [...c, ...data]);
                if (data.length < 10) hasMoreLive2d = false;
            } else {
                hasMoreLive2d = false;
            }
            isLive2dLoading.set(false);
        } else if (type === "vrm") {
            if ($isVrmLoading || !hasMoreVrm) return;
            isVrmLoading.set(true);
            vrmPage++;
            const data = await loadContentWithTags(
                ["tags.vrm"],
                vrmPage,
                10,
                "popular",
            );
            if (data.length > 0) {
                vrmContents.update((c) => [...c, ...data]);
                if (data.length < 10) hasMoreVrm = false;
            } else {
                hasMoreVrm = false;
            }
            isVrmLoading.set(false);
        }
    }

    // --- 필터링 및 로직 ---
    async function filterByCategory(category: string | null) {
        selectedCategory = category;
        page = 1;
        isLoading.set(true);
        let data: PersonaDTO[] = [];

        if (category === null) {
            data = await loadContent(
                page,
                limit,
                currentSort,
                currentContentType,
            );
        } else if (category === "following") {
            data = await loadFollowedContent();
        } else if (category === "liked") {
            data = await loadLikedContent();
        } else {
            data = await loadContentWithTags(
                [category],
                page,
                limit,
                currentSort,
            );
        }
        contents.set(data);
        isLoading.set(false);
    }

    async function changeSort(sort: string) {
        if (currentSort === sort) return;
        currentSort = sort;
        page = 1;
        isLoading.set(true);
        let data: PersonaDTO[] = [];

        if (selectedCategory === null) {
            data = await loadContent(page, limit, sort, currentContentType);
        } else if (selectedCategory === "following") {
            data = await loadFollowedContent();
        } else if (selectedCategory === "liked") {
            data = await loadLikedContent();
        } else {
            data = await loadContentWithTags(
                [selectedCategory],
                page,
                limit,
                sort,
            );
        }
        contents.set(data);
        isLoading.set(false);
    }

    async function executeSearch() {
        isLoading.set(true);
        selectedCategory = "search";
        isSearchModalOpen = false;

        let data: PersonaDTO[] = [];
        page = 1;

        if (!query.trim()) {
            data = await loadContent(page, limit, currentSort);
            selectedCategory = null;
        } else if (searchType === "name") {
            data = await loadContentWithName(query);
        }
        contents.set(data);
        isLoading.set(false);
    }

    function handleCardClick(content: PersonaDTO) {
        goto(`/profile?c=${content.id}`);
    }

    function toggleCategory() {
        isCategoryExpanded = !isCategoryExpanded;
    }
</script>

<div class="page-wrapper">
    <!-- Search Modal -->
    {#if isSearchModalOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="modal-overlay" on:click={() => (isSearchModalOpen = false)}>
            <div class="modal-content" on:click|stopPropagation>
                <button
                    class="close-button"
                    on:click={() => (isSearchModalOpen = false)}
                >
                    <Icon icon="mdi:close" />
                </button>
                <h2>{$t("contentHub.searchTitle")}</h2>
                <div class="search-options">
                    <button
                        class:active={searchType === "name"}
                        on:click={() => (searchType = "name")}
                    >
                        {$t("contentHub.searchByName")}
                    </button>
                </div>
                <div class="search-input-wrapper">
                    <input
                        type="text"
                        bind:value={query}
                        placeholder={$t("contentHub.searchNamePlaceholder")}
                        on:keydown={(e) => e.key === "Enter" && executeSearch()}
                    />
                    <button class="search-button" on:click={executeSearch}>
                        <Icon icon="mdi:magnify" />
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Header Section -->
    <div class="header-section">
        <div class="left-controls">
            <!-- Category Toggle -->
            <button
                class="category-toggle-btn"
                on:click={toggleCategory}
                aria-label={$t("contentHub.toggleCategories")}
            >
                <div class="icon-wrapper">
                    <Icon icon="mdi:tune-variant" width="24" height="24" />
                </div>
                <span class="desktop-only">{$t("contentHub.categories")}</span>
            </button>

            <!-- Navigation Tabs -->
            <div class="nav-tabs">
                <button
                    class="nav-tab"
                    class:active={activeTab === "character"}
                    on:click={() => setActiveTab("character")}
                >
                    {$t("contentHub.nav.character")}
                </button>
                <div class="tab-separator">|</div>
                <button
                    class="nav-tab"
                    class:active={activeTab === "story"}
                    on:click={() => setActiveTab("story")}
                >
                    {$t("contentHub.nav.story")}
                </button>
                <div class="tab-separator">|</div>
                <div class="companion-group">
                    <button
                        class="nav-label-btn"
                        class:active={activeTab === "2d" || activeTab === "3d"}
                        on:click={() => setActiveTab("2d")}
                    >
                        {$t("contentHub.nav.companion")}
                    </button>
                    <button
                        class="nav-tab"
                        class:active={activeTab === "2d"}
                        on:click={() => setActiveTab("2d")}
                    >
                        {$t("contentHub.nav.2d")}
                    </button>
                    <button
                        class="nav-tab"
                        class:active={activeTab === "3d"}
                        on:click={() => setActiveTab("3d")}
                    >
                        {$t("contentHub.nav.3d")}
                    </button>
                </div>
            </div>

            {#if selectedCategory}
                <!-- <div class="current-category">
                    <Icon icon="mdi:chevron-right" />
                    <span>
                        {#if selectedCategory === "following"}
                            {$t("contentHub.following")}
                        {:else if selectedCategory === "liked"}
                            {$t("contentHub.liked")}
                        {:else if selectedCategory === "search"}
                            {$t("contentHub.searchResult", { query })}
                        {:else}
                            {$t(selectedCategory)}
                        {/if}
                    </span>
                    <button
                        class="reset-cat"
                        on:click={() => filterByCategory(null)}
                    >
                        <Icon icon="mdi:close-circle" />
                    </button>
                </div> -->
            {/if}
        </div>

        <div class="right-controls">
            <button
                class="search-trigger-button"
                on:click={() => (isSearchModalOpen = true)}
            >
                <Icon icon="mdi:magnify" width="24" height="24" />
            </button>
        </div>
    </div>

    <!-- Collapsible Category Bar -->
    {#if isCategoryExpanded}
        <div class="category-panel" transition:slide={{ duration: 300 }}>
            <div class="category-grid">
                <button
                    class="cat-chip"
                    class:active={selectedCategory === null}
                    on:click={() => filterByCategory(null)}
                >
                    {$t("contentHub.all")}
                </button>
                {#each visibleCategories as category (category.id)}
                    <button
                        class="cat-chip"
                        class:active={selectedCategory === category.nameKey}
                        on:click={() => filterByCategory(category.nameKey)}
                    >
                        {$t(`${category.nameKey}`)}
                    </button>
                {/each}
            </div>
        </div>
    {/if}

    <div class="hub-container">
        <!-- Default View -->
        {#if selectedCategory === null && query === ""}
            <!-- Section 1: New Arrivals -->
            <ContentCarousel
                title={$t("content.newArrivals")}
                contents={$newContents}
                isLoading={$isNewLoading}
                hasMore={hasMoreNew}
                on:select={(e) => handleCardClick(e.detail)}
                on:loadMore={() => handleLoadMore("new")}
            />

            <!-- Section 2: Popular -->
            <ContentCarousel
                title={$t("content.todaysPopular")}
                contents={$popularContents}
                isLoading={$isPopularLoading}
                hasMore={hasMorePopular}
                on:select={(e) => handleCardClick(e.detail)}
                on:loadMore={() => handleLoadMore("popular")}
            />

            <!-- Section 3: Live2D -->
            {#if currentContentType === "character"}
                <ContentCarousel
                    title={$t("content.live2dTitle")}
                    contents={$live2dContents}
                    isLoading={$isLive2dLoading}
                    hasMore={hasMoreLive2d}
                    emptyMessage="No Live2D models found."
                    on:select={(e) => handleCardClick(e.detail)}
                    on:loadMore={() => handleLoadMore("live2d")}
                />

                <!-- Section 4: VRM -->
                <ContentCarousel
                    title={$t("content.vrmTitle")}
                    contents={$vrmContents}
                    isLoading={$isVrmLoading}
                    hasMore={hasMoreVrm}
                    emptyMessage="No VRM models found."
                    on:select={(e) => handleCardClick(e.detail)}
                    on:loadMore={() => handleLoadMore("vrm")}
                />
            {/if}

            <!-- Section 5: All Personas (Grid) -->
            <section class="hub-section">
                <div class="section-header">
                    <h3>{$t("content.allPersonas")}</h3>

                    <div class="sort-controls">
                        <button
                            class:active={currentSort === "latest"}
                            on:click={() => changeSort("latest")}
                            >{$t("sort.latest")}</button
                        >
                        <button
                            class:active={currentSort === "popular"}
                            on:click={() => changeSort("popular")}
                            >{$t("sort.popular")}</button
                        >
                    </div>
                </div>

                {#if $isLoading}
                    <div class="center-message">Loading...</div>
                {:else if $contents.length === 0}
                    <div class="center-message">
                        {$t("contentHub.noResults")}
                    </div>
                {:else}
                    <div class="content flex-grid">
                        {#each $contents as content (content.id)}
                            <CharacterCard
                                {content}
                                on:click={() => handleCardClick(content)}
                            />
                        {/each}
                    </div>
                {/if}
            </section>
        {:else}
            <!-- Filtered View -->
            <section class="hub-section full-height">
                <div class="section-header">
                    <h3>
                        {#if selectedCategory === "search"}
                            {$t("contentHub.searchResult", {
                                values: { query },
                            })}
                        {:else if selectedCategory === "following"}
                            {$t("contentHub.following")}
                        {:else if selectedCategory === "liked"}
                            {$t("contentHub.liked")}
                        {:else}
                            {$t(selectedCategory || "contentHub.all")}
                        {/if}
                    </h3>
                    <div class="sort-controls">
                        <button
                            class:active={currentSort === "latest"}
                            on:click={() => changeSort("latest")}
                            >{$t("sort.latest")}</button
                        >
                        <button
                            class:active={currentSort === "popular"}
                            on:click={() => changeSort("popular")}
                            >{$t("sort.popular")}</button
                        >
                    </div>
                </div>

                {#if $isLoading}
                    <div class="center-message">Loading...</div>
                {:else if $contents.length === 0}
                    <div class="center-message">
                        {$t("contentHub.noResults")}
                    </div>
                {:else}
                    <div class="content flex-grid">
                        {#each $contents as content (content.id)}
                            <CharacterCard
                                {content}
                                on:click={() => handleCardClick(content)}
                            />
                        {/each}
                    </div>
                {/if}
            </section>
        {/if}
    </div>
</div>

<style>
    /* --- Layout --- */
    .page-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100vw;
        max-width: 100vw;
        overflow-x: hidden;
        box-sizing: border-box;
        background-color: var(--background);
    }

    .header-section {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        flex-shrink: 0;
        z-index: 10;
    }

    .left-controls {
        display: flex;
        align-items: center;
        gap: 1.5rem; /* Separates toggle from tabs */
        /* 사이드바 아이콘 만큼 띄워주기 */
        padding-left: 2.5rem;
    }

    /* --- Navigation Tabs --- */
    .nav-tabs {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-left: 0.5rem;
    }

    .nav-tab {
        background: none;
        border: none;
        color: var(--muted-foreground);
        font-size: 1.1rem;
        font-weight: 500;
        cursor: pointer;
        padding: 0;
        transition:
            color 0.2s,
            text-shadow 0.2s;
    }

    .nav-tab:hover {
        color: var(--foreground);
    }

    .nav-tab.active {
        color: var(--foreground);
        font-weight: 700;
        text-shadow: 0 0 8px rgba(255, 255, 255, 0.5); /* Glow effect request */
    }

    .tab-separator {
        color: var(--border);
        font-size: 0.9rem;
        font-weight: 300;
    }
    .current-category {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.95rem;
        color: var(--foreground);
        font-weight: 500;
        animation: fadeIn 0.3s;
    }

    .companion-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .nav-label,
    .nav-label-btn {
        color: var(--muted-foreground); /* Default to muted */
        font-size: 1rem;
        font-weight: 500;
        margin-right: 0.2rem;
        transition:
            color 0.2s,
            text-shadow 0.2s;

        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
    }

    .nav-label.active,
    .nav-label-btn.active {
        color: var(--foreground);
        font-weight: 700;
        text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
    }

    .reset-cat {
        background: none;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
    }
    .reset-cat:hover {
        color: var(--destructive);
    }

    .category-toggle-btn {
        background: none;
        border: none;
        color: var(--foreground);
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        border-radius: var(--radius-button);
        transition: background-color 0.2s;
    }
    .category-toggle-btn:hover {
        background-color: var(--muted);
    }
    .icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--foreground);
    }

    /* --- Category Panel --- */
    .category-panel {
        background-color: var(--card);
        border-bottom: 1px solid var(--border);
        padding: 1rem 1.5rem;
        overflow: hidden;
    }
    .category-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .cat-chip {
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
        background-color: var(--muted);
        color: var(--foreground);
        border: 1px solid transparent;
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.2s;
    }
    .cat-chip:hover {
        background-color: var(--secondary);
    }
    .cat-chip.active {
        background: var(--primary-gradient);
        color: var(--primary-foreground);
    }

    /* --- Hub Content --- */
    .hub-container {
        flex: 1;
        overflow-y: auto;
        padding-bottom: 2rem;
    }

    .hub-section {
        padding: 1.5rem 0 0.5rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .hub-section.full-height {
        height: 100%;
    }

    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-right: 1.5rem;
    }
    .section-header h3 {
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0;
    }

    .sort-controls button {
        background: none;
        border: none;
        color: var(--muted-foreground);
        font-size: 0.9rem;
        margin-left: 0.5rem;
        cursor: pointer;
    }
    .sort-controls button.active {
        color: var(--primary);
        font-weight: 600;
    }

    /* --- Carousel --- */
    .carousel-container {
        width: 100%;
        overflow-x: auto;
        padding-bottom: 1rem;
        scrollbar-width: none;
        min-height: 150px;
    }
    .carousel-container::-webkit-scrollbar {
        display: none;
    }

    .carousel-track {
        display: flex;
        gap: 1rem;
        padding-right: 1.5rem;
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

    /* --- Grid --- */
    .content.flex-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1.5rem;
        padding-right: 1.5rem;
    }

    /* --- Search Modal --- */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    }
    .modal-content {
        position: relative;
        background: var(--card);
        padding: 2.5rem 2rem;
        border-radius: var(--radius-card-lg);
        width: 90%;
        max-width: 500px;
    }
    .modal-content h2 {
        text-align: center;
        margin-bottom: 1.5rem;
    }
    .close-button {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        background: none;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        padding: 0.5rem;
    }
    .search-options {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }
    .search-options button {
        padding: 0.4rem 0.8rem;
        background: transparent;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
    }
    .search-options button.active {
        background-color: var(--secondary);
        color: var(--foreground);
        border-radius: var(--radius-button);
    }
    .search-input-wrapper {
        position: relative;
        width: 100%;
    }
    .search-input-wrapper input {
        width: 100%;
        padding: 0.75rem 3rem 0.75rem 1rem;
        background-color: var(--input);
        border: 1px solid var(--border-input);
        color: var(--foreground);
        border-radius: var(--radius-input);
    }
    .search-button {
        position: absolute;
        right: 0.5rem;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
    }

    .search-trigger-button {
        background: none;
        border: none;
        color: var(--foreground);
        padding: 0.5rem;
        cursor: pointer;
    }

    /* --- Mobile --- */
    @media (max-width: 768px) {
        .header-section {
            padding: 0.75rem 1rem;
        }
        .desktop-only {
            display: none;
        }
        .carousel-item {
            width: 160px;
        }
        .content.flex-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
            padding-right: 1rem;
        }
        .hub-section {
            padding-left: 1rem;
        }
        .left-controls {
            padding-left: 0rem;
        }

        .nav-tabs {
            gap: 0.5rem;
            margin-left: 0.25rem;
        }
        .nav-tab {
            font-size: 1rem;
        }
    }
</style>

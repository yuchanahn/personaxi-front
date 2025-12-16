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
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import { t } from "svelte-i18n";
    import CharacterCard from "../card/CharacterCard.svelte";
    import Icon from "@iconify/svelte";
    import { allCategories } from "$lib/constants";

    // --- 상태 관리 ---
    let contents = writable<PersonaDTO[]>([]);
    let isLoading = writable(true);

    // 검색 모달 상태
    let isSearchModalOpen = false;
    let query = "";
    let searchType: "name" | "tags" = "name";

    let selectedCategory: string | null = null; // null이면 '전체'
    let currentSort = "latest";
    let page = 1;
    const limit = 20;

    // --- 데이터 로딩 및 필터링 ---
    onMount(async () => {
        const data = await loadContent(page, limit, currentSort);
        contents.set(data);
        isLoading.set(false);
        // 기존 live, auction 관련 코드는 간결성을 위해 제거했지만, 필요하다면 이어서 추가하면 돼.
    });

    // 카테고리 클릭 시 필터링 실행
    async function filterByCategory(category: string | null) {
        selectedCategory = category;
        page = 1;
        isLoading.set(true);
        let data: PersonaDTO[] = [];
        if (category === null) {
            data = await loadContent(page, limit, currentSort);
        } else if (category === "following") {
            data = await loadFollowedContent(); // Following doesn't support generic sort yet usually
        } else if (category === "liked") {
            data = await loadLikedContent(); // Liked usually implies recent
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
            data = await loadContent(page, limit, sort);
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

    // 검색 실행 (모달 내부)
    async function executeSearch() {
        isLoading.set(true);
        isSearchModalOpen = false; // 검색 실행 후 모달 닫기
        let data: PersonaDTO[] = [];
        page = 1; // 검색 시 첫 페이지로 초기화

        if (!query.trim()) {
            data = await loadContent(page, limit, currentSort);
        } else if (searchType === "name") {
            data = await loadContentWithName(query);
        } else if (searchType === "tags") {
            const tags = query
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag !== "");
            data =
                tags.length > 0
                    ? await loadContentWithTags(tags, page, limit, currentSort)
                    : await loadContent(page, limit, currentSort);
        }
        contents.set(data);
        isLoading.set(false);
    }

    function handleCardClick(content: PersonaDTO) {
        goto(`/profile?c=${content.id}`);
    }
</script>

<div class="page-wrapper">
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
                        >{$t("contentHub.searchByName")}</button
                    >
                    <!-- <button
                        class:active={searchType === "tags"}
                        on:click={() => (searchType = "tags")}
                        >{$t("contentHub.searchByTags")}</button
                    > -->
                </div>
                <div class="search-input-wrapper">
                    <input
                        type="text"
                        bind:value={query}
                        placeholder={searchType === "name"
                            ? $t("contentHub.searchNamePlaceholder")
                            : $t("contentHub.searchTagsPlaceholder")}
                        on:keydown={(e) => e.key === "Enter" && executeSearch()}
                    />
                    <button class="search-button" on:click={executeSearch}>
                        <Icon icon="mdi:magnify" />
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <div class="header-section">
        <div class="sort-tabs desktop-only">
            <button
                class:active={currentSort === "popular"}
                on:click={() => changeSort("popular")}
            >
                {$t("sort.popular")}
            </button>
            <div class="separator"></div>
            <button
                class:active={currentSort === "realtime"}
                on:click={() => changeSort("realtime")}
            >
                {$t("sort.realtime")}
            </button>
            <div class="separator"></div>
            <button
                class:active={currentSort === "latest"}
                on:click={() => changeSort("latest")}
            >
                {$t("sort.latest")}
            </button>
        </div>

        <div class="bubbles-wrapper">
            <div class="category-bubbles">
                <button
                    class="bubble"
                    class:active={selectedCategory === null}
                    on:click={() => filterByCategory(null)}
                >
                    {$t("contentHub.all")}
                </button>
                {#each allCategories as category (category.id)}
                    <button
                        class="bubble"
                        class:active={selectedCategory === category.nameKey}
                        on:click={() => filterByCategory(category.nameKey)}
                    >
                        {$t(`${category.nameKey}`)}
                    </button>
                {/each}
            </div>
        </div>
        <button
            class="search-trigger-button"
            on:click={() => (isSearchModalOpen = true)}
        >
            <Icon icon="mdi:magnify" width="24" height="24" />
        </button>
    </div>

    <div class="mobile-sort-bar">
        <button
            class:active={currentSort === "popular"}
            on:click={() => changeSort("popular")}
        >
            {$t("sort.popular")}
        </button>
        <div class="separator"></div>
        <button
            class:active={currentSort === "realtime"}
            on:click={() => changeSort("realtime")}
        >
            {$t("sort.realtime")}
        </button>
        <div class="separator"></div>
        <button
            class:active={currentSort === "latest"}
            on:click={() => changeSort("latest")}
        >
            {$t("sort.latest")}
        </button>
    </div>

    <div class="hub-container">
        {#if $isLoading}
            <div class="center-message">Loading...</div>
        {:else if $contents === null || $contents.length === 0}
            <div class="center-message">{$t("contentHub.noResults")}</div>
        {:else}
            <div class="content">
                {#each $contents as content (content.id)}
                    <CharacterCard
                        {content}
                        on:click={() => handleCardClick(content)}
                    />
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    /* --- 페이지 레이아웃 --- */
    .page-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100vw; /* 뷰포트 너비에 맞춤 */
        max-width: 100vw; /* 뷰포트를 넘지 않도록 */
        overflow-x: hidden; /* 가로 스크롤 방지 */
        box-sizing: border-box;
    }
    .header-section {
        display: flex;
        align-items: center;
        gap: 0.75rem; /* gap을 줄여서 공간 확보 */
        padding: 1rem 1.5rem;
        /* border-bottom: 1px solid var(--border); */ /* Remove border from here */
        flex-shrink: 0;
        width: 100%;
        max-width: 100vw;
        box-sizing: border-box;
    }

    .mobile-sort-bar {
        display: none; /* Hidden by default on desktop */
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        border-bottom: 1px solid var(--border);
        background-color: var(--card); /* Ensure background matches */
    }

    .mobile-sort-bar button {
        background: none;
        border: none;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--muted-foreground);
        cursor: pointer;
        padding: 0;
    }

    .mobile-sort-bar button.active {
        color: var(--foreground);
        font-weight: 600;
    }

    .sort-tabs {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-left: 50px; /* Prevent overlap with sidebar toggle */
        flex-shrink: 0;
    }

    .sort-tabs button {
        background: none;
        border: none;
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--muted-foreground);
        cursor: pointer;
        padding: 0;
        transition: color 0.2s;
    }

    .sort-tabs button:hover {
        color: var(--foreground);
    }

    .sort-tabs button.active {
        color: var(--foreground);
        font-weight: 700;
    }

    .separator {
        width: 1px;
        height: 12px;
        background-color: var(--border);
    }
    .hub-container {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
    }
    .hub-container > .content {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1.5rem;
        padding: 1.5rem;
    }
    .center-message {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        font-size: 1.2rem;
        color: var(--muted-foreground);
    }

    /* --- 카테고리 버블 래퍼 --- */
    .bubbles-wrapper {
        flex: 1; /* flex-grow: 1 대신 flex: 1 사용 */
        min-width: 0; /* flex 아이템이 내용물 크기보다 작아질 수 있도록 허용 */
        overflow: hidden; /* 넘치는 부분 숨김 */
        width: calc(100% - 60px); /* 검색 버튼 공간 제외 */
        /* margin-left: 2.5rem; */
    }

    /* --- 카테고리 버블 --- */
    .category-bubbles {
        display: flex;
        gap: 0.75rem;
        overflow-x: auto;
        width: 100%; /* 부모 너비에 맞춤 */
        scrollbar-width: none; /* Firefox */
        padding-bottom: 2px; /* 스크롤바 공간 확보 */
    }
    .category-bubbles::-webkit-scrollbar {
        display: none; /* Chrome, Safari, Opera */
    }

    .bubble {
        flex-shrink: 0;
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
        font-weight: 500;
        background-color: var(--muted);
        color: var(--muted-foreground);
        border: 1px solid var(--border);
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
        white-space: nowrap; /* 텍스트 줄바꿈 방지 */
    }
    .bubble:hover {
        background-color: var(--secondary);
        color: var(--secondary-foreground);
    }
    .bubble.active {
        background: var(--primary-gradient);
        color: var(--primary-foreground);
        border-color: transparent;
        font-weight: 600;
    }

    /* --- 검색 아이콘 버튼 --- */
    .search-trigger-button {
        flex-shrink: 0;
        width: 40px; /* 고정 너비 */
        height: 40px; /* 고정 높이 */
        background: none;
        border: none;
        color: var(--foreground);
        padding: 0.5rem;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
    }
    .search-trigger-button:hover {
        background-color: var(--muted);
    }

    /* --- 검색 모달 --- */
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
        padding: 2.5rem 2rem 2rem 2rem;
        border-radius: var(--radius-card-lg);
        box-shadow: var(--shadow-popover);
        width: 90%;
        max-width: 500px;
        animation: fadeIn 0.3s ease-out;
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
        border-radius: 50%;
        transition: background-color 0.2s;
    }
    .close-button:hover {
        background-color: var(--muted);
    }
    .search-options,
    .search-input-wrapper {
        margin: 0 auto;
    }
    .search-options {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        background-color: var(--muted);
        padding: 0.25rem;
        border-radius: var(--radius-input);
        margin-bottom: 1rem;
    }
    .search-options button {
        padding: 0.4rem 0.8rem;
        font-size: 0.8rem;
        font-weight: 500;
        background-color: transparent;
        color: var(--muted-foreground);
        border: none;
        border-radius: var(--radius-button);
        cursor: pointer;
        transition: all 0.2s ease-in-out;
        white-space: nowrap;
    }
    .search-options button.active {
        background-color: var(--secondary);
        color: var(--secondary-foreground);
        box-shadow: var(--shadow-mini);
    }
    .search-input-wrapper {
        position: relative;
        width: 100%;
        max-width: 400px;
    }
    .search-input-wrapper input {
        background-color: var(--input);
        border: 1px solid var(--border-input);
        color: var(--foreground);
        padding: 0.75rem 3rem 0.75rem 1rem;
        font-size: 1rem;
        border-radius: var(--radius-input);
        width: 100%;
    }
    .search-button {
        position: absolute;
        right: 0.5rem;
        top: 50%;
        transform: translateY(-50%);
        padding: 0.5rem;
        background: none;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    @media (max-width: 768px) {
        .header-section {
            padding: 0.75rem 1rem; /* 모바일에서 패딩 줄임 */
            gap: 0.5rem; /* 모바일에서 간격 더 줄임 */
            border-bottom: none; /* Let mobile sort bar handle border */
        }

        .desktop-only {
            display: none !important;
        }

        .mobile-sort-bar {
            display: flex; /* Show on mobile */
            padding: 0.75rem 1rem 0.75rem 1rem; /* Adjust padding */
        }

        .bubbles-wrapper {
            width: calc(100% - 50px); /* 모바일에서 검색 버튼 공간 조정 */
        }

        .search-trigger-button {
            width: 36px;
            height: 36px;
        }

        .hub-container > .content {
            grid-template-columns: repeat(3, 1fr);
            gap: 0.5rem;
            padding: 0.5rem;
        }

        .bubbles-wrapper {
            margin-left: 0rem;
        }
    }
</style>

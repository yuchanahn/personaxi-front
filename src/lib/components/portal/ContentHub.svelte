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
    import NeuronIcon from "$lib/components/icons/NeuronIcon.svelte";
    import ContentCarousel from "./ContentCarousel.svelte";
    import Icon from "@iconify/svelte";
    import { allCategories } from "$lib/constants";
    import { slide } from "svelte/transition";
    import InstallPrompt from "$lib/components/common/InstallPrompt.svelte";
    import Footer from "$lib/components/common/Footer.svelte";
    import { settings } from "$lib/stores/settings";
    import { st_user } from "$lib/stores/user";
    import { get } from "svelte/store";
    import { toastError } from "$lib/utils/errorMapper";
    import { showNeedMoreNeuronsModal } from "$lib/stores/modal";
    import { toast } from "$lib/stores/toast";
    import { requestIdentityVerification } from "$lib/services/verification";
    import HubBanner from "./HubBanner.svelte";

    let isAgeVerificationModalOpen = false;

    let isOverseas = false;
    let isCheckingIp = true;

    // Testing overrides
    let isLocalhost = false;
    let simulatedCountryCode = "KR";

    $: hubBanners = [
        {
            id: "discord_community",
            title: $t("hubBanner.discord.title"),
            subtitle: $t("hubBanner.discord.subtitle"),
            imageUrl: "/images/hub_banner_discord_anime.png",
            linkUrl: "https://discord.gg/v88p26Fpmc",
            actionText: $t("hubBanner.discord.action"),
            bgColor:
                "linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(88,101,242,0) 80%)",
        },
        {
            id: "event_neurons",
            title: $t("hubBanner.event.title"),
            subtitle: $t("hubBanner.event.subtitle"),
            imageUrl: "/images/hub_banner_event_anime.png",
            linkUrl: "/edit3",
            actionText: $t("hubBanner.event.action"),
            bgColor:
                "linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(99,102,241,0) 80%)",
        },
        {
            id: "guidebook",
            title: $t("hubBanner.guide.title"),
            subtitle: $t("hubBanner.guide.subtitle"),
            imageUrl: "/images/hub_banner_guide_anime.png",
            linkUrl: "/guide",
            actionText: $t("hubBanner.guide.action"),
            bgColor:
                "linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(244,63,94,0) 80%)",
        },
    ];

    function handleHubSafetyToggle() {
        if (isCheckingIp) return;

        if (!isOverseas) {
            toast.error(
                "국내 접속 시 19세 제반 인증 연동 전까지 필터 해제가 제한됩니다. (KR region restricted)",
            );
            return;
        }

        const user = get(st_user);
        if (!user) {
            toastError("loginRequired");
            goto("/login");
            return;
        }

        if ($settings.safetyFilterOn) {
            // Turning OFF the filter (enabling adult content)
            isAgeVerificationModalOpen = true;
        } else {
            // Turning ON the filter
            $settings.safetyFilterOn = true;
        }
    }

    function confirmAgeVerification() {
        $settings.safetyFilterOn = false;
        isAgeVerificationModalOpen = false;
    }

    function cancelAgeVerification() {
        isAgeVerificationModalOpen = false;
    }

    function handleSimulatedCountryChange(e: Event) {
        const target = e.target as HTMLSelectElement;
        simulatedCountryCode = target.value;
        isOverseas = simulatedCountryCode !== "KR";
    }

    // --- 상수 ---
    const visibleCategories = allCategories.filter(
        (c) => c.id !== 1001 && c.id !== 1002,
    );
    $: dynamicCategories = visibleCategories.filter(
        (c) => !($settings.safetyFilterOn && c.id === 1003),
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

    let isPWA = false;

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
    type HubTab = "home" | "character" | "story" | "companion" | "2d" | "3d";
    let activeTab: HubTab = "home";

    $: currentContentType = activeTab === "story" ? "story" : "character";

    async function setActiveTab(tab: HubTab) {
        if (activeTab === tab) return;
        activeTab = tab;
        await tick();

        // Reset category/sort for list views
        if (tab === "character" || tab === "story") {
            selectedCategory = null;
            currentSort = "latest";
            page = 1;
            reloadAll(); // Reloads the main grid list
        } else if (tab === "home") {
            loadFeaturedSections(); // Reload dashboard
        } else if (tab === "2d") {
            filterByCategory("tags.live2d");
        } else if (tab === "3d") {
            filterByCategory("tags.vrm");
        }
    }

    // Helper to get excluded tags based on safety filter
    $: excludedTags = $settings.safetyFilterOn ? ["tags.r18"] : [];

    // Trigger reload when safety filter changes
    $: if ($settings.safetyFilterOn !== undefined) {
        triggerSafetyFilterReload();
    }

    function triggerSafetyFilterReload() {
        if (activeTab === "home") {
            loadFeaturedSections();
        } else {
            reloadAll();
        }
    }

    async function reloadAll() {
        isLoading.set(true);
        try {
            // ... existing logic but using loadContent with excludedTags
            // Wait, reloadAll used 'loadContent(page, limit, currentSort...)'
            // We need to pass tags if selectedCategory exists.

            let tags: string[] = [];
            if (activeTab === "2d") tags.push("tags.live2d");
            if (activeTab === "3d") tags.push("tags.vrm");
            if (selectedCategory) tags.push(selectedCategory);

            // Define excluded tags (merge with safety filter)
            let tabExcludedTags: string[] = [...excludedTags];
            if (activeTab === "character") {
                tabExcludedTags.push("tags.live2d", "tags.vrm");
            }

            const data = await loadContent(
                page,
                limit,
                currentSort,
                activeTab === "story" ? "story" : "character",
                tags,
                tabExcludedTags,
            );
            contents.set(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            isLoading.set(false);
        }
    }

    onMount(async () => {
        // Check if running locally for testing purposes
        isLocalhost =
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1";

        // Check IP for Safety Filter
        try {
            const res = await fetch("https://ipapi.co/json/");
            if (res.ok) {
                const data = await res.json();
                if (isLocalhost) {
                    isOverseas = simulatedCountryCode !== "KR";
                } else if (data.country_code !== "KR") {
                    isOverseas = true;
                }
            }
        } catch (e) {
            console.error("Failed to check IP", e);
        } finally {
            isCheckingIp = false;
        }

        // Check if running as PWA
        if (typeof window !== "undefined") {
            const isStandalone = window.matchMedia(
                "(display-mode: standalone)",
            ).matches;
            // @ts-ignore
            const isIOSStandalone = window.navigator.standalone === true;
            isPWA = isStandalone || isIOSStandalone;
        }
        triggerSafetyFilterReload();
    });

    // --- State for Home Dashboard ---
    let fantasyContents = writable<PersonaDTO[]>([]);
    let isFantasyLoading = writable(true);

    // ... other states (new, popular etc) ...

    async function loadFeaturedSections() {
        // 1. New Arrivals (Strict Daily)
        isNewLoading.set(true);
        // Load ALL types for Home New Arrivals
        loadContent(newPage, 10, "latest_daily", "all", [], excludedTags).then(
            (data) => {
                newContents.set(data);
                if (data.length < 10) hasMoreNew = false;
                isNewLoading.set(false);
            },
        );

        // 2. Popular Today (Realtime)
        isPopularLoading.set(true);
        // Load ALL types for Home Popular
        loadContent(popularPage, 10, "realtime", "all", [], excludedTags).then(
            (data) => {
                popularContents.set(data);
                if (data.length < 10) hasMorePopular = false;
                isPopularLoading.set(false);
            },
        );

        // 3. Fantasy (Journey to Another World)
        isFantasyLoading.set(true);
        // Load ALL types with fantasy tag
        loadContent(
            1,
            10,
            "popular",
            "all",
            ["tags.fantasy"],
            excludedTags,
        ).then((data) => {
            fantasyContents.set(data);
            isFantasyLoading.set(false);
        });

        // 4. Tech Demos (Live2D & VRM)
        isLive2dLoading.set(true);
        loadContent(
            live2dPage,
            10,
            "popular",
            "all",
            ["tags.live2d"],
            excludedTags,
        ).then((data) => {
            live2dContents.set(data);
            if (data.length < 10) hasMoreLive2d = false;
            isLive2dLoading.set(false);
        });

        isVrmLoading.set(true);
        loadContent(
            vrmPage,
            10,
            "popular",
            "all",
            ["tags.vrm"],
            excludedTags,
        ).then((data) => {
            vrmContents.set(data);
            if (data.length < 10) hasMoreVrm = false;
            isVrmLoading.set(false);
        });
    }

    async function handleLoadMore(type: "new" | "popular" | "live2d" | "vrm") {
        if (type === "new") {
            if ($isNewLoading || !hasMoreNew) return;
            isNewLoading.set(true);
            newPage++;
            const data = await loadContent(
                newPage,
                10,
                "latest_daily",
                "all",
                [],
                excludedTags,
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
                "realtime",
                "all",
                [],
                excludedTags,
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
            const data = await loadContent(
                live2dPage,
                10,
                "popular",
                "all",
                ["tags.live2d"],
                excludedTags,
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
            const data = await loadContent(vrmPage, 10, "popular", "all", [
                "tags.vrm",
            ]);
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

        // Determine additional tags based on activeTab
        let tags: string[] = [];
        if (activeTab === "2d") tags.push("tags.live2d");
        if (activeTab === "3d") tags.push("tags.vrm");

        if (category) tags.push(category);

        // Define excluded tags (merge with safety filter)
        let tabExcludedTags: string[] = [...excludedTags]; // Copy global exclusions (R18)
        if (activeTab === "character") {
            tabExcludedTags.push("tags.live2d", "tags.vrm");
        }

        if (category === null && tags.length === 0) {
            if (tabExcludedTags.length > 0) {
                data = await loadContentWithTags(
                    tags,
                    page,
                    limit,
                    currentSort,
                    currentContentType,
                    tabExcludedTags,
                );
            } else {
                data = await loadContent(
                    page,
                    limit,
                    currentSort,
                    currentContentType,
                );
            }
        } else if (category === "following") {
            data = await loadFollowedContent();
        } else if (category === "liked") {
            data = await loadLikedContent();
        } else {
            data = await loadContentWithTags(
                tags,
                page,
                limit,
                currentSort,
                currentContentType,
                tabExcludedTags,
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

        // Determine additional tags based on activeTab
        let tags: string[] = [];
        if (activeTab === "2d") tags.push("tags.live2d");
        if (activeTab === "3d") tags.push("tags.vrm");

        if (
            selectedCategory &&
            selectedCategory !== "following" &&
            selectedCategory !== "liked" &&
            selectedCategory !== "search"
        ) {
            tags.push(selectedCategory);
        }

        // Define excluded tags (merge with safety filter)
        let tabExcludedTags: string[] = [...excludedTags]; // Copy global exclusions (R18)
        if (activeTab === "character") {
            tabExcludedTags.push("tags.live2d", "tags.vrm");
        }

        if (selectedCategory === null && tags.length === 0) {
            if (tabExcludedTags.length > 0) {
                data = await loadContentWithTags(
                    tags, // empty
                    page,
                    limit,
                    sort,
                    currentContentType,
                    tabExcludedTags,
                );
            } else {
                data = await loadContent(page, limit, sort, currentContentType);
            }
        } else if (selectedCategory === "following") {
            data = await loadFollowedContent();
        } else if (selectedCategory === "liked") {
            data = await loadLikedContent();
        } else if (selectedCategory === "search") {
            if (searchType === "name") {
                data = await loadContentWithName(query);
            } else {
                data = await loadContent(page, limit, sort, currentContentType);
            }
        } else {
            data = await loadContentWithTags(
                tags,
                page,
                limit,
                sort,
                currentContentType,
                tabExcludedTags,
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

    function handleNeuronClick() {
        const user = get(st_user);
        if (!user || !user.id) {
            goto("/login");
            return;
        }
        showNeedMoreNeuronsModal(false);
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

    <!-- Age Verification Modal -->
    {#if isAgeVerificationModalOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="modal-overlay" on:click={cancelAgeVerification}>
            <div
                class="modal-content age-verification-modal"
                on:click|stopPropagation
            >
                <button class="close-button" on:click={cancelAgeVerification}>
                    <Icon icon="mdi:close" />
                </button>
                <h2>{$t("ageVerificationModal.title")}</h2>
                <p class="age-verification-message">
                    {$t("ageVerificationModal.message")}
                </p>
                <div class="age-verification-actions">
                    <button class="cancel-btn" on:click={cancelAgeVerification}>
                        {$t("ageVerificationModal.cancel")}
                    </button>
                    <button
                        class="confirm-btn"
                        on:click={confirmAgeVerification}
                    >
                        {$t("ageVerificationModal.confirm")}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Header Section -->
    <div class="header-section">
        <div
            class="header-content max-w-screen-xl mx-auto w-full flex items-start justify-between"
        >
            <div class="left-controls pt-1.5">
                <!-- Navigation Tabs -->
                <div class="nav-tabs">
                    <!-- Home button removed per user request -->
                    <!-- <button
                        class="nav-tab"
                        class:active={activeTab === "home"}
                        on:click={() => setActiveTab("home")}
                    >
                        {$t("contentHub.nav.home")}
                    </button>
                    <div class="tab-separator">|</div> -->
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
                            class:active={activeTab === "2d" ||
                                activeTab === "3d"}
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
                    <div class="current-category">
                        <!-- filtered chips handled below -->
                    </div>
                {/if}
            </div>

            <div class="right-controls">
                <!-- Neuron Balance Chip (Wallet Pattern) -->
                <button
                    class="neuron-balance-chip"
                    on:click={handleNeuronClick}
                    title={$t("shop.title") || "Recharge Neurons"}
                >
                    <NeuronIcon size={20} color="#fbbf24" variant="standard" />
                    <span class="balance-text">
                        {$st_user?.credits?.toLocaleString() || 0}
                    </span>
                </button>

                <!-- Search Button -->
                <div class="row-controls">
                    {#if isLocalhost}
                        <select
                            class="local-country-select"
                            bind:value={simulatedCountryCode}
                            on:change={handleSimulatedCountryChange}
                            title="로컬 테스트용 국가 코드"
                        >
                            <option value="KR">Korea</option>
                            <option value="US">Overseas</option>
                        </select>
                    {/if}

                    <!-- Safety Filter Toggle -->
                    <button
                        class="safety-filter-btn"
                        class:active={$settings.safetyFilterOn}
                        class:disabled={!isOverseas || isCheckingIp}
                        on:click={handleHubSafetyToggle}
                        title={$settings.safetyFilterOn
                            ? "Safety Filter ON"
                            : "Safety Filter OFF"}
                    >
                        <Icon icon="ph:shield-check-bold" width="18" />
                        <div class="toggle-switch">
                            <div class="toggle-thumb"></div>
                        </div>
                    </button>

                    <button
                        class="search-trigger-button"
                        on:click={() => (isSearchModalOpen = true)}
                    >
                        <Icon icon="mdi:magnify" width="24" height="24" />
                    </button>

                    <!-- Only show filtering options if NOT in Home mode (Home has curated lists) -->
                    {#if activeTab !== "home"}
                        <button
                            class="category-toggle-btn"
                            on:click={toggleCategory}
                            aria-label={$t("contentHub.toggleCategories")}
                        >
                            <div class="icon-wrapper">
                                <Icon
                                    icon="mdi:tune-variant"
                                    width="24"
                                    height="24"
                                />
                            </div>
                        </button>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    <!-- Collapsible Category Bar (Only for List Views) -->
    {#if isCategoryExpanded && activeTab !== "home"}
        <div class="category-panel" transition:slide={{ duration: 300 }}>
            <div class="category-grid max-w-screen-xl mx-auto w-full">
                <button
                    class="cat-chip"
                    class:active={selectedCategory === null}
                    on:click={() => filterByCategory(null)}
                >
                    {$t("contentHub.all")}
                </button>
                {#each dynamicCategories as category (category.id)}
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
        <div class="hub-content max-w-screen-xl mx-auto w-full">
            <!-- Top Banners -->
            <HubBanner banners={hubBanners} />

            <!-- HOME DASHBOARD VIEW -->
            <!-- If we are in home tab AND NOT searching/filtering, show dashboard -->
            {#if activeTab === "home" && !selectedCategory}
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

                <!-- Section 3: Fantasy -->
                <ContentCarousel
                    title={$t("content.fantasy")}
                    contents={$fantasyContents}
                    isLoading={$isFantasyLoading}
                    hasMore={false}
                    on:select={(e) => handleCardClick(e.detail)}
                    on:loadMore={() => {}}
                />

                <!-- Section 4: Live2D -->
                <ContentCarousel
                    title={$t("content.live2dTitle")}
                    contents={$live2dContents}
                    isLoading={$isLive2dLoading}
                    hasMore={hasMoreLive2d}
                    emptyMessage="No Live2D models found."
                    on:select={(e) => handleCardClick(e.detail)}
                    on:loadMore={() => handleLoadMore("live2d")}
                />

                <!-- Section 5: VRM -->
                <ContentCarousel
                    title={$t("content.vrmTitle")}
                    contents={$vrmContents}
                    isLoading={$isVrmLoading}
                    hasMore={hasMoreVrm}
                    emptyMessage="No VRM models found."
                    on:select={(e) => handleCardClick(e.detail)}
                    on:loadMore={() => handleLoadMore("vrm")}
                />
            {:else}
                <!-- LIST VIEW (Character / Story / Filtered) -->
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
                            {:else if selectedCategory}
                                {$t(selectedCategory)}
                            {:else}
                                {$t(`contentHub.nav.${activeTab}`)}
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
    {#if activeTab === "home"}
        <Footer />
    {/if}
    <InstallPrompt />
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
        gap: 1.5rem;
        padding-left: 2.5rem;
    }

    .right-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-direction: column;
        align-items: flex-end;
    }

    /* --- Navigation Tabs --- */
    .nav-tabs {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-left: 0.5rem;
    }

    .nav-label-btn {
        background: none;
        border: none;
        color: var(--muted-foreground);
        font-size: 1.1rem;
        font-weight: 500;
        cursor: pointer;
        padding: 0;
        transition:
            color 0.2s,
            transform 0.1s;
        white-space: nowrap; /* Prevent wrapping for long names (e.g. English) */
        flex-shrink: 0;
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
            transform 0.1s;
        white-space: nowrap; /* Prevent wrapping for long names (e.g. English) */
        flex-shrink: 0;
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

    /* --- Grid --- */
    .content.flex-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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

    /* Age Verification Modal Styles */
    .age-verification-modal {
        max-width: 400px;
        text-align: center;
    }

    .age-verification-message {
        margin: 1.5rem 0;
        color: var(--foreground);
        font-size: 1rem;
        line-height: 1.5;
    }

    .age-verification-actions {
        display: flex;
        gap: 1rem;
        margin-top: 1.5rem;
    }

    .age-verification-actions button {
        flex: 1;
        padding: 0.75rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
    }

    .age-verification-actions .cancel-btn {
        background-color: var(--secondary);
        color: var(--foreground);
    }

    .age-verification-actions .cancel-btn:hover {
        background-color: var(--border);
    }

    .age-verification-actions .confirm-btn {
        background-color: var(--destructive);
        color: white;
    }

    .age-verification-actions .confirm-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }

    .search-trigger-button {
        background: none;
        border: none;
        color: var(--foreground);
        padding: 0.5rem;
        cursor: pointer;
    }

    .neuron-balance-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--card);
        border: 1px solid var(--border);
        padding: 6px 12px;
        border-radius: 999px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: var(--foreground);
        font-weight: 600;
        font-size: 0.9rem;
        box-shadow: var(--shadow-sm);
    }

    .neuron-balance-chip:hover {
        background: var(--secondary);
        transform: translateY(-1px);
        box-shadow: var(--shadow-card);
    }

    /* --- Safety Filter Toggle --- */
    .safety-filter-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.4rem 0.6rem;
        border-radius: 999px;
        transition: all 0.2s;
        margin-right: 0.25rem;
        border: 1px solid transparent;
    }

    .safety-filter-btn:hover {
        background-color: var(--secondary);
        border-color: var(--border);
    }

    .safety-filter-btn.active {
        background-color: hsla(140, 60%, 40%, 0.1);
        border-color: hsl(140, 60%, 40%);
        color: hsl(140, 60%, 40%);
    }

    .safety-filter-btn.active .toggle-thumb {
        transform: translateX(12px);
        background-color: hsl(140, 60%, 40%);
    }

    .safety-filter-btn.active .toggle-switch {
        border-color: hsl(140, 60%, 40%);
        background-color: hsla(140, 60%, 40%, 0.15);
    }

    .filter-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--muted-foreground);
        transition: color 0.2s;
    }

    .toggle-switch {
        width: 30px;
        height: 18px;
        background-color: var(--muted);
        border-radius: 999px;
        position: relative;
        transition: all 0.2s;
        border: 1px solid var(--border);
    }

    .toggle-thumb {
        width: 14px;
        height: 14px;
        background-color: white;
        border-radius: 50%;
        position: absolute;
        top: 1px;
        left: 1px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .row-controls {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: right;
        padding-right: 0.5rem;
    }

    .local-country-select {
        margin-right: 0.5rem;
        padding: 0.25rem 0.5rem;
        background: var(--card);
        color: var(--foreground);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        font-size: 0.8rem;
    }

    /* --- Mobile --- */
    @media (max-width: 768px) {
        .header-section {
            flex-direction: row;
            align-items: flex-start;
            gap: 1rem;
            padding: 1rem 0.5rem;
        }
        .content.flex-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.3rem;
            padding-right: 1rem;
        }

        .hub-section {
            padding-left: 1rem;
        }
        .left-controls {
            padding-left: 1rem;
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 0.5rem;
            white-space: nowrap;
        }

        .right-controls {
            width: 30%;
            flex-direction: column;
            justify-content: flex-end;
            align-items: right;
            padding-right: 0.5rem;
        }

        .left-controls::-webkit-scrollbar {
            display: none;
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


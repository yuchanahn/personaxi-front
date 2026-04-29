<script lang="ts">
    import { goto } from "$app/navigation";
    import { page as appPage } from "$app/stores";
    import {
        loadContent,
        loadContentWithTags,
        loadContentWithName,
        loadFollowedContent,
        loadLikedContent,
        loadHubSections,
    } from "$lib/api/content";
    import type { PersonaDTO } from "$lib/types";
    import { onDestroy, onMount, tick } from "svelte";
    import { writable } from "svelte/store";
    import { t } from "svelte-i18n";
    import CharacterCard from "../card/CharacterCard.svelte";
    import NeuronIcon from "$lib/components/icons/NeuronIcon.svelte";
    import ContentCarousel from "./ContentCarousel.svelte";
    import Icon from "@iconify/svelte";
    import { allCategories } from "$lib/constants";
    import {
        normalizeHubTab,
        normalizeHubTag,
        type HubTab,
    } from "$lib/utils/hubTagNavigation";
    import { slide } from "svelte/transition";
    import InstallPrompt from "$lib/components/common/InstallPrompt.svelte";
    import Footer from "$lib/components/common/Footer.svelte";
    import { settings } from "$lib/stores/settings";
    import { st_user } from "$lib/stores/user";
    import { get } from "svelte/store";
    import { toast } from "$lib/stores/toast";
    import { showNeedMoreNeuronsModal } from "$lib/stores/modal";
    import { requestIdentityVerification } from "$lib/services/verification";
    import { updateBirthDate, updateSafetyFilter } from "$lib/api/user";
    import HubBanner from "./HubBanner.svelte";
    import { ensureAuthenticated } from "$lib/utils/authNavigation";
    import { AuthRequiredError } from "$lib/stores/authGate";

    type HubHomeSection = {
        id: string;
        sectionKey: string;
        title: string;
        contentType: string;
        queryMode: string;
        queryTags: string[];
        excludeTags: string[];
        limit: number;
        contents: PersonaDTO[];
        isLoading: boolean;
        hasMore: boolean;
        page: number;
    };

    let isAgeVerificationModalOpen = false;
    let safetyModalMode: "kr_verification" | "overseas_birthdate" =
        "overseas_birthdate";
    let overseasBirthDate = "";
    let isUpdatingSafety = false;

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
            linkUrl: "https://discord.gg/hfgPAk8jhC",
            actionText: $t("hubBanner.discord.action"),
            bgColor:
                "linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(88,101,242,0) 80%)",
        },
        {
            id: "event_neurons",
            title: $t("hubBanner.event.title"),
            subtitle: $t("hubBanner.event.subtitle"),
            imageUrl: "/images/hub_banner_event_anime.png",
            linkUrl: "/edit",
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

    function normalizeDateInputValue(raw?: string) {
        const value = raw?.trim();
        if (!value) return "";
        if (/^\d{8}$/.test(value)) {
            return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
        }
        return value;
    }

    function getStoredBirthDate() {
        return normalizeDateInputValue(get(st_user)?.data?.birthDate);
    }

    async function handleHubSafetyToggle() {
        if (isCheckingIp || isUpdatingSafety) return;

        if (
            !(await ensureAuthenticated({
                reason: "hub-safety-toggle",
            }))
        ) {
            return;
        }

        const user = get(st_user);
        if (!user) return;

        const storedBirthDate = getStoredBirthDate();
        if (isOverseas && storedBirthDate) {
            overseasBirthDate = storedBirthDate;
        }

        if (!isOverseas && !user.data?.isVerified) {
            safetyModalMode = "kr_verification";
            isAgeVerificationModalOpen = true;
            return;
        }

        if ($settings.safetyFilterOn) {
            if (isOverseas) {
                if (storedBirthDate) {
                    isUpdatingSafety = true;
                    try {
                        const result = await updateSafetyFilter(false);
                        settings.update((current) => ({
                            ...current,
                            safetyFilterOn: result.safetyFilterOn,
                        }));
                        st_user.update((current) =>
                            current
                                ? {
                                      ...current,
                                      data: {
                                          ...current.data,
                                          safetyFilterOn: result.safetyFilterOn,
                                          isVerified:
                                              result.isVerified ??
                                              current.data?.isVerified,
                                      },
                                  }
                                : current,
                        );
                    } catch (error) {
                        toast.error(
                            error instanceof Error
                                ? error.message
                                : $t("settingPageModal.safetyUpdateFailed"),
                        );
                    } finally {
                        isUpdatingSafety = false;
                    }
                    return;
                }

                safetyModalMode = "overseas_birthdate";
                isAgeVerificationModalOpen = true;
                return;
            }

            isUpdatingSafety = true;
            try {
                const result = await updateSafetyFilter(false);
                settings.update((current) => ({
                    ...current,
                    safetyFilterOn: result.safetyFilterOn,
                }));
                st_user.update((current) =>
                    current
                        ? {
                              ...current,
                              data: {
                                  ...current.data,
                                  safetyFilterOn: result.safetyFilterOn,
                                  isVerified:
                                      result.isVerified ??
                                      current.data?.isVerified,
                              },
                          }
                        : current,
                );
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : $t("settingPageModal.safetyUpdateFailed"),
                );
            } finally {
                isUpdatingSafety = false;
            }
        } else {
            // Turning ON the filter
            isUpdatingSafety = true;
            try {
                const result = await updateSafetyFilter(true);
                settings.update((current) => ({
                    ...current,
                    safetyFilterOn: result.safetyFilterOn,
                }));
                st_user.update((current) =>
                    current
                        ? {
                              ...current,
                              data: {
                                  ...current.data,
                                  safetyFilterOn: result.safetyFilterOn,
                              },
                          }
                        : current,
                );
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : $t("settingPageModal.safetyUpdateFailed"),
                );
            } finally {
                isUpdatingSafety = false;
            }
        }
    }

    async function confirmAgeVerification() {
        if (
            !(await ensureAuthenticated({
                reason: "hub-age-verification",
            }))
        ) {
            return;
        }

        const user = get(st_user);
        if (!user) return;

        if (safetyModalMode === "kr_verification") {
            isAgeVerificationModalOpen = false;
            await handleHubIdentityVerification();
            return;
        }

        isUpdatingSafety = true;
        try {
            if (safetyModalMode === "overseas_birthdate") {
                const normalizedBirthDate = overseasBirthDate.trim();
                if (!normalizedBirthDate) {
                    toast.error($t("settingPageModal.birthDateRequired"));
                    return;
                }

                const birthResult = await updateBirthDate(normalizedBirthDate);
                st_user.update((current) =>
                    current
                        ? {
                              ...current,
                              data: {
                                  ...current.data,
                                  birthDate: birthResult.birthDate,
                                  safetyFilterOn: birthResult.safetyFilterOn,
                              },
                          }
                        : current,
                );
                settings.update((current) => ({
                    ...current,
                    safetyFilterOn: birthResult.safetyFilterOn,
                }));

                if (!birthResult.isAdult) {
                    toast.error($t("settingPageModal.adultAgeRequired"));
                    return;
                }
            }

            const result = await updateSafetyFilter(false);
            settings.update((current) => ({
                ...current,
                safetyFilterOn: result.safetyFilterOn,
            }));
            st_user.update((current) =>
                current
                    ? {
                          ...current,
                          data: {
                              ...current.data,
                              safetyFilterOn: result.safetyFilterOn,
                              isVerified:
                                  result.isVerified ?? current.data?.isVerified,
                          },
                      }
                    : current,
            );
            isAgeVerificationModalOpen = false;
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : $t("settingPageModal.safetyUpdateFailed"),
            );
        } finally {
            isUpdatingSafety = false;
        }
    }

    function cancelAgeVerification() {
        isAgeVerificationModalOpen = false;
    }

    async function handleHubIdentityVerification() {
        if (
            !(await ensureAuthenticated({
                reason: "hub-identity-verification",
            }))
        ) {
            return;
        }

        const user = get(st_user);
        if (!user) return;

        await requestIdentityVerification({
            onSuccess: () => {},
        });
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
    let homeSections = writable<HubHomeSection[]>([]);

    let isLoading = writable(true);

    let isPWA = false;

    let isSearchModalOpen = false;
    let query = "";
    let searchType: "name" | "tags" = "name";

    type HubSpecialMode = "following" | "liked" | "search";

    let selectedCategories: string[] = [];
    let selectedSpecialMode: HubSpecialMode | null = null;
    let currentSort = "latest";
    let page = 1;
    const limit = 20;

    let hasMoreMain = true;
    let hubContainerEl: HTMLDivElement;
    let hubScrollTarget: HTMLElement | Window | null = null;

    let isCategoryExpanded = false;

    // --- Tab Navigation ---
    let activeTab: HubTab = "home";
    let lastAppliedHubQueryKey = "";

    $: currentContentType = activeTab === "story" ? "story" : "character";

    function getBaseTabTags(tab: HubTab = activeTab): string[] {
        if (tab === "2d") return ["tags.live2d"];
        if (tab === "3d") return ["tags.vrm"];
        return [];
    }

    function getCombinedTagFilters(
        categories: string[] = selectedCategories,
        tab: HubTab = activeTab,
    ): string[] {
        return Array.from(new Set([...getBaseTabTags(tab), ...categories]));
    }

    function getTabExcludedTags(tab: HubTab = activeTab): string[] {
        const next = [...excludedTags];
        if (tab === "character") {
            next.push("tags.live2d", "tags.vrm");
        }
        return Array.from(new Set(next));
    }

    function stripBaseTabTags(
        categories: string[],
        tab: HubTab = activeTab,
    ): string[] {
        const baseTags = new Set(getBaseTabTags(tab));
        return categories.filter((category) => !baseTags.has(category));
    }

    function hasAnyActiveFilters() {
        return selectedSpecialMode !== null || selectedCategories.length > 0;
    }

    function getSelectedFilterHeading() {
        if (selectedSpecialMode === "search") {
            return $t("contentHub.searchResult", {
                values: { query },
            });
        }

        if (selectedSpecialMode === "following") {
            return $t("contentHub.following");
        }

        if (selectedSpecialMode === "liked") {
            return $t("contentHub.liked");
        }

        if (selectedCategories.length > 0) {
            return selectedCategories.map((category) => $t(category)).join(" · ");
        }

        return $t(`contentHub.nav.${activeTab}`);
    }

    async function setActiveTab(tab: HubTab) {
        if (activeTab === tab) return;
        activeTab = tab;
        await tick();

        // Reset category/sort for list views
        if (tab === "character" || tab === "story") {
            selectedCategories = [];
            selectedSpecialMode = null;
            currentSort = "latest";
            page = 1;
            reloadAll(); // Reloads the main grid list
        } else if (tab === "home") {
            selectedCategories = [];
            selectedSpecialMode = null;
            loadFeaturedSections(); // Reload dashboard
        } else if (tab === "2d") {
            selectedCategories = [];
            selectedSpecialMode = null;
            currentSort = "latest";
            page = 1;
            reloadAll();
        } else if (tab === "3d") {
            selectedCategories = [];
            selectedSpecialMode = null;
            currentSort = "latest";
            page = 1;
            reloadAll();
        }
    }

    // Helper to get excluded tags based on safety filter
    $: excludedTags = $settings.safetyFilterOn ? ["tags.r18"] : [];

    let hubInitialized = false;
    let lastSafetyFilterValue: boolean | undefined = undefined;
    let lastHubLanguage = "";
    let featuredRequestId = 0;
    const PROFILE_PREVIEW_STORAGE_PREFIX = "personaxi:profile-preview:";
    const homeSkeletonSections = Array.from({ length: 3 }, (_, index) => index);
    const homeSkeletonCards = Array.from({ length: 5 }, (_, index) => index);
    let isInitialHomeSectionsLoading = true;

    function cacheProfilePreview(content: PersonaDTO) {
        if (typeof sessionStorage === "undefined") return;

        try {
            sessionStorage.setItem(
                `${PROFILE_PREVIEW_STORAGE_PREFIX}${content.id}`,
                JSON.stringify(content),
            );
        } catch (error) {
            console.warn("Failed to cache profile preview", error);
        }
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
            const data = await fetchMainListPage(page);
            contents.set(data || []);
            hasMoreMain = (data?.length || 0) >= limit;
        } catch (e) {
            console.error(e);
        } finally {
            isLoading.set(false);
        }
    }

    function shouldPaginateMainList() {
        return selectedSpecialMode !== "following" &&
            selectedSpecialMode !== "liked" &&
            selectedSpecialMode !== "search";
    }

    async function fetchMainListPage(
        pageNum: number,
        options?: {
            sort?: string;
            categories?: string[];
            specialMode?: HubSpecialMode | null;
            tab?: HubTab;
        },
    ): Promise<PersonaDTO[]> {
        const nextSort = options?.sort ?? currentSort;
        const nextCategories = options?.categories ?? selectedCategories;
        const nextSpecialMode = options?.specialMode ?? selectedSpecialMode;
        const nextTab = options?.tab ?? activeTab;
        const nextContentType = nextTab === "story" ? "story" : "character";

        if (nextSpecialMode === "following") {
            return pageNum === 1 ? await loadFollowedContent() : [];
        }

        if (nextSpecialMode === "liked") {
            return pageNum === 1 ? await loadLikedContent() : [];
        }

        if (nextSpecialMode === "search") {
            if (!query.trim()) {
                return await loadContent(
                    pageNum,
                    limit,
                    nextSort,
                    nextContentType,
                    getCombinedTagFilters(nextCategories, nextTab),
                    getTabExcludedTags(nextTab),
                );
            }

            if (searchType === "name") {
                return pageNum === 1 ? await loadContentWithName(query) : [];
            }

            return [];
        }

        const tags = getCombinedTagFilters(nextCategories, nextTab);
        const tabExcludedTags = getTabExcludedTags(nextTab);

        if (tags.length === 0) {
            return await loadContent(
                pageNum,
                limit,
                nextSort,
                nextContentType,
                [],
                tabExcludedTags,
            );
        }

        return await loadContentWithTags(
            tags,
            pageNum,
            limit,
            nextSort,
            nextContentType,
            tabExcludedTags,
        );
    }

    async function loadMoreMainList() {
        if ($isLoading || !hasMoreMain || activeTab === "home") return;
        if (!shouldPaginateMainList()) return;

        isLoading.set(true);
        try {
            const nextPage = page + 1;
            const data = await fetchMainListPage(nextPage);

            if (data.length > 0) {
                page = nextPage;
                contents.update((current) => [...current, ...data]);
                hasMoreMain = data.length >= limit;
            } else {
                hasMoreMain = false;
            }
        } catch (e) {
            console.error("Failed to load more hub contents:", e);
        } finally {
            isLoading.set(false);
        }
    }

    function isScrollableElement(node: HTMLElement) {
        const style = getComputedStyle(node);
        const overflowY = style.overflowY;
        return (
            (overflowY === "auto" || overflowY === "scroll") &&
            node.scrollHeight > node.clientHeight
        );
    }

    function findScrollParent(node: HTMLElement | null) {
        let current = node?.parentElement ?? null;

        while (current) {
            if (isScrollableElement(current)) {
                return current;
            }
            current = current.parentElement;
        }

        return window;
    }

    function getScrollMetrics(target: HTMLElement | Window) {
        if (target instanceof Window) {
            const doc = document.documentElement;
            const body = document.body;
            const scrollTop =
                window.scrollY || doc.scrollTop || body.scrollTop || 0;
            const clientHeight = window.innerHeight;
            const scrollHeight = Math.max(
                body.scrollHeight,
                doc.scrollHeight,
                body.offsetHeight,
                doc.offsetHeight,
                body.clientHeight,
                doc.clientHeight,
            );

            return { scrollTop, clientHeight, scrollHeight };
        }

        return {
            scrollTop: target.scrollTop,
            clientHeight: target.clientHeight,
            scrollHeight: target.scrollHeight,
        };
    }

    function bindHubScrollTarget() {
        if (hubScrollTarget) {
            hubScrollTarget.removeEventListener("scroll", handleHubScroll);
        }

        hubScrollTarget = findScrollParent(hubContainerEl);
        hubScrollTarget.addEventListener("scroll", handleHubScroll, {
            passive: true,
        });
    }

    function getHubQueryState(url: URL) {
        const rawTags =
            url.searchParams.get("tags") || url.searchParams.get("tag") || "";
        const tags = Array.from(
            new Set(
                rawTags
                    .split(",")
                    .map((tag) => normalizeHubTag(tag))
                    .filter((tag): tag is string => Boolean(tag)),
            ),
        );
        let tab = normalizeHubTab(url.searchParams.get("tab"));

        if (!tab && tags.includes("tags.live2d")) {
            tab = "2d";
        } else if (!tab && tags.includes("tags.vrm")) {
            tab = "3d";
        } else if (!tab && tags.length > 0) {
            tab = "character";
        }

        return { tags, tab };
    }

    function getHubQueryKey(url: URL) {
        const { tags, tab } = getHubQueryState(url);
        return `${tab || ""}|${tags.join(",")}`;
    }

    async function applyHubQueryState(url: URL, options?: { initial?: boolean }) {
        const { tags, tab } = getHubQueryState(url);

        if (tags.length > 0) {
            if (tab && activeTab !== tab) {
                activeTab = tab;
            } else if (activeTab === "home") {
                activeTab = "character";
            }

            selectedSpecialMode = null;
            selectedCategories = stripBaseTabTags(tags, activeTab);
            currentSort = "latest";
            query = "";
            searchType = "name";
            page = 1;
            hasMoreMain = true;
            await tick();
            await reloadAll();
            return;
        }

        if (tab) {
            activeTab = tab;
            selectedCategories = [];
            selectedSpecialMode = null;
            currentSort = "latest";
            query = "";
            searchType = "name";
            page = 1;
            hasMoreMain = true;
            await tick();

            if (tab === "home") {
                loadFeaturedSections();
            } else {
                await reloadAll();
            }
            return;
        }

        if (options?.initial) {
            triggerSafetyFilterReload();
        } else {
            activeTab = "home";
            selectedCategories = [];
            selectedSpecialMode = null;
            currentSort = "latest";
            query = "";
            searchType = "name";
            page = 1;
            hasMoreMain = true;
            await tick();
            loadFeaturedSections();
        }
    }

    onMount(async () => {
        // Check if running locally for testing purposes
        isLocalhost =
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1";

        // IP check runs concurrently — doesn't block hub rendering
        isCheckingIp = false;
        (async () => {
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
            }
        })();

        // Check if running as PWA
        if (typeof window !== "undefined") {
            const isStandalone = window.matchMedia(
                "(display-mode: standalone)",
            ).matches;
            // @ts-ignore
            const isIOSStandalone = window.navigator.standalone === true;
            isPWA = isStandalone || isIOSStandalone;
        }
        hubInitialized = true;
        lastSafetyFilterValue = $settings.safetyFilterOn;
        lastHubLanguage = $settings.language;
        bindHubScrollTarget();
        const initialUrl = get(appPage).url;
        lastAppliedHubQueryKey = getHubQueryKey(initialUrl);
        await applyHubQueryState(initialUrl, { initial: true });
    });

    onDestroy(() => {
        if (hubScrollTarget) {
            hubScrollTarget.removeEventListener("scroll", handleHubScroll);
        }
    });

    $: if (
        hubInitialized &&
        ($settings.safetyFilterOn !== lastSafetyFilterValue ||
            $settings.language !== lastHubLanguage)
    ) {
        lastSafetyFilterValue = $settings.safetyFilterOn;
        lastHubLanguage = $settings.language;
        triggerSafetyFilterReload();
    }

    $: if (hubInitialized) {
        const nextHubQueryKey = getHubQueryKey($appPage.url);
        if (nextHubQueryKey !== lastAppliedHubQueryKey) {
            lastAppliedHubQueryKey = nextHubQueryKey;
            void applyHubQueryState($appPage.url);
        }
    }

    function handleHubScroll() {
        if (!hubScrollTarget || activeTab === "home") return;
        if (!shouldPaginateMainList() || $isLoading || !hasMoreMain) return;

        const { scrollTop, clientHeight, scrollHeight } =
            getScrollMetrics(hubScrollTarget);
        const distanceToBottom = scrollHeight - (scrollTop + clientHeight);

        if (distanceToBottom <= 96) {
            loadMoreMainList();
        }
    }

    async function loadHubSectionItems(
        section: Pick<
            HubHomeSection,
            "queryMode" | "queryTags" | "excludeTags" | "limit" | "contentType"
        >,
        pageNum: number,
    ) {
        const limitValue = section.limit > 0 ? section.limit : 10;
        const combinedExcludedTags = [
            ...excludedTags,
            ...(section.excludeTags ?? []),
        ];

        switch (section.queryMode) {
            case "tags":
                return await loadContentWithTags(
                    section.queryTags ?? [],
                    pageNum,
                    limitValue,
                    "popular",
                    section.contentType || "character",
                    combinedExcludedTags,
                );
            case "popular":
                return await loadContent(
                    pageNum,
                    limitValue,
                    "popular",
                    section.contentType || "character",
                    section.queryTags ?? [],
                    combinedExcludedTags,
                );
            case "realtime":
                return await loadContent(
                    pageNum,
                    limitValue,
                    "realtime",
                    section.contentType || "character",
                    section.queryTags ?? [],
                    combinedExcludedTags,
                );
            case "latest":
                return await loadContent(
                    pageNum,
                    limitValue,
                    "latest",
                    section.contentType || "character",
                    section.queryTags ?? [],
                    combinedExcludedTags,
                );
            case "latest_daily":
                return await loadContent(
                    pageNum,
                    limitValue,
                    "latest_daily",
                    section.contentType || "character",
                    section.queryTags ?? [],
                    combinedExcludedTags,
                );
            default:
                return await loadContent(
                    pageNum,
                    limitValue,
                    section.queryMode || "latest",
                    section.contentType || "character",
                    section.queryTags ?? [],
                    combinedExcludedTags,
                );
        }
    }

    async function loadFeaturedSections() {
        const requestId = ++featuredRequestId;
        const existingSections = get(homeSections);

        if (existingSections.length === 0) {
            isInitialHomeSectionsLoading = true;
        } else {
            homeSections.update((items) =>
                items.map((item) => ({
                    ...item,
                    isLoading: true,
                })),
            );
        }

        try {
            const sectionConfigs = await loadHubSections();
            const sectionViews: HubHomeSection[] = sectionConfigs.map(
                (section) => ({
                    id: section.id,
                    sectionKey: section.section_key,
                    title: section.title,
                    contentType: section.content_type || "character",
                    queryMode: section.query_mode || "latest",
                    queryTags: section.query_tags ?? [],
                    excludeTags: section.exclude_tags ?? [],
                    limit: section.limit || 10,
                    contents: section.items ?? [],
                    isLoading: false,
                    hasMore:
                        (section.items?.length ?? 0) >= (section.limit || 10),
                    page: 1,
                }),
            );

            if (requestId !== featuredRequestId) return;
            homeSections.set(sectionViews);
            isInitialHomeSectionsLoading = false;
        } catch (error) {
            console.error("Failed to load hub sections:", error);
            if (requestId !== featuredRequestId) return;
            if (existingSections.length > 0) {
                homeSections.set(
                    existingSections.map((section) => ({
                        ...section,
                        isLoading: false,
                    })),
                );
            } else {
                homeSections.set([]);
            }
            isInitialHomeSectionsLoading = false;
        }
    }

    async function handleLoadMore(sectionKey: string) {
        const section = $homeSections.find(
            (item) => item.sectionKey === sectionKey,
        );
        if (!section || section.isLoading || !section.hasMore) return;

        homeSections.update((items) =>
            items.map((item) =>
                item.sectionKey === sectionKey
                    ? { ...item, isLoading: true }
                    : item,
            ),
        );

        try {
            const nextPage = section.page + 1;
            const data = await loadHubSectionItems(section, nextPage);

            homeSections.update((items) =>
                items.map((item) => {
                    if (item.sectionKey !== sectionKey) return item;
                    return {
                        ...item,
                        page: nextPage,
                        contents: [...item.contents, ...data],
                        hasMore: data.length >= item.limit,
                        isLoading: false,
                    };
                }),
            );
        } catch (error) {
            console.error("Failed to load more hub section:", error);
            homeSections.update((items) =>
                items.map((item) =>
                    item.sectionKey === sectionKey
                        ? { ...item, isLoading: false }
                        : item,
                ),
            );
        }
    }

    // --- 필터링 및 로직 ---
    async function setSelectedCategories(categories: string[]) {
        selectedCategories = Array.from(new Set(categories));
        selectedSpecialMode = null;
        page = 1;
        hasMoreMain = true;
        isLoading.set(true);
        let data: PersonaDTO[] = [];

        try {
            data = await fetchMainListPage(page, {
                categories: selectedCategories,
                specialMode: null,
            });
        } catch (error) {
            if (!(error instanceof AuthRequiredError)) {
                throw error;
            }
            data = [];
        }

        contents.set(data);
        hasMoreMain = shouldPaginateMainList() && data.length >= limit;
        isLoading.set(false);
    }

    async function clearCategoryFilters() {
        await setSelectedCategories([]);
    }

    async function toggleCategoryFilter(category: string) {
        const nextCategories = selectedCategories.includes(category)
            ? selectedCategories.filter((item) => item !== category)
            : [...selectedCategories, category];

        await setSelectedCategories(nextCategories);
    }

    async function changeSort(sort: string) {
        if (currentSort === sort) return;
        currentSort = sort;
        page = 1;
        hasMoreMain = true;
        isLoading.set(true);
        let data: PersonaDTO[] = [];

        try {
            data = await fetchMainListPage(page, { sort });
        } catch (error) {
            if (!(error instanceof AuthRequiredError)) {
                throw error;
            }
            data = [];
        }

        contents.set(data);
        hasMoreMain = shouldPaginateMainList() && data.length >= limit;
        isLoading.set(false);
    }

    async function executeSearch() {
        isLoading.set(true);
        selectedSpecialMode = "search";
        selectedCategories = [];
        isSearchModalOpen = false;

        let data: PersonaDTO[] = [];
        page = 1;
        hasMoreMain = false;

        try {
            data = await fetchMainListPage(page, {
                specialMode: "search",
                categories: [],
            });

            if (!query.trim()) {
                selectedSpecialMode = null;
            }
        } catch (error) {
            if (!(error instanceof AuthRequiredError)) {
                throw error;
            }
            data = [];
        }

        contents.set(data);
        isLoading.set(false);
    }

    function handleCardClick(content: PersonaDTO) {
        cacheProfilePreview(content);
        goto(`/profile?c=${content.id}`);
    }

    function handleNeuronClick() {
        const user = get(st_user);
        if (!user || !user.id) {
            void ensureAuthenticated({
                reason: "hub-neuron-modal",
            });
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
                <h2>
                    {#if safetyModalMode === "kr_verification"}
                        {$t("ageVerificationModal.title")}
                    {:else}
                        {$t("settingPageModal.birthDateLabel")}
                    {/if}
                </h2>
                <p class="age-verification-message">
                    {#if safetyModalMode === "kr_verification"}
                        {$t("settingPageModal.safetyVerificationRequired")}
                    {:else}
                        {$t("settingPageModal.birthDateDescription")}
                    {/if}
                </p>
                {#if safetyModalMode === "overseas_birthdate"}
                    <input
                        class="age-birthdate-input"
                        type="date"
                        bind:value={overseasBirthDate}
                        max={new Date().toISOString().slice(0, 10)}
                    />
                {/if}
                <div class="age-verification-actions">
                    <button class="cancel-btn" on:click={cancelAgeVerification}>
                        {$t("ageVerificationModal.cancel")}
                    </button>
                    <button
                        class="confirm-btn"
                        on:click={confirmAgeVerification}
                        disabled={isUpdatingSafety}
                    >
                        {#if safetyModalMode === "kr_verification"}
                            {$t("settingPageModal.verificationAction")}
                        {:else}
                            {$t("common.save")}
                        {/if}
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
                            class="nav-tab"
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

                {#if hasAnyActiveFilters()}
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
                    class:active={selectedSpecialMode === null &&
                        selectedCategories.length === 0}
                    on:click={clearCategoryFilters}
                >
                    {$t("contentHub.all")}
                </button>
                {#each dynamicCategories as category (category.id)}
                    <button
                        class="cat-chip"
                        class:active={selectedCategories.includes(
                            category.nameKey,
                        )}
                        on:click={() => toggleCategoryFilter(category.nameKey)}
                    >
                        {$t(`${category.nameKey}`)}
                    </button>
                {/each}
            </div>
        </div>
    {/if}

    <div class="hub-container" bind:this={hubContainerEl}>
        <div class="hub-content max-w-screen-xl mx-auto w-full">
            <!-- Top Banners -->
            <HubBanner banners={hubBanners} />

            <!-- HOME DASHBOARD VIEW -->
            <!-- If we are in home tab AND NOT searching/filtering, show dashboard -->
            {#if activeTab === "home" && !hasAnyActiveFilters()}
                {#if isInitialHomeSectionsLoading && $homeSections.length === 0}
                    <div class="home-skeleton" aria-hidden="true">
                        {#each homeSkeletonSections as sectionIndex}
                            <section class="hub-section skeleton-section">
                                <div class="section-header">
                                    <div
                                        class="skeleton-title"
                                        style={`--skeleton-title-width: ${sectionIndex % 2 === 0 ? "10.5rem" : "8.5rem"}`}
                                    ></div>
                                </div>
                                <div class="skeleton-carousel">
                                    {#each homeSkeletonCards as cardIndex}
                                        <div
                                            class="skeleton-card"
                                            class:is-dim={cardIndex >= 4}
                                        >
                                            <div
                                                class="skeleton-card-media"
                                            ></div>
                                        </div>
                                    {/each}
                                </div>
                            </section>
                        {/each}
                    </div>
                {:else}
                    {#each $homeSections as section (section.id)}
                        {#if section.isLoading || section.contents.length > 0}
                            <ContentCarousel
                                title={section.title}
                                contents={section.contents}
                                isLoading={section.isLoading}
                                hasMore={section.hasMore}
                                on:select={(e) => handleCardClick(e.detail)}
                                on:loadMore={() =>
                                    handleLoadMore(section.sectionKey)}
                            />
                        {/if}
                    {/each}
                {/if}
            {:else}
                <!-- LIST VIEW (Character / Story / Filtered) -->
                <section class="hub-section full-height">
                    <div class="section-header">
                        <h3>{getSelectedFilterHeading()}</h3>
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

                    {#if $isLoading && $contents.length === 0}
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
                        {#if $isLoading && $contents.length > 0}
                            <div class="center-message list-loading-more">
                                Loading...
                            </div>
                        {/if}
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

    .home-skeleton {
        display: flex;
        flex-direction: column;
    }

    .skeleton-section {
        overflow: hidden;
    }

    .skeleton-title {
        width: var(--skeleton-title-width, 9.5rem);
        max-width: 70%;
        height: 1.35rem;
        border-radius: 999px;
        background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--card) 82%, transparent) 0%,
            color-mix(in srgb, var(--muted) 70%, transparent) 50%,
            color-mix(in srgb, var(--card) 82%, transparent) 100%
        );
        background-size: 200% 100%;
        animation: skeleton-shimmer 1.4s ease-in-out infinite;
    }

    .skeleton-carousel {
        display: flex;
        gap: 0.5rem;
        overflow: hidden;
        padding-top: 0.45rem;
        padding-right: 1.5rem;
        padding-bottom: 1rem;
        margin-top: -0.45rem;
        min-height: 276px;
    }

    .skeleton-card {
        flex: 0 0 200px;
        width: 200px;
        align-self: stretch;
    }

    .skeleton-card.is-dim {
        opacity: 0.72;
    }

    .skeleton-card-media {
        width: 100%;
        aspect-ratio: 9 / 11;
        border-radius: var(--radius-card);
        background: linear-gradient(
            120deg,
            color-mix(in srgb, var(--card) 90%, transparent) 0%,
            color-mix(in srgb, var(--muted) 74%, transparent) 52%,
            color-mix(in srgb, var(--card) 90%, transparent) 100%
        );
        background-size: 220% 100%;
        box-shadow: var(--media-card-shadow);
        animation: skeleton-shimmer 1.4s ease-in-out infinite;
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

    .center-message {
        color: var(--muted-foreground);
        text-align: center;
        padding: 2rem 1.5rem 1rem 0;
    }

    .list-loading-more {
        padding-top: 0.75rem;
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
    .age-verification-actions button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .age-birthdate-input {
        width: 100%;
        margin-bottom: 1rem;
        border: 1px solid var(--border);
        border-radius: 10px;
        background-color: var(--background);
        color: var(--foreground);
        padding: 0.75rem 0.9rem;
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
    }

    .safety-filter-btn:hover {
        background-color: var(--secondary);
    }

    .safety-filter-btn :global(svg) {
        color: var(--muted-foreground);
        transition: color 0.2s ease;
    }

    .safety-filter-btn.active {
        color: inherit;
    }

    .safety-filter-btn.active :global(svg) {
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

        .hub-container {
            padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
        }

        .content.flex-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.3rem;
            padding-right: 1rem;
        }

        .hub-section {
            padding-left: 1rem;
        }

        .skeleton-carousel {
            min-height: 228px;
            padding-right: 1rem;
        }

        .skeleton-card {
            flex-basis: 160px;
            width: 160px;
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

    @keyframes skeleton-shimmer {
        0% {
            background-position: 100% 0;
        }

        100% {
            background-position: -100% 0;
        }
    }
</style>

<script lang="ts">
    import Icon from "@iconify/svelte";
    import { fade, fly, slide } from "svelte/transition";
    import { t, locale } from "svelte-i18n";
    import { onMount } from "svelte";
    import { marked } from "marked";

    // 📚 Type Definitions
    type TabType = "guide" | "notice";

    type Article = {
        id: string;
        titleKey: string;
        fileName: string; // MD file name (without extension)
        date?: string;
    };

    type Category = {
        id: string;
        titleKey: string;
        icon?: string;
        children?: Category[];
        articles?: Article[];
        isOpen?: boolean;
    };

    type Notice = {
        id: string;
        titleKey: string;
        descKey: string;
        date: string;
        tagKey: string;
        tagColor: string;
    };

    // 🗂️ Data Structure
    let currentTab: TabType = "guide";
    let isLangMenuOpen = false;

    // Load MD files eagerly as raw text
    const mdModules = import.meta.glob("./content/**/*.md", {
        as: "raw",
        eager: true,
    });

    // Guide Categories (Closed by default)
    let guideCategories: Category[] = [
        {
            id: "start",
            titleKey: "guide.categories.start",
            icon: "ph:rocket-launch-duotone",
            isOpen: true,
            children: [
                {
                    id: "start_intro",
                    titleKey: "guide.categories.start",
                    articles: [
                        {
                            id: "start_intro",
                            titleKey: "guide.articles.start_intro",
                            fileName: "start_intro",
                        },
                    ],
                },
            ],
        },
        {
            id: "account",
            titleKey: "guide.categories.account",
            icon: "ph:user-circle-duotone",
            isOpen: false,
            children: [
                {
                    id: "account_basic",
                    titleKey: "guide.categories.account",
                    articles: [
                        {
                            id: "acc_signup",
                            titleKey: "guide.articles.account_signup",
                            fileName: "account_signup",
                        },
                        {
                            id: "acc_login",
                            titleKey: "guide.articles.account_login",
                            fileName: "account_login",
                        },
                        {
                            id: "acc_mypage",
                            titleKey: "guide.articles.account_mypage",
                            fileName: "account_mypage",
                        },
                        {
                            id: "acc_noti",
                            titleKey: "guide.articles.account_noti",
                            fileName: "account_noti",
                        },
                        {
                            id: "acc_referral",
                            titleKey: "guide.articles.account_referral",
                            fileName: "account_referral",
                        },
                        {
                            id: "acc_leave",
                            titleKey: "guide.articles.account_leave",
                            fileName: "account_leave",
                        },
                    ],
                },
            ],
        },
        {
            id: "enjoy",
            titleKey: "guide.categories.enjoy",
            icon: "ph:game-controller-duotone",
            isOpen: false,
            children: [
                {
                    id: "enjoy_all",
                    titleKey: "guide.categories.enjoy",
                    articles: [
                        {
                            id: "enjoy_search",
                            titleKey: "guide.articles.enjoy_search",
                            fileName: "enjoy_search",
                        },
                        {
                            id: "enjoy_chat",
                            titleKey: "guide.articles.enjoy_chat",
                            fileName: "enjoy_chat",
                        },
                        {
                            id: "enjoy_options",
                            titleKey: "guide.articles.enjoy_options",
                            fileName: "enjoy_options",
                        },
                        {
                            id: "enjoy_summary",
                            titleKey: "guide.articles.enjoy_summary",
                            fileName: "enjoy_summary",
                        },
                        {
                            id: "enjoy_story",
                            titleKey: "guide.articles.enjoy_story",
                            fileName: "enjoy_story",
                        },
                    ],
                },
            ],
        },
        {
            id: "create",
            titleKey: "guide.categories.create",
            icon: "ph:paint-brush-duotone",
            isOpen: false,
            children: [
                {
                    id: "create_all",
                    titleKey: "guide.categories.create",
                    articles: [
                        {
                            id: "create_rules",
                            titleKey: "guide.articles.create_rules",
                            fileName: "create_rules",
                        },
                        {
                            id: "create_original",
                            titleKey: "guide.articles.create_original",
                            fileName: "create_original",
                        },
                        {
                            id: "create_incentive",
                            titleKey: "guide.articles.create_incentive",
                            fileName: "create_incentive",
                        },
                        {
                            id: "create_basic",
                            titleKey: "guide.articles.create_basic",
                            fileName: "create_basic",
                        },
                        {
                            id: "create_expert",
                            titleKey: "guide.articles.create_expert",
                            fileName: "create_expert",
                        },
                    ],
                },
            ],
        },
        {
            id: "payment",
            titleKey: "guide.categories.payment",
            icon: "ph:credit-card-duotone",
            isOpen: false,
            children: [
                {
                    id: "payment_all",
                    titleKey: "guide.categories.payment",
                    articles: [
                        {
                            id: "payment_guide",
                            titleKey: "guide.articles.payment_guide",
                            fileName: "payment_guide",
                        },
                        {
                            id: "payment_member",
                            titleKey: "guide.articles.payment_member",
                            fileName: "payment_member",
                        },
                        {
                            id: "payment_refund",
                            titleKey: "guide.articles.payment_refund",
                            fileName: "payment_refund",
                        },
                    ],
                },
            ],
        },
        {
            id: "policy",
            titleKey: "guide.categories.policy",
            icon: "ph:scroll-duotone",
            isOpen: false,
            children: [
                {
                    id: "policy_all",
                    titleKey: "guide.categories.policy",
                    articles: [
                        {
                            id: "policy_terms",
                            titleKey: "guide.articles.policy_terms",
                            fileName: "policy_terms",
                        },
                        {
                            id: "policy_privacy",
                            titleKey: "guide.articles.policy_privacy",
                            fileName: "policy_privacy",
                        },
                        {
                            id: "policy_marketing",
                            titleKey: "guide.articles.policy_marketing",
                            fileName: "policy_marketing",
                        },
                    ],
                },
            ],
        },
    ];

    // Notices List
    let notices: Notice[] = [
        {
            id: "n1",
            titleKey: "guide.notices.launch_title",
            descKey: "guide.notices.launch_desc",
            date: "2026.01.29",
            tagKey: "guide.tags.notice",
            tagColor: "bg-blue-500",
        },
        {
            id: "n2",
            titleKey: "guide.notices.event_title",
            descKey: "guide.notices.event_desc",
            date: "2026.01.29",
            tagKey: "guide.tags.event",
            tagColor: "bg-purple-500",
        },
        {
            id: "n3",
            titleKey: "guide.notices.maintenance_title",
            descKey: "guide.notices.maintenance_desc",
            date: "2026.01.30",
            tagKey: "guide.tags.maintenance",
            tagColor: "bg-orange-500",
        },
    ];

    let activeArticle: Article | null =
        guideCategories[0]?.children?.[0]?.articles?.[0] || null;
    let articleContentHtml = "";

    // Reactive Content Loader
    $: if (activeArticle && $locale) {
        loadArticleContent(activeArticle.fileName, $locale);
    }

    // Explicit function to load and parse markdown
    async function loadArticleContent(fileName: string, lang: string) {
        // Fallback to 'en' if 'ko' not found, or handle error
        // Construct path: ./content/[lang]/[fileName].md
        // Note: import.meta.glob keys are relative to this file
        const path = `./content/${lang}/${fileName}.md`;
        const fallbackPath = `./content/en/${fileName}.md`;

        let rawMd = mdModules[path];
        if (!rawMd && lang !== "en") {
            rawMd = mdModules[fallbackPath];
        }

        if (rawMd) {
            articleContentHtml = await marked.parse(rawMd);
        } else {
            articleContentHtml = "<p>Content is being prepared...</p>";
        }
    }

    // Interaction
    function selectArticle(article: Article) {
        activeArticle = article;
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function toggleCategory(cat: Category) {
        // Optionally close others? For now just toggle.
        cat.isOpen = !cat.isOpen;
        guideCategories = guideCategories;
    }

    function setTab(tab: TabType) {
        currentTab = tab;
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function setLanguage(lang: string) {
        locale.set(lang);
        isLangMenuOpen = false;
    }
</script>

<div
    class="guide-wrapper bg-background text-foreground transition-colors duration-300 min-h-screen flex flex-col"
>
    <!-- Header -->
    <header
        class="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
    >
        <div
            class="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8"
        >
            <!-- Added padding-left -->
            <div class="flex items-center gap-3 pl-8">
                <a href="/" class="flex items-center gap-2 group">
                    <div
                        class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-105"
                    >
                        <Icon icon="ph:book-open-text-duotone" width="18" />
                    </div>
                    <span
                        class="text-lg font-bold tracking-tight hidden sm:block"
                        >PersonaXi</span
                    >
                </a>
                <div class="h-4 w-px bg-border mx-2 hidden sm:block"></div>
                <h2 class="text-sm font-medium text-muted-foreground">
                    {$t("guide.pageTitle")}
                </h2>
            </div>

            <div class="flex items-center gap-4">
                <!-- Search -->
                <div
                    class="hidden md:flex items-center bg-muted/50 hover:bg-muted transition-colors rounded-full px-4 py-1.5 w-64 border border-transparent focus-within:border-primary/50 focus-within:bg-background focus-within:shadow-sm"
                >
                    <Icon
                        icon="ph:magnifying-glass"
                        class="text-muted-foreground mr-2"
                        width="16"
                    />
                    <input
                        type="text"
                        placeholder={$t("guide.searchPlaceholder")}
                        class="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground/70"
                    />
                </div>

                <!-- Lang Switch Dropdown -->
                <div class="relative">
                    <button
                        class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted/50"
                        on:click={() => (isLangMenuOpen = !isLangMenuOpen)}
                    >
                        <Icon icon="ph:translate" width="16" />
                        <span class="uppercase">{$locale}</span>
                        <Icon icon="ph:caret-down-bold" width="10" />
                    </button>

                    {#if isLangMenuOpen}
                        <div
                            class="absolute right-0 top-full mt-2 w-32 bg-card border border-border rounded-lg shadow-xl py-1 z-50 overflow-hidden"
                            transition:fly={{ y: -5, duration: 150 }}
                        >
                            <button
                                class="w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between {$locale ===
                                'ko'
                                    ? 'text-primary font-medium'
                                    : 'text-muted-foreground'}"
                                on:click={() => setLanguage("ko")}
                            >
                                <span>Korean</span>
                                {#if $locale === "ko"}<Icon
                                        icon="ph:check"
                                    />{/if}
                            </button>
                            <button
                                class="w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between {$locale ===
                                'en'
                                    ? 'text-primary font-medium'
                                    : 'text-muted-foreground'}"
                                on:click={() => setLanguage("en")}
                            >
                                <span>English</span>
                                {#if $locale === "en"}<Icon
                                        icon="ph:check"
                                    />{/if}
                            </button>
                        </div>
                        <!-- Backdrop to close -->
                        <div
                            class="fixed inset-0 z-40 bg-transparent"
                            on:click={() => (isLangMenuOpen = false)}
                        ></div>
                    {/if}
                </div>

                <!-- Home Link -->
                <a
                    href="/"
                    class="hidden sm:flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-full shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                    {$t("guide.homeButton")}
                    <Icon icon="ph:arrow-right-bold" />
                </a>
            </div>
        </div>
    </header>

    <!-- Main Container -->
    <div
        class="container mx-auto flex flex-col md:flex-row gap-8 px-4 sm:px-8 py-8 md:py-12 flex-1"
    >
        <!-- Sidebar -->
        <aside
            class="w-full md:w-64 flex-shrink-0 flex flex-col gap-6 md:sticky md:top-24 h-fit"
        >
            <!-- Mobile Tabs -->
            <div class="flex p-1 bg-muted rounded-xl md:hidden">
                <button
                    class="flex-1 py-2 rounded-lg text-sm font-medium transition-all {currentTab ===
                    'guide'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground'}"
                    on:click={() => setTab("guide")}
                >
                    {$t("guide.tabGuide")}
                </button>
                <button
                    class="flex-1 py-2 rounded-lg text-sm font-medium transition-all {currentTab ===
                    'notice'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground'}"
                    on:click={() => setTab("notice")}
                >
                    {$t("guide.tabNotice")}
                </button>
            </div>

            <!-- Desktop Navigation -->
            <nav class="hidden md:flex flex-col gap-1">
                <div
                    class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3"
                >
                    Menu
                </div>
                <button
                    class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group {currentTab ===
                    'guide'
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                    on:click={() => setTab("guide")}
                >
                    <Icon
                        icon="ph:book-bookmark-duotone"
                        width="18"
                        class="flex-shrink-0"
                    />
                    <span>{$t("guide.tabGuide")}</span>
                </button>
                <button
                    class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group {currentTab ===
                    'notice'
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                    on:click={() => setTab("notice")}
                >
                    <Icon
                        icon="ph:megaphone-simple-duotone"
                        width="18"
                        class="flex-shrink-0"
                    />
                    <span>{$t("guide.tabNotice")}</span>
                </button>
            </nav>

            <!-- Guide ToC -->
            {#if currentTab === "guide"}
                <div class="flex flex-col gap-1" in:slide>
                    <div
                        class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3 mt-4"
                    >
                        {$t("guide.guideListTitle")}
                    </div>
                    {#each guideCategories as cat}
                        <div class="flex flex-col">
                            <button
                                class="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors group"
                                on:click={() => toggleCategory(cat)}
                            >
                                <div class="flex items-center gap-2">
                                    {#if cat.icon}
                                        <div
                                            class="flex-shrink-0 w-5 flex justify-center"
                                        >
                                            <!-- Fixed width container for icon alignment -->
                                            <Icon
                                                icon={cat.icon}
                                                class="text-muted-foreground group-hover:text-primary transition-colors"
                                                width="16"
                                            />
                                        </div>
                                    {/if}
                                    <span>{$t(cat.titleKey)}</span>
                                </div>
                                <Icon
                                    icon="ph:caret-down"
                                    class="text-muted-foreground transition-transform duration-200 {cat.isOpen
                                        ? 'rotate-180'
                                        : ''}"
                                    width="12"
                                />
                            </button>

                            {#if cat.isOpen}
                                <div
                                    class="flex flex-col ml-3 pl-3 border-l border-border/50 py-1 gap-1"
                                    transition:slide|local
                                >
                                    {#if cat.children}
                                        {#each cat.children as sub}
                                            {#if sub.articles}
                                                {#each sub.articles as article}
                                                    <button
                                                        class="text-left px-2 py-1.5 rounded-md text-sm transition-colors {activeArticle?.id ===
                                                        article.id
                                                            ? 'bg-primary/5 text-primary font-medium'
                                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'}"
                                                        on:click={() =>
                                                            selectArticle(
                                                                article,
                                                            )}
                                                    >
                                                        {$t(article.titleKey)}
                                                    </button>
                                                {/each}
                                            {/if}
                                        {/each}
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </aside>

        <!-- Content Area -->
        <main class="flex-1 min-w-0 pb-12">
            {#if currentTab === "guide"}
                {#if activeArticle}
                    <article
                        in:fade={{ duration: 200, delay: 100 }}
                        class="max-w-3xl mx-auto"
                    >
                        <!-- Hero Banner (Conditional) -->
                        {#if activeArticle.id === "start_intro"}
                            <div
                                class="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden mb-8 shadow-sm group bg-black"
                            >
                                <div
                                    class="absolute inset-0 bg-gradient-to-br from-gray-900 to-black/80 z-10"
                                ></div>
                                <!-- Abstract Background Effect -->
                                <div
                                    class="absolute top-0 right-0 w-64 h-64 bg-primary/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"
                                ></div>
                                <div
                                    class="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"
                                ></div>

                                <div
                                    class="absolute inset-0 z-20 flex flex-col items-center justify-center text-white text-center px-4"
                                >
                                    <h1
                                        class="text-2xl md:text-3xl font-bold mb-2"
                                    >
                                        PersonaXi
                                    </h1>
                                    <p
                                        class="text-white/80 text-sm font-medium tracking-wide"
                                    >
                                        Digital Life Form Platform
                                    </p>
                                </div>
                            </div>
                        {/if}

                        <div
                            class="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-4"
                        >
                            <span
                                class="bg-muted px-2 py-0.5 rounded-full uppercase tracking-wider text-[10px]"
                                >Guide</span
                            >
                            <Icon icon="ph:caret-right" width="10" />
                            <span class="text-primary truncate"
                                >{$t(activeArticle.titleKey)}</span
                            >
                        </div>

                        <!-- Content Rendered from Markdown -->
                        <div
                            class="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl"
                        >
                            {@html articleContentHtml}
                        </div>
                    </article>
                {:else}
                    <div
                        class="flex flex-col items-center justify-center p-12 text-muted-foreground/50 border-2 border-dashed border-border rounded-xl"
                    >
                        <Icon
                            icon="ph:book-open-duotone"
                            width="48"
                            class="mb-4 opacity-50"
                        />
                        <p>{$t("guide.emptyState")}</p>
                    </div>
                {/if}
            {:else if currentTab === "notice"}
                <div
                    in:fade={{ duration: 200, delay: 100 }}
                    class="max-w-3xl mx-auto"
                >
                    <h2 class="text-2xl font-bold mb-6 text-foreground">
                        {$t("guide.noticeListTitle")}
                    </h2>
                    <div class="flex flex-col gap-4">
                        {#each notices as notice}
                            <div
                                class="group relative bg-card hover:bg-card/80 border border-border rounded-xl p-5 md:p-6 shadow-sm hover:shadow-md transition-all cursor-pointer"
                            >
                                <div
                                    class="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-3"
                                >
                                    <div class="flex items-center gap-2">
                                        <span
                                            class="{notice.tagColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                                        >
                                            {$t(notice.tagKey)}
                                        </span>
                                        <span
                                            class="text-xs text-muted-foreground font-mono"
                                            >{notice.date}</span
                                        >
                                    </div>
                                    <!-- Arrow Icon -->
                                    <div
                                        class="absolute top-6 right-6 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                                    >
                                        <Icon
                                            icon="ph:arrow-right"
                                            class="text-primary"
                                        />
                                    </div>
                                </div>
                                <h3
                                    class="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors"
                                >
                                    {$t(notice.titleKey)}
                                </h3>
                                <p
                                    class="text-sm text-muted-foreground leading-relaxed line-clamp-2"
                                >
                                    {$t(notice.descKey)}
                                </p>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </main>
    </div>
</div>

<style>
    /* Styling for the dropdown arrow rotation or other specific needs */
</style>

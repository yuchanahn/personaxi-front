<script lang="ts">
    import Icon from "@iconify/svelte";
    import { t, locale } from "svelte-i18n";
    import { slide } from "svelte/transition";
    import { marked } from "marked";
    import DOMPurify from "isomorphic-dompurify";

    // 📚 Type Definitions
    type TabType = "guide" | "notice";

    type Article = {
        id: string;
        titleKey: string;
        fileName: string;
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
        fileName: string;
    };

    // 🗂️ Data Structure
    let currentTab: TabType = "guide";
    let isLangMenuOpen = false;

    // Load MD files eagerly as raw text
    const mdModules = import.meta.glob("./content/**/*.md", {
        query: "?raw",
        import: "default",
        eager: true,
    });

    // Guide Categories
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
            fileName: "notice_launch",
        },
        {
            id: "n2",
            titleKey: "guide.notices.event_title",
            descKey: "guide.notices.event_desc",
            date: "2026.01.29",
            tagKey: "guide.tags.event",
            tagColor: "bg-purple-500",
            fileName: "notice_event",
        },
        {
            id: "n3",
            titleKey: "guide.notices.maintenance_title",
            descKey: "guide.notices.maintenance_desc",
            date: "2026.01.30",
            tagKey: "guide.tags.maintenance",
            tagColor: "bg-orange-500",
            fileName: "notice_maintenance",
        },
    ];

    let activeArticle: Article | null =
        guideCategories[0]?.children?.[0]?.articles?.[0] || null;
    let activeNotice: Notice | null = null;

    // Content state
    let articleContentHtml = "";
    let noticeContentHtml = "";

    let requestId = 0;

    // Reactive Content Loader (Centralized)
    $: if (currentTab && $locale) {
        // We watch dependencies. Inside we verify if we need to load.
        // This pattern ensures we don't have race conditions or infinite loops.
        const currentReqId = ++requestId;

        (async () => {
            if (currentTab === "guide" && activeArticle) {
                // Pre-clear to avoid content mismatch during load, or keep old content?
                // User asked for no duplication, clearing is safer visually for "loading" state.
                articleContentHtml = "";
                const html = await loadContent(activeArticle.fileName, $locale);
                if (currentReqId === requestId) {
                    articleContentHtml = DOMPurify.sanitize(html);
                }
            } else if (currentTab === "notice" && activeNotice) {
                noticeContentHtml = "";
                const html = await loadContent(activeNotice.fileName, $locale);
                if (currentReqId === requestId) {
                    noticeContentHtml = DOMPurify.sanitize(html);
                }
            }
        })();
    }

    // Generic Content Loader
    async function loadContent(
        fileName: string,
        lang: string,
    ): Promise<string> {
        const path = `./content/${lang}/${fileName}.md`;
        const fallbackPath = `./content/en/${fileName}.md`;

        const rawMd =
            mdModules[path] || (lang !== "en" ? mdModules[fallbackPath] : null);

        if (typeof rawMd === "string") {
            return await marked.parse(rawMd);
        } else {
            return `<div class="p-8 text-center text-muted-foreground bg-muted/20 rounded-xl my-8">
                <p class="font-medium">Content is being prepared...</p>
                <p class="text-xs mt-2 opacity-50">(${fileName})</p>
            </div>`;
        }
    }

    // Interaction Handlers - STATE CHANGE ONLY
    function selectArticle(article: Article) {
        if (activeArticle?.id === article.id) return;
        activeArticle = article;
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function selectNotice(notice: Notice) {
        if (activeNotice?.id === notice.id) return;
        activeNotice = notice;
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function backToNoticeList() {
        activeNotice = null;
    }

    function toggleCategory(cat: Category) {
        cat.isOpen = !cat.isOpen;
        guideCategories = guideCategories;
    }

    function setTab(tab: TabType) {
        if (currentTab === tab) return;
        currentTab = tab;
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function setLanguage(lang: string) {
        locale.set(lang);
        isLangMenuOpen = false;
    }
</script>

<div
    class="guide-wrapper bg-background text-foreground min-h-screen flex flex-col"
>
    <!-- Header -->
    <header
        class="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md"
    >
        <div
            class="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8"
        >
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
                <!-- Search (Visual Only) -->
                <div
                    class="hidden md:flex items-center bg-muted/50 hover:bg-muted transition-colors rounded-full px-4 py-1.5 w-64 border border-transparent focus-within:border-primary/50 focus-within:bg-background"
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

                <!-- Lang Switch -->
                <div class="relative">
                    <button
                        class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted/50"
                        on:click={() => (isLangMenuOpen = !isLangMenuOpen)}
                    >
                        <Icon icon="ph:translate" width="16" />
                        <span class="uppercase">{$locale}</span>
                    </button>
                    {#if isLangMenuOpen}
                        <div
                            class="absolute right-0 top-full mt-2 w-32 bg-card border border-border rounded-lg shadow-xl py-1 z-50 overflow-hidden"
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
                        <div
                            class="fixed inset-0 z-40 bg-transparent"
                            on:click={() => (isLangMenuOpen = false)}
                        ></div>
                    {/if}
                </div>

                <a
                    href="/"
                    class="hidden sm:flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-full shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                    {$t("guide.homeButton")}
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

            {#if currentTab === "guide"}
                <div class="flex flex-col gap-1">
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
                                    {#if cat.icon}<Icon
                                            icon={cat.icon}
                                            class="text-muted-foreground group-hover:text-primary transition-colors"
                                            width="16"
                                        />{/if}
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
                                    {#if cat.children}{#each cat.children as sub}{#if sub.articles}{#each sub.articles as article}
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
                                                {/each}{/if}{/each}{/if}
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
                    {#key activeArticle.id}
                        <article class="max-w-3xl mx-auto min-h-[50vh]">
                            <!-- Hero Banner (Conditional) -->
                            {#if activeArticle.id === "start_intro"}
                                <div
                                    class="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden mb-8 shadow-sm group bg-black"
                                >
                                    <div
                                        class="absolute inset-0 bg-gradient-to-br from-gray-900 to-black/80 z-10"
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

                            <div
                                class="markdown-content prose prose-neutral dark:prose-invert max-w-none min-h-[200px]"
                            >
                                {#if articleContentHtml}
                                    {@html articleContentHtml}
                                {:else}
                                    <div class="space-y-4 animate-pulse mt-8">
                                        <div
                                            class="h-8 bg-muted rounded w-3/4"
                                        ></div>
                                        <div
                                            class="h-4 bg-muted rounded w-full"
                                        ></div>
                                        <div
                                            class="h-4 bg-muted rounded w-2/3"
                                        ></div>
                                    </div>
                                {/if}
                            </div>
                        </article>
                    {/key}
                {/if}
            {:else if currentTab === "notice"}
                {#if !activeNotice}
                    <div class="max-w-3xl mx-auto">
                        <h2 class="text-2xl font-bold mb-6 text-foreground">
                            {$t("guide.noticeListTitle")}
                        </h2>
                        <div class="flex flex-col gap-4">
                            {#each notices as notice}
                                <button
                                    class="w-full text-left group bg-card hover:bg-card/80 border border-border rounded-xl p-5 cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-primary"
                                    on:click={() => selectNotice(notice)}
                                >
                                    <div class="flex justify-between mb-3">
                                        <div class="flex items-center gap-2">
                                            <span
                                                class="{notice.tagColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                                                >{$t(notice.tagKey)}</span
                                            >
                                            <span
                                                class="text-xs text-muted-foreground font-mono"
                                                >{notice.date}</span
                                            >
                                        </div>
                                    </div>
                                    <h3
                                        class="text-lg font-bold text-foreground mb-2 group-hover:text-primary"
                                    >
                                        {$t(notice.titleKey)}
                                    </h3>
                                    <p
                                        class="text-sm text-muted-foreground line-clamp-2"
                                    >
                                        {$t(notice.descKey)}
                                    </p>
                                </button>
                            {/each}
                        </div>
                    </div>
                {:else}
                    {#key activeNotice.id}
                        <article class="max-w-3xl mx-auto min-h-[50vh]">
                            <button
                                class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
                                on:click={backToNoticeList}
                            >
                                <Icon icon="ph:arrow-left" />
                                <span>{$t("guide.noticeListTitle")}</span>
                            </button>
                            <header class="mb-8 border-b border-border/50 pb-6">
                                <span
                                    class="{activeNotice.tagColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                                    >{$t(activeNotice.tagKey)}</span
                                >
                                <h1
                                    class="text-3xl font-bold text-foreground mt-3"
                                >
                                    {$t(activeNotice.titleKey)}
                                </h1>
                                <span
                                    class="text-sm text-muted-foreground font-mono mt-2 block"
                                    >{activeNotice.date}</span
                                >
                            </header>
                            <div
                                class="markdown-content prose prose-neutral dark:prose-invert max-w-none min-h-[200px]"
                            >
                                {#if noticeContentHtml}
                                    {@html noticeContentHtml}
                                {:else}
                                    <div class="space-y-4 animate-pulse mt-8">
                                        <div
                                            class="h-8 bg-muted rounded w-3/4"
                                        ></div>
                                        <div
                                            class="h-4 bg-muted rounded w-full"
                                        ></div>
                                    </div>
                                {/if}
                            </div>
                        </article>
                    {/key}
                {/if}
            {/if}
        </main>
    </div>
</div>

<style>
    /* Robust Typography Overrides */
    .markdown-content :global(h1) {
        font-size: 2.25rem;
        font-weight: 800;
        margin-bottom: 1.5rem;
        color: var(--foreground);
    }
    .markdown-content :global(h2) {
        font-size: 1.75rem;
        font-weight: 700;
        margin-top: 2.5rem;
        margin-bottom: 1rem;
        color: var(--foreground);
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.5rem;
    }
    .markdown-content :global(h3) {
        font-size: 1.35rem;
        font-weight: 600;
        margin-top: 1.75rem;
        margin-bottom: 0.75rem;
        color: var(--foreground);
    }
    .markdown-content :global(p) {
        font-size: 1rem;
        line-height: 1.8;
        margin-bottom: 1.25rem;
        color: var(--muted-foreground);
    }
    .markdown-content :global(ul),
    .markdown-content :global(ol) {
        margin-bottom: 1.5rem;
        padding-left: 1.5rem;
    }
    .markdown-content :global(li) {
        color: var(--muted-foreground);
        margin-bottom: 0.5rem;
    }
    .markdown-content :global(li::marker) {
        color: var(--muted-foreground);
    }
    .markdown-content :global(strong) {
        color: var(--foreground);
        font-weight: 600;
    }
    .markdown-content :global(hr) {
        margin: 2.5rem 0;
        border-color: var(--border);
    }
</style>

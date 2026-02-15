<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { fetchAndSetAssetTypes, loadPersona } from "$lib/api/edit_persona";
    import type { Persona, ImageMetadata, Comment } from "$lib/types";
    import { PORTRAIT_URL, allCategories } from "$lib/constants";
    import Icon from "@iconify/svelte";
    import { LikeBtn, loadlikesdata } from "$lib/api/content";
    import { t } from "svelte-i18n";
    import { api } from "$lib/api";
    import { settings } from "$lib/stores/settings";
    import { get } from "svelte/store";
    import { chatSessions } from "$lib/stores/chatSessions";
    import AssetPreview from "$lib/components/AssetPreview.svelte";
    import { slide } from "svelte/transition";
    import { st_user } from "$lib/stores/user";
    import { toast } from "$lib/stores/toast";
    import ReportModal from "$lib/components/modal/ReportModal.svelte";

    let persona: Persona | null = null;
    let comments: Comment[] = [];
    let isLoading = true;
    let newCommentText = "";
    let showFirstScene = false;
    let showReportModal = false;

    let galleryImages: ImageMetadata[] = [];
    let currentImageIndex = 0;

    async function loadComments(personaId: string): Promise<Comment[]> {
        const response = await api.get2(`/api/comments?personaId=${personaId}`);
        if (!response.ok) {
            console.error("Failed to load comments");
            return [];
        }
        return await response.json();
    }

    async function handlePostComment() {
        if (!newCommentText.trim() || !persona) return;

        try {
            const response = await api.post("/api/comments/create", {
                personaId: persona.id,
                content: newCommentText,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to post comment");
            }

            const newComment: Comment = await response.json();

            comments = [...comments, newComment];
            newCommentText = ""; // 입력창 초기화
        } catch (err) {
            console.error("Error posting comment:", err);
            toast.error($t("profilePage.commentPostFailed"));
        }
    }

    function goToCreatorPage(event: MouseEvent) {
        event.stopPropagation();
        if (persona?.owner_id) {
            goto(`/creator?c=${persona.owner_id}`);
        }
    }

    function formatTimestamp(timestamp: string): string {
        const now = new Date();
        const date = new Date(timestamp);
        const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
        const diffMinutes = Math.round(diffSeconds / 60);
        const diffHours = Math.round(diffMinutes / 60);
        const diffDays = Math.round(diffHours / 24);

        if (diffSeconds < 60) return $t("time.now");
        if (diffMinutes < 60)
            return $t("time.minutesAgo", { values: { count: diffMinutes } });
        if (diffHours < 24)
            return $t("time.hoursAgo", { values: { count: diffHours } });
        if (diffDays <= 7)
            return $t("time.daysAgo", { values: { count: diffDays } });

        return date.toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }

    onMount(async () => {
        const personaId = $page.url.searchParams.get("c");
        if (!personaId) {
            isLoading = false;
            return;
        }

        try {
            const [p, c, likes] = await Promise.all([
                loadPersona(personaId),
                loadComments(personaId),
                loadlikesdata(),
            ]);
            persona = p;

            if (likes) {
                (likes as string[]).forEach((like) => {
                    if (like === p.id) {
                        p.is_liked = true;
                    }
                });
            }

            comments = c;

            if (persona === null) throw "persona === null";

            let images: ImageMetadata[] = [];
            images.push({
                url: persona.portrait_url,
                description: $t("profilePage.defaultProfile"),
            });

            if (persona.image_metadatas && persona.image_metadatas.length > 0) {
                images = [...images, ...persona.image_metadatas];
            }
            galleryImages = images;

            fetchAndSetAssetTypes(images).then((imgs) => {
                galleryImages = imgs;
            });
        } catch (error) {
            console.error("Failed to load persona data:", error);
        } finally {
            isLoading = false;
        }
    });

    function handleStartChat() {
        // Default to Flash-Lite
        let llmType = "gemini-flash-lite";

        // Check if user has a saved preference for this session
        chatSessions.update((sessions) => {
            const existingSession = sessions.find(
                (session) => session.id === persona?.id,
            );
            if (existingSession && existingSession.llmType) {
                llmType = existingSession.llmType;
            }
            return sessions;
        });

        // Force Flash-Lite for 3D/Live2D modes (override saved preference)
        if (persona?.personaType === "3D" || persona?.personaType === "2.5D") {
            llmType = "gemini-flash-lite";
        }

        if (persona?.personaType === "2D" || persona?.personaType === "2d") {
            goto(`/2d?c=${persona.id}&llmType=${llmType}`);
        } else if (persona?.personaType === "3D") {
            goto(`/character?c=${persona.id}&llmType=${llmType}`);
        } else if (persona?.personaType === "2.5D") {
            goto(`/live2d?c=${persona.id}&llmType=${llmType}`);
        } else {
            toast.error(`Unknown Persona Type: ${persona?.personaType}`);
        }
    }

    async function handleLike(p: Persona) {
        if (!p || !p.id) return;

        const newLikeStatus = !p.is_liked;
        const endpoint = newLikeStatus ? "like" : "dislike";
        const url = `/api/persona/${endpoint}?id=${p.id}`;

        try {
            const res = await api.get(url);

            if (res.ok) {
                if (persona && persona.id === p.id) {
                    persona = {
                        ...persona,
                        is_liked: newLikeStatus,
                        likes_count:
                            persona.likes_count + (newLikeStatus ? 1 : -1),
                    };
                }
            } else {
                const errorText = await res.text();
                toast.error(
                    $t("profilePage.likeFailed", {
                        values: { message: errorText },
                    }),
                );
            }
        } catch (error) {
            console.error("Like toggle failed:", error);
            toast.error(
                $t("profilePage.likeFailed", {
                    values: { message: "Network error" },
                }),
            );
        }
    }

    async function handleShare() {
        if (!persona || !persona.id) return;

        const shareUrl = `${window.location.origin}/profile?c=${persona.id}`;

        try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success(
                $t("profilePage.linkCopied") || "Link copied to clipboard!",
            );
        } catch (err) {
            console.error("Failed to copy link:", err);
            toast.error(
                $t("profilePage.linkCopyFailed") || "Failed to copy link.",
            );
        }
    }

    function showPrevImage() {
        currentImageIndex =
            (currentImageIndex - 1 + galleryImages.length) %
            galleryImages.length;
    }
    function showNextImage() {
        currentImageIndex = (currentImageIndex + 1) % galleryImages.length;
    }
    function goToImage(index: number) {
        currentImageIndex = index;
    }

    function replaceNicknameInText(text: string): string {
        if (!persona) return text;
        return text
            .replaceAll("{{user}}", get(st_user)?.data?.nickname || "User")
            .replaceAll("{{char}}", persona.name || "Character");
    }

    interface ThreeDSceneData {
        mem_list?: string; // 기억/서사 (가장 중요)
        current_emotion?: string; // 현재 감정
        personality?: string; // 성격
        core_desire?: string; // 핵심 욕구
        contradiction?: string; // 모순
        values?: string; // 가치관
    }

    function tryParse3DScene(jsonString: string): ThreeDSceneData | null {
        try {
            const parsed = JSON.parse(jsonString);
            if (parsed && typeof parsed === "object") {
                return parsed as ThreeDSceneData;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    let threeDSceneData: ThreeDSceneData | null = null;

    $: if (
        persona &&
        (persona.personaType === "3D" || persona.personaType === "2.5D") &&
        persona.first_scene
    ) {
        threeDSceneData = tryParse3DScene(persona.first_scene);
        showFirstScene = true; // 3D/2.5D는 바로 보여줌
    } else {
        threeDSceneData = null;
    }

    function formatSceneText(text: string): string {
        if (!text) return "";

        let formatted = text;
        formatted = formatted.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

        if (persona) {
            formatted = formatted
                .replaceAll("{{user}}", get(st_user)?.data?.nickname || "User")
                .replaceAll("{{char}}", persona.name || "Character");
        }

        formatted = formatted.replace(
            /<dialogue[^>]*>(.*?)<\/dialogue>/gs,
            '"$1"',
        );

        formatted = formatted.replace(/<br\s*\/?>/gi, "\n");

        formatted = formatted.replace(/<[^>]+>/g, "");

        return formatted.trim();
    }

    function getTagName(tagId: string | number): string {
        const id = typeof tagId === "string" ? parseInt(tagId, 10) : tagId;
        const category = allCategories.find((c) => c.id === id);
        return category ? $t(category.nameKey) : String(tagId);
    }

    // ── UI Helpers ──
    $: personaTypeLabel =
        persona?.personaType === "3D"
            ? "VRM"
            : persona?.personaType === "2.5D"
              ? "Live2D"
              : persona?.personaType === "2D"
                ? "2D"
                : "";

    $: personaTypeIcon =
        persona?.personaType === "3D"
            ? "ph:cube-duotone"
            : persona?.personaType === "2.5D"
              ? "ph:monitor-play-duotone"
              : "ph:image-duotone";

    $: categoryTags =
        persona?.tags?.filter((t: string) => parseInt(t) < 1000) || [];
    $: regularTags =
        persona?.tags?.filter((t: string) => parseInt(t) >= 1000) || [];
</script>

<svelte:head>
    {#if persona}
        <title>{persona.name} - PersonaXi</title>
        <meta
            name="description"
            content={persona.one_liner ||
                persona.greeting ||
                $t("profilePage.defaultDescription", {
                    values: { name: persona.name },
                })}
        />
        <meta property="og:title" content="{persona.name} - PersonaXi" />
        <meta
            property="og:description"
            content={persona.one_liner ||
                persona.greeting ||
                $t("profilePage.defaultDescription", {
                    values: { name: persona.name },
                })}
        />
        <meta
            property="og:image"
            content={persona.portrait_url ||
                "https://personaxi.com/og-image.png"}
        />
        <meta
            property="og:url"
            content="https://personaxi.com/profile?c={persona.id}"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="{persona.name} - PersonaXi" />
        <meta
            name="twitter:image"
            content={persona.portrait_url ||
                "https://personaxi.com/og-image.png"}
        />
    {:else}
        <title>페르소나 - PersonaXi</title>
    {/if}
</svelte:head>

<div class="scroll-container select-none">
    <div class="profile-page-wrapper">
        {#if isLoading}
            <p class="loading-text">{$t("profilePage.loadingPersona")}</p>
        {:else if persona}
            <div class="profile-container">
                <!-- ═══ Hero Section ═══ -->
                <section class="hero-section">
                    <!-- Gallery -->
                    <div class="hero-gallery">
                        <div class="image-gallery-wrapper">
                            {#if galleryImages.length > 0}
                                <AssetPreview
                                    asset={galleryImages[currentImageIndex]}
                                />
                                {#if galleryImages[currentImageIndex].is_secret && galleryImages[currentImageIndex].url}
                                    <div class="secret-indicator">
                                        <Icon icon="ph:lock-key-open-bold" />
                                        <span
                                            >{$t(
                                                "profilePage.secretAssetLabel",
                                            ) || "Secret"}</span
                                        >
                                    </div>
                                {/if}
                                {#if galleryImages.length > 1}
                                    <div class="image-counter">
                                        <Icon icon="ph:images-duotone" />
                                        <span
                                            >{currentImageIndex + 1} / {galleryImages.length}</span
                                        >
                                    </div>
                                    <button
                                        class="nav-arrow left"
                                        on:click|stopPropagation={showPrevImage}
                                    >
                                        <Icon icon="ph:caret-left-bold" />
                                    </button>
                                    <button
                                        class="nav-arrow right"
                                        on:click|stopPropagation={showNextImage}
                                    >
                                        <Icon icon="ph:caret-right-bold" />
                                    </button>
                                {/if}
                            {/if}
                        </div>
                        <!-- Thumbnail Strip -->
                        {#if galleryImages.length > 1}
                            <div class="thumbnail-strip">
                                {#each galleryImages as img, i}
                                    <button
                                        class="thumb"
                                        class:active={i === currentImageIndex}
                                        on:click|stopPropagation={() =>
                                            goToImage(i)}
                                    >
                                        <div class="thumb-content">
                                            <AssetPreview asset={img} />
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>

                    <!-- Hero Info -->
                    <div class="hero-info">
                        <!-- Type Badge -->
                        {#if personaTypeLabel}
                            <div class="type-badge">
                                <Icon icon={personaTypeIcon} width="16" />
                                <span>{personaTypeLabel}</span>
                            </div>
                        {/if}

                        <h1 class="character-name">{persona.name}</h1>

                        {#if persona.one_liner}
                            <p class="one-liner">{persona.one_liner}</p>
                        {/if}

                        {#if persona.creator_name}
                            <button
                                class="creator-chip"
                                on:click={goToCreatorPage}
                                aria-label={$t(
                                    "profilePage.goToCreatorProfile",
                                    {
                                        values: {
                                            creatorName: persona.creator_name,
                                        },
                                    },
                                )}
                            >
                                <Icon icon="ph:user-circle-duotone" />
                                <span
                                    >{$t("profilePage.creatorInfo", {
                                        values: {
                                            creatorName: persona.creator_name,
                                        },
                                    })}</span
                                >
                                <Icon icon="ph:arrow-right-bold" />
                            </button>
                        {/if}

                        <p class="character-description">
                            {persona.greeting === "<tr>"
                                ? $t("profilePage.translating")
                                : replaceNicknameInText(
                                      persona.greeting ||
                                          $t("profilePage.defaultGreeting"),
                                  )}
                        </p>

                        <!-- Tags -->
                        <div class="tags-container">
                            {#each categoryTags as tag}
                                <span class="tag tag-category"
                                    >{getTagName(tag)}</span
                                >
                            {/each}
                            {#each regularTags as tag}
                                <span class="tag tag-regular"
                                    >{getTagName(tag)}</span
                                >
                            {/each}
                        </div>

                        <!-- Stats Row -->
                        <div class="stats-row">
                            <button
                                class="stat-chip"
                                on:click={() => {
                                    if (persona) handleLike(persona);
                                }}
                                aria-label={$t("profilePage.likeButtonLabel")}
                            >
                                <Icon
                                    icon={persona.is_liked
                                        ? "ph:heart-fill"
                                        : "ph:heart-bold"}
                                    style={persona.is_liked
                                        ? "color: var(--color-emotion, #ff79c6);"
                                        : ""}
                                />
                                <span>{persona.likes_count}</span>
                            </button>
                            <div
                                class="stat-chip"
                                title={$t("profilePage.interactionLabel")}
                            >
                                <Icon icon="ph:chat-circle-dots-bold" />
                                <span>{persona.chat_count}</span>
                            </div>
                            {#if galleryImages.length > 1}
                                <div class="stat-chip">
                                    <Icon icon="ph:image-square-bold" />
                                    <span>{galleryImages.length}</span>
                                </div>
                            {/if}
                        </div>

                        <!-- CTA + Actions -->
                        <div class="cta-row">
                            <button
                                class="chat-start-button"
                                on:click={handleStartChat}
                            >
                                <Icon
                                    icon="ph:chat-circle-dots-duotone"
                                    width="22"
                                />
                                <span>{$t("profilePage.startChatButton")}</span>
                            </button>
                            <div class="action-buttons">
                                <button
                                    class="action-btn"
                                    on:click={handleShare}
                                    title={$t("settingModal.share") || "Share"}
                                >
                                    <Icon
                                        icon="ph:share-network-bold"
                                        width="20"
                                    />
                                </button>
                                <button
                                    class="action-btn destructive"
                                    on:click={() => (showReportModal = true)}
                                    title={$t("settingModal.report") ||
                                        "Report"}
                                >
                                    <Icon icon="ph:flag-bold" width="20" />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- ═══ Detail Section ═══ -->
                <section class="detail-section">
                    <!-- First Scene (Accordion) -->
                    {#if persona.first_scene}
                        <div class="first-scene-container">
                            <button
                                class="scene-toggle"
                                on:click={() =>
                                    (showFirstScene = !showFirstScene)}
                            >
                                <div class="scene-toggle-left">
                                    <Icon
                                        icon={threeDSceneData
                                            ? "ph:cpu-duotone"
                                            : "ph:scroll-duotone"}
                                    />
                                    <span>
                                        {threeDSceneData
                                            ? $t("profilePage.characterIntel")
                                            : $t("profilePage.firstSceneTitle")}
                                    </span>
                                </div>
                                <Icon
                                    icon={showFirstScene
                                        ? "ph:caret-up-bold"
                                        : "ph:caret-down-bold"}
                                    width="18"
                                />
                            </button>

                            {#if showFirstScene}
                                <div
                                    class="scene-body"
                                    transition:slide={{
                                        duration: 250,
                                        axis: "y",
                                    }}
                                >
                                    {#if threeDSceneData}
                                        <div class="threed-data-wrapper">
                                            <div class="threed-chips">
                                                {#if threeDSceneData.current_emotion}
                                                    <div
                                                        class="data-chip emotion"
                                                    >
                                                        <span class="chip-label"
                                                            ><Icon
                                                                icon="ph:smiley-duotone"
                                                            /> 감정</span
                                                        >
                                                        <span class="chip-value"
                                                            >{threeDSceneData.current_emotion}</span
                                                        >
                                                    </div>
                                                {/if}
                                                {#if threeDSceneData.core_desire}
                                                    <div
                                                        class="data-chip desire"
                                                    >
                                                        <span class="chip-label"
                                                            ><Icon
                                                                icon="ph:target-duotone"
                                                            /> 욕구</span
                                                        >
                                                        <span class="chip-value"
                                                            >{threeDSceneData.core_desire}</span
                                                        >
                                                    </div>
                                                {/if}
                                                {#if threeDSceneData.personality}
                                                    <div
                                                        class="data-chip personality"
                                                    >
                                                        <span class="chip-label"
                                                            ><Icon
                                                                icon="ph:fingerprint-duotone"
                                                            /> 성격</span
                                                        >
                                                        <span class="chip-value"
                                                            >{threeDSceneData.personality}</span
                                                        >
                                                    </div>
                                                {/if}
                                            </div>

                                            {#if threeDSceneData.mem_list}
                                                <div class="threed-narrative">
                                                    <p class="scene-text">
                                                        {@html replaceNicknameInText(
                                                            threeDSceneData.mem_list,
                                                        ).replaceAll(
                                                            "\n",
                                                            "<br/>",
                                                        )}
                                                    </p>
                                                </div>
                                            {/if}
                                        </div>
                                    {:else if persona.first_scene === "<tr>"}
                                        <p class="scene-text">
                                            {$t("profilePage.translating")}
                                        </p>
                                    {:else}
                                        <p class="scene-text">
                                            {replaceNicknameInText(
                                                formatSceneText(
                                                    persona.first_scene,
                                                ),
                                            )}
                                        </p>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/if}

                    <!-- Comments -->
                    <div class="comments-section">
                        <h2 class="comments-title">
                            {$t("profilePage.commentsTitle", {
                                values: { count: comments.length },
                            })}
                        </h2>
                        <div class="comments-list">
                            {#each comments as comment (comment.id)}
                                <div class="comment-card">
                                    <img
                                        src={comment.author_avatar_url ||
                                            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(comment.author_name)}`}
                                        alt={comment.author_name}
                                        class="comment-avatar"
                                    />
                                    <div class="comment-content">
                                        <div class="comment-header">
                                            <span class="comment-author"
                                                >{comment.author_name}</span
                                            >
                                            <span class="comment-timestamp"
                                                >{formatTimestamp(
                                                    comment.created_at,
                                                )}</span
                                            >
                                        </div>
                                        <p class="comment-text">
                                            {comment.content}
                                        </p>
                                    </div>
                                </div>
                            {:else}
                                <p class="no-comments">
                                    {$t("profilePage.noComments")}
                                </p>
                            {/each}
                        </div>
                        <div class="comment-input-box">
                            <input
                                type="text"
                                bind:value={newCommentText}
                                on:keydown={(e) =>
                                    e.key === "Enter" && handlePostComment()}
                                placeholder={$t(
                                    "profilePage.commentPlaceholder",
                                )}
                            />
                            <button
                                class="btn-primary icon-button"
                                on:click={handlePostComment}
                                aria-label={$t("profilePage.registerButton")}
                            >
                                <Icon icon="ph:paper-plane-tilt-bold" />
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        {:else}
            <p class="error-text">{$t("profilePage.personaNotFound")}</p>
        {/if}
    </div>

    {#if showReportModal && persona}
        <ReportModal
            personaId={persona.id}
            personaName={persona.name}
            on:close={() => (showReportModal = false)}
        />
    {/if}
</div>

<style>
    .profile-page-wrapper {
        background-color: var(--background);
        color: var(--foreground);
        height: 100%;
        padding: 2rem;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        overflow-y: auto;
        overflow-x: hidden; /* Prevent horizontal scroll */
    }

    .scroll-container {
        height: 100%;
        background-color: var(--background);
    }

    .loading-text,
    .error-text {
        font-size: 1.2rem;
        color: var(--muted-foreground);
        text-align: center;
        margin-top: 5rem;
    }

    /* ── Main Container ── */
    .profile-container {
        width: 100%;
        max-width: 1100px;
        display: flex;
        flex-direction: column;
        gap: 2.5rem;
        padding-bottom: 4rem;
    }

    /* ── Hero Section ── */
    .hero-section {
        display: grid;
        grid-template-columns: 400px 1fr;
        gap: 3rem;
        align-items: start;
    }

    /* Left: Gallery */
    .hero-gallery {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-width: 0; /* Prevent grid blowout */
    }

    .image-gallery-wrapper {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1; /* Square portrait */
        border-radius: var(--radius-card-lg);
        overflow: hidden;
        background-color: var(--card);
        border: 1px solid var(--border);
        box-shadow: 0 4px 20px -5px rgba(0, 0, 0, 0.1);
    }

    .image-counter {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.75rem;
        color: white;
        background-color: rgba(0, 0, 0, 0.6);
        padding: 0.25rem 0.6rem;
        border-radius: 999px;
        font-weight: 600;
        backdrop-filter: blur(4px);
        z-index: 10;
    }

    .secret-indicator {
        position: absolute;
        top: 12px;
        left: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        background-color: rgba(0, 0, 0, 0.7);
        color: #fbbf24;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 600;
        z-index: 10;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(251, 191, 36, 0.3);
    }

    .nav-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background-color: rgba(0, 0, 0, 0.5);
        color: white;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        z-index: 10;
        opacity: 0; /* Show on hover */
    }
    .image-gallery-wrapper:hover .nav-arrow {
        opacity: 1;
    }
    .nav-arrow:hover {
        background-color: rgba(0, 0, 0, 0.8);
        transform: translateY(-50%) scale(1.1);
    }
    .nav-arrow.left {
        left: 12px;
    }
    .nav-arrow.right {
        right: 12px;
    }

    .indicator-dots {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 6px;
        z-index: 10;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 10px;
        backdrop-filter: blur(2px);
    }
    .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.4);
        border: none;
        padding: 0;
        cursor: pointer;
        transition: all 0.2s;
    }
    .dot:hover {
        background-color: rgba(255, 255, 255, 0.8);
    }
    .dot.active {
        background-color: white;
        transform: scale(1.2);
    }

    /* Thumbnail Strip */
    .thumbnail-strip {
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
        padding-top: 4px; /* Space for active transform */
        padding-bottom: 4px;
        scrollbar-width: thin;
        scrollbar-color: var(--border) transparent;
    }
    .thumbnail-strip::-webkit-scrollbar {
        height: 4px;
    }
    .thumbnail-strip::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 4px;
    }
    .thumb {
        width: 60px;
        height: 60px;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid transparent;
        cursor: pointer;
        flex-shrink: 0;
        padding: 0;
        background: var(--muted);
        transition: all 0.2s;
        position: relative;
    }

    .thumb.active {
        border-color: var(--primary);
        transform: translateY(-2px);
    }
    .thumb:hover:not(.active) {
        border-color: var(--border-hover);
    }
    .thumb-content {
        width: 100%;
        height: 100%;
        pointer-events: none; /* Let button handle clicks */
    }

    /* Right: Hero Info */
    .hero-info {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding-top: 1rem;
    }

    .type-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--muted);
        color: var(--foreground);
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        align-self: flex-start;
        margin-bottom: 0.8rem;
        border: 1px solid var(--border);
    }

    .character-name {
        font-size: 2.8rem;
        font-weight: 800;
        color: var(--foreground);
        margin: 0 0 0.5rem 0;
        line-height: 1.1;
        letter-spacing: -0.02em;
        word-break: keep-all; /* Better Korean wrapping */
        overflow-wrap: anywhere; /* Prevent overflow */
    }

    .one-liner {
        font-size: 1.1rem;
        color: var(--foreground);
        opacity: 0.9;
        margin-bottom: 1rem;
        font-weight: 500;
    }

    .creator-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: transparent;
        border: none;
        padding: 0;
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--muted-foreground);
        cursor: pointer;
        margin-bottom: 1.5rem;
        transition: color 0.2s;
        align-self: flex-start;
    }
    .creator-chip:hover {
        color: var(--foreground);
        text-decoration: underline;
    }

    .character-description {
        font-size: 1rem;
        line-height: 1.6;
        color: var(--muted-foreground);
        margin-bottom: 1.5rem;
        /* max-width: 600px; */
    }

    .tags-container {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 2rem;
    }
    .tag {
        padding: 0.3rem 0.8rem;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 500;
        transition: all 0.2s;
    }
    .tag-category {
        background-color: hsla(var(--primary-hsl), 0.1);
        color: var(--primary);
        border: 1px solid hsla(var(--primary-hsl), 0.2);
    }
    .tag-regular {
        background-color: var(--muted);
        color: var(--muted-foreground);
        border: 1px solid var(--border);
    }

    /* Stats Row */
    .stats-row {
        display: flex;
        gap: 0.8rem;
        margin-bottom: 2rem;
    }
    .stat-chip {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        background: var(--card);
        border: 1px solid var(--border);
        padding: 0.5rem 0.9rem;
        border-radius: 10px;
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--foreground);
        transition: all 0.2s;
        cursor: default;
    }
    button.stat-chip {
        cursor: pointer;
    }
    button.stat-chip:hover {
        background: var(--muted);
        transform: translateY(-1px);
    }
    .stat-chip :global(svg) {
        color: var(--muted-foreground);
        width: 18px;
        height: 18px;
    }

    /* CTA Row */
    .cta-row {
        display: flex;
        gap: 1rem;
        align-items: center;
    }
    .chat-start-button {
        flex: 1;
        max-width: 280px;
        padding: 0.9rem 1.5rem;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--primary-foreground);
        background: var(--primary-gradient);
        background-size: 200% 200%;
        animation: gradient-animation 3s ease infinite;
        border: none;
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    .chat-start-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
        filter: brightness(1.05);
    }

    .action-buttons {
        display: flex;
        gap: 0.5rem;
    }
    .action-btn {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--muted-foreground);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
    }
    .action-btn:hover {
        background: var(--muted);
        color: var(--foreground);
        transform: translateY(-1px);
    }
    .action-btn.destructive:hover {
        background: hsla(var(--destructive-hsl), 0.1);
        color: var(--destructive);
        border-color: hsla(var(--destructive-hsl), 0.3);
    }

    /* ── Detail Section ── */
    .detail-section {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    /* First Scene Accordion */
    .first-scene-container {
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        overflow: hidden;
        background: var(--card);
    }
    .scene-toggle {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        background: hsla(var(--muted), 0.3);
        border: none;
        cursor: pointer;
        color: var(--foreground);
        transition: background 0.2s;
    }
    .scene-toggle:hover {
        background: hsla(var(--muted), 0.6);
    }
    .scene-toggle-left {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-weight: 600;
        font-size: 1rem;
    }
    .scene-body {
        padding: 1.5rem;
        border-top: 1px solid var(--border);
    }

    .scene-text {
        font-size: 1rem;
        line-height: 1.7;
        color: var(--muted-foreground);
        white-space: pre-wrap;
    }

    /* 3D Scene Data */
    .threed-data-wrapper {
        display: flex;
        flex-direction: column;
        gap: 1.2rem;
    }
    .threed-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.8rem;
    }
    .data-chip {
        display: flex;
        flex-direction: column;
        background: hsla(var(--muted), 0.3);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0.6rem 0.8rem;
        font-size: 0.9rem;
        min-width: 100px;
        flex: 1 1 auto;
    }
    .chip-label {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--muted-foreground);
        margin-bottom: 0.3rem;
        text-transform: uppercase;
    }
    .chip-value {
        color: var(--foreground);
        font-weight: 500;
    }
    .data-chip.emotion {
        border-left: 3px solid var(--color-emotion, #ff79c6);
    }
    .data-chip.desire {
        border-left: 3px solid var(--color-desire, #bd93f9);
    }
    .data-chip.personality {
        border-left: 3px solid var(--color-personality, #50fa7b);
    }
    .threed-narrative {
        background: hsla(var(--muted), 0.3);
        border-radius: 8px;
        padding: 1rem;
        border-left: 3px solid var(--primary);
    }

    /* Comments Section */
    .comments-section {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card-lg);
        padding: 2rem;
        display: flex;
        flex-direction: column;
    }
    .comments-title {
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--foreground);
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .comments-list {
        display: flex;
        flex-direction: column;
        gap: 1.2rem;
        margin-bottom: 2rem;
    }
    .comment-card {
        display: flex;
        gap: 1rem;
        padding: 1rem;
        background: var(--muted); /* Fallback */
        background: hsla(var(--muted), 0.4);
        border-radius: 12px;
        border: 1px solid transparent;
        transition: border-color 0.2s;
    }
    .comment-card:hover {
        border-color: var(--border);
    }
    .comment-avatar {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        object-fit: cover;
        background: var(--background);
        border: 1px solid var(--border);
    }
    .comment-content {
        flex: 1;
        min-width: 0;
    }
    .comment-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 0.4rem;
    }
    .comment-author {
        font-weight: 700;
        font-size: 0.95rem;
        color: var(--foreground);
    }
    .comment-timestamp {
        font-size: 0.8rem;
        color: var(--muted-foreground);
    }
    .comment-text {
        font-size: 0.95rem;
        color: var(--foreground);
        line-height: 1.5;
        white-space: pre-wrap;
        opacity: 0.9;
    }
    .no-comments {
        color: var(--muted-foreground);
        text-align: center;
        padding: 3rem 0;
        background: hsla(var(--muted), 0.2);
        border-radius: 12px;
        border: 1px dashed var(--border);
    }

    .comment-input-box {
        display: flex;
        gap: 0.8rem;
        margin-top: auto;
        background: hsla(var(--muted), 0.4);
        padding: 0.8rem;
        border-radius: 14px;
        border: 1px solid var(--border);
        transition:
            border-color 0.2s,
            background 0.2s;
        box-sizing: border-box; /* Ensure padding doesn't push width */
        width: 100%;
        max-width: 100%;
    }
    .comment-input-box:focus-within {
        border-color: var(--primary);
        background: var(--card);
        box-shadow: 0 0 0 2px hsla(var(--primary-hsl), 0.1);
    }
    .comment-input-box input {
        flex-grow: 1;
        width: 0;
        min-width: 0;
        background: transparent !important;
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
        appearance: none;
        -webkit-appearance: none;
        color: var(--foreground);
        padding: 0.5rem;
        font-size: 0.95rem;
    }
    .comment-input-box input:focus {
        outline: none !important;
        box-shadow: none !important;
        border: none !important;
    }
    .comment-input-box .icon-button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.6rem;
        width: 42px;
        height: 42px;
        flex-shrink: 0;
        border-radius: 10px;
        background: var(--primary);
        color: white;
        border: none;
        cursor: pointer;
        transition: all 0.2s;
    }
    .comment-input-box .icon-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    /* ── Responsive Design ── */
    @media (max-width: 992px) {
        .hero-section {
            grid-template-columns: 1fr;
            gap: 2rem;
        }
        .hero-gallery {
            max-width: 500px;
            width: 100%;
            margin: 0 auto;
        }
        .hero-info {
            align-items: center;
            text-align: center;
            padding-top: 0;
        }
        .type-badge {
            align-self: center;
        }
        .creator-chip {
            align-self: center;
        }
        .tags-container {
            justify-content: center;
        }
        .stats-row {
            justify-content: center;
            flex-wrap: wrap;
        }
        .cta-row {
            width: 100%;
            max-width: 400px;
            justify-content: center;
        }
        .chat-start-button {
            width: 100%;
        }
    }

    @media (max-width: 640px) {
        .profile-page-wrapper {
            padding: 1rem;
            margin-top: 15px;
        }
        .profile-container {
            gap: 2rem;
        }
        .hero-gallery {
            max-width: 100%;
        }
        .character-name {
            font-size: 2rem;
        }
        .cta-row {
            flex-direction: column;
            width: 100%;
            gap: 0.8rem;
        }
        .chat-start-button {
            max-width: 100%;
            width: 100%;
        }
        .action-buttons {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
        }
        .action-btn {
            width: 100%;
        }
        .comments-section {
            padding: 1rem;
        }
    }
</style>

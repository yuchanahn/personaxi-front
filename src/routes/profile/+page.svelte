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

            //fetchAndSetAssetTypes(images).then((imgs) => {
            //    galleryImages = imgs;
            //});
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
</script>

<svelte:head>
    {#if persona}
        <title>{persona.name} - PersonaXi</title>
        <meta
            name="description"
            content={persona.one_liner ||
                persona.greeting ||
                `${persona.name}과 대화하세요`}
        />
        <meta property="og:title" content="{persona.name} - PersonaXi" />
        <meta
            property="og:description"
            content={persona.one_liner ||
                persona.greeting ||
                `${persona.name}과 대화하세요`}
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
                <div class="profile-main">
                    <div class="image-gallery-wrapper">
                        {#if galleryImages.length > 0}
                            <AssetPreview
                                asset={galleryImages[currentImageIndex]}
                            />
                            {#if galleryImages[currentImageIndex].is_secret && galleryImages[currentImageIndex].url}
                                <div class="secret-indicator">
                                    <Icon icon="ph:lock-key-open-bold" />
                                    <span
                                        >{$t("profilePage.secretAssetLabel") ||
                                            "Secret"}</span
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
                                <div class="indicator-dots">
                                    {#each galleryImages as _, i}
                                        <button
                                            class="dot"
                                            class:active={i ===
                                                currentImageIndex}
                                            on:click|stopPropagation={() =>
                                                goToImage(i)}
                                            aria-label={$t(
                                                "profilePage.imageMoveLabel",
                                                {
                                                    values: { index: i + 1 },
                                                },
                                            )}
                                        ></button>
                                    {/each}
                                </div>
                            {/if}
                        {/if}
                    </div>
                    <h1 class="character-name">{persona.name}</h1>
                    {#if persona.creator_name}
                        <button
                            class="creator-info clickable"
                            on:click={goToCreatorPage}
                            aria-label={$t("profilePage.goToCreatorProfile", {
                                values: { creatorName: persona.creator_name },
                            })}
                        >
                            <Icon icon="ph:user-circle-duotone" />
                            <span>
                                {$t("profilePage.creatorInfo", {
                                    values: {
                                        creatorName: persona.creator_name,
                                    },
                                })}
                            </span>
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
                    <div class="tags-container">
                        {#if persona.tags && persona.tags.length > 0}
                            {#each persona.tags as tag}
                                <span class="tag">{getTagName(tag)}</span>
                            {/each}
                        {/if}
                    </div>

                    {#if persona.first_scene}
                        <div class="first-scene-container">
                            <h3 class="scene-title">
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
                            </h3>

                            <div class="scene-wrapper">
                                <div
                                    class="scene-content"
                                    class:blurred={!showFirstScene}
                                >
                                    <div
                                        transition:slide={{
                                            duration: 300,
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
                                                            <span
                                                                class="chip-label"
                                                                ><Icon
                                                                    icon="ph:smiley-duotone"
                                                                /> 감정</span
                                                            >
                                                            <span
                                                                class="chip-value"
                                                                >{threeDSceneData.current_emotion}</span
                                                            >
                                                        </div>
                                                    {/if}
                                                    {#if threeDSceneData.core_desire}
                                                        <div
                                                            class="data-chip desire"
                                                        >
                                                            <span
                                                                class="chip-label"
                                                                ><Icon
                                                                    icon="ph:target-duotone"
                                                                /> 욕구</span
                                                            >
                                                            <span
                                                                class="chip-value"
                                                                >{threeDSceneData.core_desire}</span
                                                            >
                                                        </div>
                                                    {/if}
                                                    {#if threeDSceneData.personality}
                                                        <div
                                                            class="data-chip personality"
                                                        >
                                                            <span
                                                                class="chip-label"
                                                                ><Icon
                                                                    icon="ph:fingerprint-duotone"
                                                                /> 성격</span
                                                            >
                                                            <span
                                                                class="chip-value"
                                                                >{threeDSceneData.personality}</span
                                                            >
                                                        </div>
                                                    {/if}
                                                </div>

                                                {#if threeDSceneData.mem_list}
                                                    <div
                                                        class="threed-narrative"
                                                    >
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
                                </div>

                                {#if !showFirstScene}
                                    <div class="spoiler-overlay-modern">
                                        <button
                                            class="btn-reveal"
                                            on:click={() =>
                                                (showFirstScene = true)}
                                        >
                                            <Icon icon="ph:eye-bold" />
                                            <span>{$t("common.show")}</span>
                                        </button>
                                    </div>
                                {/if}
                            </div>

                            {#if showFirstScene && !(persona.personaType === "3D" || persona.personaType === "2.5D")}
                                <button
                                    class="spoiler-toggle-btn hide"
                                    on:click={() => (showFirstScene = false)}
                                >
                                    <Icon icon="ph:eye-slash-bold" />
                                    <span>{$t("common.hide")}</span>
                                </button>
                            {/if}
                        </div>
                    {/if}
                    <div class="stats-container">
                        <button
                            class="stat-item"
                            on:click={() => {
                                if (persona) handleLike(persona);
                            }}
                            aria-label={$t("profilePage.likeButtonLabel")}
                            title={$t("profilePage.likeButtonLabel")}
                        >
                            <Icon
                                icon={persona.is_liked
                                    ? "ph:heart-fill"
                                    : "ph:heart-bold"}
                                style={persona.is_liked
                                    ? "color: #ff79c6;"
                                    : ""}
                            />
                            <span class="stat-value">{persona.likes_count}</span
                            >
                        </button>

                        <div class="stat-divider"></div>

                        <div
                            class="stat-item non-clickable"
                            title={$t("profilePage.interactionLabel")}
                        >
                            <Icon icon="ph:chat-circle-dots-bold" />
                            <span class="stat-value">{persona.chat_count}</span>
                        </div>

                        <div class="stat-divider"></div>

                        <!-- Share Button -->
                        <button
                            class="stat-item"
                            on:click={handleShare}
                            title={$t("settingModal.share") || "Share"}
                        >
                            <Icon icon="ph:share-network-bold" />
                        </button>

                        <div class="stat-divider"></div>

                        <!-- Report Button -->
                        <button
                            class="stat-item destructive"
                            on:click={() => (showReportModal = true)}
                            title={$t("settingModal.report") || "Report"}
                        >
                            <Icon icon="ph:flag-bold" />
                        </button>
                    </div>

                    <!-- Image Stats (New) -->
                    {#if galleryImages.length > 1}
                        <div class="image-stats-row">
                            <div class="image-stat">
                                <Icon icon="ph:image-square-bold" />
                                <span
                                    >{$t("profilePage.totalImages", {
                                        values: { count: galleryImages.length },
                                    }) || `Total ${galleryImages.length}`}</span
                                >
                            </div>
                            {#if galleryImages.filter((img) => img.is_secret).length > 0}
                                <div class="image-stat secret">
                                    <Icon icon="ph:lock-key-fill" />
                                    <span
                                        >{$t("profilePage.hiddenImages", {
                                            values: {
                                                count: galleryImages.filter(
                                                    (img) => img.is_secret,
                                                ).length,
                                            },
                                        }) ||
                                            `Hidden ${galleryImages.filter((img) => img.is_secret).length}`}</span
                                    >
                                </div>
                            {/if}
                        </div>
                    {/if}
                    <button
                        class="chat-start-button"
                        on:click={handleStartChat}
                    >
                        <span>{$t("profilePage.startChatButton")}</span>
                        <Icon
                            icon="ph:chat-circle-dots-duotone"
                            width="22"
                            height="22"
                        />
                    </button>
                </div>
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
                                        "https://i.pravatar.cc/40?u=" +
                                            comment.author_id}
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
                            placeholder={$t("profilePage.commentPlaceholder")}
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
    .stats-container {
        display: flex;
        justify-content: space-around;
        align-items: center;
        width: 100%;
        background-color: hsla(var(--dark), 0.2);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        padding: 1rem;
        margin-bottom: 2.5rem;
        gap: 0.5rem;
    }
    .stat-divider {
        width: 1px;
        height: 40px;
        background-color: var(--border);
        margin: 0 0.5rem;
    }
    .image-stats-row {
        display: flex;
        justify-content: center;
        gap: 1.5rem;
        margin-bottom: 2rem;
        margin-top: -1.5rem;
    }
    .image-stat {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.9rem;
        color: var(--muted-foreground);
        background: var(--muted);
        padding: 4px 10px;
        border-radius: 999px;
    }
    .image-stat.secret {
        color: #fbbf24;
        background: rgba(251, 191, 36, 0.1);
        border: 1px solid rgba(251, 191, 36, 0.2);
    }
    .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.2rem;
        font-weight: 600;
        color: var(--foreground);
        padding: 8px 16px;
        border-radius: 12px;
        transition: background-color 0.2s;
        border: none;
        background: transparent;
    }
    .stat-item:hover:not(:disabled):not(.non-clickable) {
        background-color: var(--muted);
        cursor: pointer;
    }
    .stat-item.destructive {
        color: var(--destructive);
    }
    .stat-item.destructive:hover {
        background-color: var(--destructive-foreground);
    }
    .stat-item :global(svg) {
        color: var(--muted-foreground);
        width: 28px;
        height: 28px;
    }

    /* Mobile Responsive Fixes */
    @media (max-width: 640px) {
        .stats-container {
            padding: 0.75rem 0.5rem;
            gap: 0.25rem;
        }
        .stat-item {
            padding: 6px 8px;
            font-size: 1rem;
        }
        .stat-item :global(svg) {
            width: 24px;
            height: 24px;
        }
        .stat-divider {
            margin: 0 0.25rem;
        }

        /* 하단에 네비 바 만큼 여백 주기 */
        .profile-container {
            margin-bottom: 5rem;
        }
    }
    .scroll-container {
        height: 100%;
        background-color: var(--background);
    }
    .first-scene-container {
        width: 100%;
        background-color: hsla(var(--dark), 0.2);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        padding: 1.5rem;
        margin-bottom: 2.5rem;
        text-align: left;
    }
    .scene-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--foreground);
        margin: 0 0 1rem 0;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border);
    }
    .scene-text {
        font-size: 0.95rem;
        line-height: 1.7;
        color: var(--muted-foreground);
        white-space: pre-wrap;
        margin: 0;
        font-style: italic;
    }
    .profile-main {
        background: var(--card);
        border: 1px solid var(--border-card);
        border-radius: var(--radius-card-lg);
        padding: 2rem;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    .image-counter {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.75rem;
        color: var(--accent-foreground);
        background-color: hsl(var(--background) / 0.9);
        padding: 0.2rem 0.4rem;
        border-radius: var(--radius-button);
        font-weight: 600;
        border: 1px solid hsl(var(--border) / 0.5);
        backdrop-filter: blur(8px);
        text-shadow: 0 1px 2px hsl(var(--background) / 0.8);
    }
    .image-gallery-wrapper {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        margin-bottom: 1.5rem;
        border-radius: var(--radius-card);
        overflow: hidden;
        background-color: var(--background);
    }
    .secret-indicator {
        position: absolute;
        top: 10px;
        left: 10px;
        display: flex;
        align-items: center;
        gap: 6px;
        background-color: rgba(0, 0, 0, 0.7);
        color: #fbbf24; /* Amber-400 */
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        z-index: 10;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(251, 191, 36, 0.3);
    }
    /* .profile-portrait-square removed */
    .nav-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background-color: hsla(var(--dark), 0.4);
        color: var(--accent-foreground);
        border: none;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background-color 0.2s;
        z-index: 10;
    }
    .nav-arrow:hover {
        background-color: hsla(var(--dark), 0.7);
    }
    .nav-arrow.left {
        left: 10px;
    }
    .nav-arrow.right {
        right: 10px;
    }
    .indicator-dots {
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        max-width: 80%;
        overflow-x: auto;
        padding: 4px 0;
        display: flex;
        gap: 8px;
        z-index: 10;
        scrollbar-width: none;
    }
    .indicator-dots::-webkit-scrollbar {
        display: none;
    }
    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: hsla(var(--contrast), 0.4);
        border: none;
        padding: 0;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .dot:hover {
        background-color: hsla(var(--contrast), 0.7);
    }
    .dot.active {
        background-color: var(--contrast);
    }
    .profile-page-wrapper {
        background-color: var(--background);
        color: var(--foreground);
        height: 100%;
        padding: 2rem;
        display: flex;
        justify-content: center;
        align-items: flex-start;
    }
    .loading-text,
    .error-text {
        font-size: 1.2rem;
        color: var(--muted-foreground);
    }
    .profile-container {
        display: grid;
        grid-template-columns: 1fr 1.2fr;
        gap: 3rem;
        width: 100%;
        max-width: 1200px;
    }
    .character-name {
        font-size: 2.5rem;
        font-weight: bold;
        color: var(--foreground);
        margin-bottom: 0.5rem;
        text-align: center;
    }
    .creator-info {
        font-size: 1rem;
        color: var(--muted-foreground);
        margin-bottom: 1.5rem;
        text-align: center;
    }

    .creator-info.clickable {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        background: none;
        border: 1px solid var(--border);
        border-radius: var(--radius-button);
        padding: 0.75rem 1rem;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.95rem;
        font-weight: 500;
    }

    .creator-info.clickable:hover {
        background-color: var(--muted);
        border-color: var(--border-hover);
        color: var(--foreground);
        transform: translateY(-1px);
    }

    .creator-info.clickable :global(svg) {
        width: 18px;
        height: 18px;
        opacity: 0.7;
        transition: opacity 0.2s ease;
    }

    .creator-info.clickable:hover :global(svg) {
        opacity: 1;
    }
    .character-description {
        font-size: 1rem;
        line-height: 1.6;
        color: var(--muted-foreground);
        margin-bottom: 2rem;
        text-align: center;
    }
    .tags-container {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: center;
        margin-bottom: 2.5rem;
    }
    .tag {
        background-color: var(--secondary);
        color: var(--secondary-foreground);
        padding: 0.3rem 0.8rem;
        border-radius: 12px;
        font-size: 0.8rem;
    }
    .chat-start-button {
        width: 100%;
        max-width: 300px;
        padding: 1rem;
        font-size: 1.2rem;
        font-weight: bold;
        color: var(--primary-foreground);
        background: var(--primary-gradient);
        background-size: 200% 200%;
        animation: gradient-animation 3s ease infinite;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.8rem;
    }
    .chat-start-button:hover {
        transform: translateY(-3px);
        box-shadow: var(--shadow-popover);
    }
    .comments-section {
        background: var(--card);
        border: 1px solid var(--border-card);
        border-radius: var(--radius-card-lg);
        padding: 2rem;
        display: flex;
        flex-direction: column;
    }
    .comments-title {
        font-size: 1.5rem;
        font-weight: bold;
        color: var(--foreground);
        margin-bottom: 1.5rem;
    }
    .scene-wrapper {
        position: relative;
    }
    .scene-content {
        transition: all 0.3s ease;
    }
    .scene-content.blurred {
        filter: blur(6px);
        opacity: 0.6;
        height: 120px;
        overflow: hidden;
        user-select: none;
    }
    .spoiler-overlay-modern {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        background: linear-gradient(
            to bottom,
            transparent,
            hsla(var(--dark), 0.1)
        );
    }
    .btn-reveal {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 1.2rem;
        border-radius: 20px;
        border: 1px solid var(--border);
        background: hsla(var(--card), 0.8);
        color: var(--foreground);
        cursor: pointer;
        font-weight: 600;
        backdrop-filter: blur(4px);
        transition: all 0.2s;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .btn-reveal:hover {
        background: var(--primary);
        color: var(--primary-foreground);
        border-color: var(--primary);
        transform: translateY(-2px);
    }
    .spoiler-toggle-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 1.2rem;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--foreground);
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
    }
    .spoiler-toggle-btn:hover {
        background: var(--muted);
        transform: translateY(-2px);
    }

    .spoiler-toggle-btn.hide {
        margin-top: 1rem;
        width: 100%;
        justify-content: center;
        background: transparent;
        border: 1px dashed var(--border);
        color: var(--muted-foreground);
    }
    .spoiler-toggle-btn.hide:hover {
        background: rgba(255, 0, 0, 0.1);
        color: #ff5555;
        border-color: #ff5555;
    }
    .comments-list {
        flex-grow: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    .comment-card {
        display: flex;
        gap: 1rem;
        padding: 1rem;
        background: var(--muted);
        border-radius: var(--radius-card-sm);
    }
    .comment-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
    }
    .comment-content {
        flex: 1;
    }
    .comment-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }
    .comment-author {
        font-weight: bold;
        color: var(--foreground);
    }
    .comment-timestamp {
        font-size: 0.8rem;
        color: var(--muted-foreground);
    }
    .comment-text {
        font-size: 0.95rem;
        color: var(--muted-foreground);
        line-height: 1.5;
    }
    .no-comments {
        color: var(--muted-foreground);
        text-align: center;
        padding: 2rem 0;
    }
    .comment-input-box {
        display: flex;
        gap: 0.5rem;
        margin-top: auto;
    }
    .comment-input-box .icon-button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem;
        width: 40px;
        height: 46px;
        flex-shrink: 0;
        border-radius: 30%;
        background: var(--primary-gradient);
        color: var(--primary-foreground);
    }
    .comment-input-box input {
        flex-grow: 1;
        background: var(--input);
        border: 1px solid var(--border-input);
        color: var(--foreground);
        padding: 0.75rem 1rem;
        border-radius: var(--radius-input);
        font-size: 0.9rem;
    }
    .comment-input-box input:focus {
        outline: none;
        border-color: var(--border-input-hover);
    }
    .comment-input-box button {
        padding: 0.75rem 1.2rem;
        background-color: var(--secondary);
        color: var(--secondary-foreground);
        border: none;
        border-radius: var(--radius-button);
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .comment-input-box button:hover {
        opacity: 0.9;
    }
    .profile-main,
    .comments-section {
        min-width: 0;
        word-break: break-word;
    }
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
        background: hsla(var(--dark), 0.3);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0.6rem 0.8rem;
        font-size: 0.9rem;
        min-width: 120px;
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
        letter-spacing: 0.05em;
    }

    .chip-value {
        color: var(--foreground);
        font-weight: 500;
    }

    .data-chip.emotion {
        border-left: 3px solid #ff79c6;
    }
    .data-chip.desire {
        border-left: 3px solid #bd93f9;
    }
    .data-chip.personality {
        border-left: 3px solid #50fa7b;
    }

    .threed-narrative {
        background: hsla(var(--background), 0.5);
        border-radius: 8px;
        padding: 1rem;
        border-left: 2px solid var(--primary); /* 강조 라인 */
    }
    @media (max-width: 992px) {
        .profile-container {
            grid-template-columns: 1fr;
        }
    }
    @media (max-width: 768px) {
        .profile-page-wrapper {
            padding: 1rem;
        }
        .profile-container {
            gap: 1.5rem;
        }
        .profile-main,
        .comments-section {
            padding: 1.5rem;
        }
        .character-name {
            font-size: 2rem;
        }
    }
</style>

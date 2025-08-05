<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { loadPersona } from "$lib/api/edit_persona";
    // 🔽 types.ts에 정의된 실제 Comment 타입을 가져옵니다.
    import type { Persona, ImageMetadata, Comment } from "$lib/types";
    import { PORTRAIT_URL } from "$lib/constants";
    import Icon from "@iconify/svelte";
    import { LikeBtn, loadlikesdata } from "$lib/api/content";
    import { t } from "svelte-i18n";
    import { api } from "$lib/api";

    // --- 상태 관리 ---
    let persona: Persona | null = null;
    let comments: Comment[] = [];
    let isLoading = true;
    let newCommentText = ""; // 댓글 입력창과 바인딩될 변수

    // --- 이미지 갤러리 상태 변수 ---
    let galleryImages: ImageMetadata[] = [];
    let currentImageIndex = 0;

    // --- 🔽 실제 API 호출 함수들 🔽 ---

    // 코멘트 목록을 불러오는 함수
    async function loadComments(personaId: string): Promise<Comment[]> {
        const response = await api.get2(`/api/comments?personaId=${personaId}`);
        if (!response.ok) {
            console.error("Failed to load comments");
            return [];
        }
        return await response.json();
    }

    // 새 코멘트를 등록하는 함수
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

            // 성공 시, 화면에 즉시 새 댓글을 추가 (Optimistic Update)
            comments = [...comments, newComment];
            newCommentText = ""; // 입력창 초기화
        } catch (err) {
            console.error("Error posting comment:", err);
            alert($t("profilePage.commentPostFailed"));
        }
    }

    // --- 🔽 날짜 포맷팅 헬퍼 함수 🔽 ---
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

    // --- 페이지 로드 시 데이터 초기화 ---
    onMount(async () => {
        const personaId = $page.url.searchParams.get("c");
        if (!personaId) {
            isLoading = false;
            return;
        }

        try {
            const [p, c, likes] = await Promise.all([
                loadPersona(personaId),
                loadComments(personaId), // 실제 API 호출로 변경됨
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
        } catch (error) {
            console.error("Failed to load persona data:", error);
        } finally {
            isLoading = false;
        }
    });

    // --- 나머지 핸들러 함수들 (handleLike, showPrevImage 등)은 이전과 동일 ---
    function handleStartChat() {
        if (persona?.personaType === "2D" || persona?.personaType === "2d") {
            goto(`/2d?c=${persona.id}`);
        } else if (persona?.personaType === "3D") {
            goto(`/character?c=${persona.id}`);
        } else {
            alert(persona?.personaType);
        }
    }

    async function handleLike(p: Persona) {
        if (p.is_liked) return;
        await LikeBtn(
            p,
            () => {
                if (persona && persona.id === p.id) {
                    persona = {
                        ...persona,
                        is_liked: true,
                        likes_count: persona.likes_count + 1,
                    };
                }
            },
            (errorMessage) => {
                alert(`좋아요 처리에 실패했습니다: ${errorMessage}`);
            },
        );
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
</script>

<div class="scroll-container select-none">
    <div class="profile-page-wrapper">
        {#if isLoading}
            <p class="loading-text">{$t("profilePage.loadingPersona")}</p>
        {:else if persona}
            <div class="profile-container">
                <div class="profile-main">
                    <div class="image-gallery-wrapper">
                        {#if galleryImages.length > 0}
                            <img
                                src={galleryImages[currentImageIndex].url}
                                alt="{persona.name} 이미지 {currentImageIndex +
                                    1}"
                                class="profile-portrait-square"
                            />
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
                        <p class="creator-info">
                            {$t("profilePage.creatorInfo", {
                                values: { creatorName: persona.creator_name },
                            })}
                        </p>
                    {/if}
                    <p class="character-description">
                        {persona.greeting || $t("profilePage.defaultGreeting")}
                    </p>
                    <div class="tags-container">
                        {#if persona.tags && persona.tags.length > 0}
                            {#each persona.tags as tag}
                                <span class="tag">{tag}</span>
                            {/each}
                        {/if}
                    </div>

                    {#if persona.first_scene}
                        <div class="first-scene-container">
                            <h3 class="scene-title">
                                <Icon icon="ph:scroll-duotone" />
                                <span>{$t("profilePage.firstSceneTitle")}</span>
                            </h3>
                            <p class="scene-text">{persona.first_scene}</p>
                        </div>
                    {/if}
                    <div class="stats-container">
                        <button
                            class="stat-item"
                            on:click={() => {
                                if (persona) handleLike(persona);
                            }}
                            disabled={persona.is_liked}
                            aria-label={$t("profilePage.likeButtonLabel")}
                        >
                            <Icon
                                icon={persona.is_liked
                                    ? "ph:heart-fill"
                                    : "ph:heart-bold"}
                                style={persona.is_liked
                                    ? "color: #ff79c6;"
                                    : ""}
                            />
                            <span class="stat-label"
                                >{$t("profilePage.likeButtonLabel")}</span
                            >
                            <span class="stat-value">{persona.likes_count}</span
                            >
                        </button>
                        <div class="stat-item non-clickable">
                            <Icon icon="ph:chat-circle-dots-bold" />
                            <span class="stat-label"
                                >{$t("profilePage.interactionLabel")}</span
                            >
                            <span class="stat-value">{persona.chat_count}</span>
                        </div>
                    </div>
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
    }
    .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.2rem;
        font-weight: 600;
        color: var(--foreground);
    }
    .stat-item :global(svg) {
        color: var(--muted-foreground);
        width: 28px;
        height: 28px;
    }
    .scroll-container {
        height: 100%;
        overflow-y: auto;
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
    .profile-portrait-square {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: opacity 0.3s ease-in-out;
    }
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
        min-height: 100vh;
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
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--border);
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

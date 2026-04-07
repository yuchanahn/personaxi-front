<script lang="ts">
    import { onMount, tick } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import {
        fetchAndSetAssetTypes,
        loadPersona,
        PersonaLoadError,
    } from "$lib/api/edit_persona";
    import type { Persona, PersonaDTO, ImageMetadata, Comment } from "$lib/types";
    import { allCategories } from "$lib/constants";
    import Icon from "@iconify/svelte";
    import { loadlikesdata } from "$lib/api/content";
    import { locale, t } from "svelte-i18n";
    import { api } from "$lib/api";
    import { get } from "svelte/store";
    import { chatSessions } from "$lib/stores/chatSessions";
    import AssetPreview from "$lib/components/AssetPreview.svelte";
    import FirstSceneChatPreview from "$lib/components/profile/FirstSceneChatPreview.svelte";
    import { st_user } from "$lib/stores/user";
    import { toast } from "$lib/stores/toast";
    import ReportModal from "$lib/components/modal/ReportModal.svelte";
    import { AuthRequiredError } from "$lib/stores/authGate";
    import { buildPublicUrl, getBranding } from "$lib/branding/config";

    let persona: Persona | null = null;
    let comments: Comment[] = [];
    let isLoading = true;
    let newCommentText = "";
    let showFirstScenePreview = false;
    let showReportModal = false;
    let showMoreActions = false;

    let galleryImages: ImageMetadata[] = [];
    let currentImageIndex = 0;
    let thumbnailStripEl: HTMLDivElement | null = null;
    let moreActionsEl: HTMLDivElement | null = null;
    let thumbnailAspectRatios: number[] = [];
    let thumbnailCenterKey = "";
    let branding = getBranding();
    $: branding = getBranding($locale);

    const DEFAULT_THUMB_RATIO = 0.78;
    const MIN_THUMB_RATIO = 0.62;
    const MAX_THUMB_RATIO = 1.55;
    const PROFILE_META_TAG_IDS = [1001, 1002, 1003];
    const PROFILE_PREVIEW_STORAGE_PREFIX = "personaxi:profile-preview:";
    let galleryAssetTypeRequestId = 0;

    type PlayInfoChip = {
        icon: string;
        label: string;
        tone?: "accent" | "adult" | "tech";
    };
    let playInfoChips: PlayInfoChip[] = [];

    function clampThumbRatio(value?: number): number {
        if (!value || !Number.isFinite(value)) {
            return DEFAULT_THUMB_RATIO;
        }

        return Math.min(MAX_THUMB_RATIO, Math.max(MIN_THUMB_RATIO, value));
    }

    function parseTagId(tagId: string | number): number {
        return typeof tagId === "string" ? parseInt(tagId, 10) : tagId;
    }

    function getProfilePreviewStorageKey(personaId: string) {
        return `${PROFILE_PREVIEW_STORAGE_PREFIX}${personaId}`;
    }

    function readCachedProfilePreview(personaId: string): PersonaDTO | null {
        if (typeof sessionStorage === "undefined") return null;

        try {
            const raw = sessionStorage.getItem(
                getProfilePreviewStorageKey(personaId),
            );
            if (!raw) return null;

            const parsed = JSON.parse(raw) as PersonaDTO;
            return parsed?.id === personaId ? parsed : null;
        } catch (error) {
            console.warn("Failed to read cached profile preview", error);
            return null;
        }
    }

    function createPreviewPersona(dto: PersonaDTO): Persona {
        return {
            id: dto.id,
            owner_id: dto.owner_id ?? [],
            name: dto.name,
            personaType: dto.personaType ?? "",
            contentType: dto.contentType ?? "character",
            instructions: [],
            promptExamples: [],
            tags: dto.tags ?? [],
            feedback: { view: 0 },
            voice_id: "",
            vrm_url: "",
            live2d_model_url: "",
            model_background_url: "",
            portrait_url: dto.portrait_url,
            static_portrait_url: dto.static_portrait_url,
            image_metadatas: dto.image_metadatas ?? [],
            image_count:
                dto.image_count ?? dto.image_metadatas?.length ?? 0,
            visibility: "public",
            created_at: "",
            updated_at: "",
            creator_name: dto.creator_name ?? "",
            one_liner: dto.one_liner ?? "",
            first_scene: "",
            greeting: "",
            likes_count: dto.likes_count ?? 0,
            dislikes_count: dto.dislikes_count ?? 0,
            is_liked: false,
            chat_count: dto.chat_count ?? 0,
            start_voice_url: "",
            variables: [],
            status_template: "",
            status_template_css: "",
            chat_style_css: "",
            interactiveUIEnabled: false,
            commercialRightsConfirmed: dto.commercialRightsConfirmed,
        };
    }

    function buildGalleryImages(source: {
        portrait_url: string;
        static_portrait_url?: string;
        image_metadatas?: ImageMetadata[];
    }): ImageMetadata[] {
        let images: ImageMetadata[] = [
            {
                url: source.portrait_url,
                static_url: source.static_portrait_url,
                description: $t("profilePage.defaultProfile"),
            },
        ];

        if (source.image_metadatas && source.image_metadatas.length > 0) {
            const galleryAssets = source.image_metadatas.map((asset) => {
                if (asset.is_secret && asset.blur_url) {
                    return {
                        ...asset,
                        url: asset.blur_url,
                    };
                }

                return asset;
            });

            images = [...images, ...galleryAssets];
        }

        return images;
    }

    function applyGalleryImages(source: {
        portrait_url: string;
        static_portrait_url?: string;
        image_metadatas?: ImageMetadata[];
    }) {
        const images = buildGalleryImages(source);
        currentImageIndex = 0;
        galleryImages = images;
        syncThumbnailAspectRatios(images);
        return images;
    }

    function hydrateGalleryAssetTypes(images: ImageMetadata[]) {
        const requestId = ++galleryAssetTypeRequestId;

        void fetchAndSetAssetTypes(images)
            .then((typedImages) => {
                if (requestId !== galleryAssetTypeRequestId) return;
                galleryImages = typedImages;
                syncThumbnailAspectRatios(typedImages);
            })
            .catch((error) => {
                console.warn("Failed to hydrate profile asset types", error);
            });
    }

    function applyLikedState(likes: string[], personaId: string) {
        if (!persona || persona.id !== personaId) return;

        persona = {
            ...persona,
            is_liked: likes.includes(personaId),
        };
    }

    function syncThumbnailAspectRatios(images: ImageMetadata[]) {
        thumbnailAspectRatios = images.map((_, index) =>
            clampThumbRatio(thumbnailAspectRatios[index]),
        );
    }

    function handleThumbnailLoad(
        index: number,
        event: CustomEvent<{ aspectRatio?: number }>,
    ) {
        const nextRatio = clampThumbRatio(event.detail?.aspectRatio);

        if (thumbnailAspectRatios[index] === nextRatio) {
            return;
        }

        thumbnailAspectRatios = thumbnailAspectRatios.map((ratio, i) =>
            i === index ? nextRatio : ratio,
        );
    }

    function centerActiveThumbnail(behavior: ScrollBehavior = "smooth") {
        const strip = thumbnailStripEl;
        const activeThumb =
            strip?.querySelector<HTMLButtonElement>(".thumb.active");

        if (!strip || !activeThumb) {
            return;
        }

        const targetLeft =
            activeThumb.offsetLeft -
            strip.clientWidth / 2 +
            activeThumb.clientWidth / 2;
        const maxScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth);
        const nextScrollLeft = Math.min(
            maxScrollLeft,
            Math.max(0, targetLeft),
        );

        strip.scrollTo({
            left: nextScrollLeft,
            behavior,
        });
    }

    $: {
        const nextCenterKey =
            thumbnailStripEl && galleryImages.length > 1
                ? `${currentImageIndex}:${thumbnailAspectRatios.join(",")}`
                : "";

        if (nextCenterKey && nextCenterKey !== thumbnailCenterKey) {
            const behavior: ScrollBehavior = thumbnailCenterKey
                ? "smooth"
                : "auto";
            thumbnailCenterKey = nextCenterKey;

            tick().then(() => {
                centerActiveThumbnail(behavior);
            });
        } else if (!nextCenterKey && thumbnailCenterKey) {
            thumbnailCenterKey = "";
        }
    }

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
            if (err instanceof AuthRequiredError) {
                return;
            }
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

    function isTranslationPending(value?: string) {
        return value === "<tr>";
    }

    function getDisplayOneLiner() {
        if (!persona?.one_liner) {
            return "";
        }

        return isTranslationPending(persona.one_liner)
            ? $t("profilePage.translating")
            : persona.one_liner;
    }

    function getProfileMetaDescription() {
        if (persona?.one_liner) {
            return getDisplayOneLiner();
        }

        if (persona?.greeting) {
            return isTranslationPending(persona.greeting)
                ? $t("profilePage.translating")
                : persona.greeting;
        }

        return $t("profilePage.defaultDescription", {
            values: { name: persona?.name ?? "" },
        });
    }

    onMount(() => {
        let isActive = true;

        const handleWindowPointerDown = (event: PointerEvent) => {
            if (
                showMoreActions &&
                moreActionsEl &&
                event.target instanceof Node &&
                !moreActionsEl.contains(event.target)
            ) {
                showMoreActions = false;
            }
        };

        const handleWindowKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && showMoreActions) {
                showMoreActions = false;
            }
        };

        window.addEventListener("pointerdown", handleWindowPointerDown);
        window.addEventListener("keydown", handleWindowKeyDown);

        void (async () => {
            const personaId = $page.url.searchParams.get("c");
            if (!personaId) {
                isLoading = false;
                return;
            }

            try {
                const preview = readCachedProfilePreview(personaId);

                if (preview) {
                    persona = createPreviewPersona(preview);
                    const previewImages = applyGalleryImages(preview);
                    hydrateGalleryAssetTypes(previewImages);
                    isLoading = false;
                }

                void loadComments(personaId)
                    .then((loadedComments) => {
                        if (!isActive) return;
                        comments = loadedComments;
                    })
                    .catch((error) => {
                        console.error("Failed to load comments:", error);
                    });

                void loadlikesdata()
                    .then((likes) => {
                        if (!isActive) return;
                        applyLikedState((likes as string[]) ?? [], personaId);
                    })
                    .catch((error) => {
                        console.error("Failed to load likes data:", error);
                    });

                const p = await loadPersona(personaId);
                if (!isActive) return;

                persona = p;
                const images = applyGalleryImages(p);
                hydrateGalleryAssetTypes(images);
            } catch (error) {
                console.error("Failed to load persona data:", error);
                if (error instanceof PersonaLoadError && error.status === 404) {
                    toast.error($t("profilePage.restrictedOrMissing"));
                    goto("/hub", { replaceState: true });
                }
            } finally {
                if (isActive && persona) {
                    isLoading = false;
                } else if (isActive && !persona) {
                    isLoading = false;
                }
            }
        })();

        return () => {
            isActive = false;
            window.removeEventListener("pointerdown", handleWindowPointerDown);
            window.removeEventListener("keydown", handleWindowKeyDown);
        };
    });

    function handleStartChat() {
        if (!persona) return;

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
            if (error instanceof AuthRequiredError) {
                return;
            }
            console.error("Like toggle failed:", error);
            toast.error(
                $t("profilePage.likeFailed", {
                    values: { message: "Network error" },
                }),
            );
        }
    }

    async function handleShare() {
        if (!persona || !persona.id || persona.visibility === "private") return;
        showMoreActions = false;

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

    function toggleMoreActions() {
        showMoreActions = !showMoreActions;
    }

    function openReportModal() {
        showMoreActions = false;
        showReportModal = true;
    }

    function getEffectiveUserName(): string {
        if (!persona) return "User";

        const user = get(st_user);
        const personas = user?.data?.userPersonas ?? [];
        const selectedPersonaId = (
            get(chatSessions).find((s) => s.id === persona?.id)?.userPersonaId ||
            ""
        ).trim();
        const selectedPersona = selectedPersonaId
            ? personas.find(
                  (p) => p.id === selectedPersonaId && (p.name || "").trim(),
              )
            : null;
        const defaultPersona = personas.find(
            (p) => p.isDefault && (p.name || "").trim(),
        );

        return (
            selectedPersona?.name?.trim() ||
            defaultPersona?.name?.trim() ||
            user?.data?.nickname?.trim() ||
            "User"
        );
    }

    function replaceNicknameInText(text: string): string {
        if (!persona) return text;
        return text
            .replaceAll("{{user}}", getEffectiveUserName())
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
    } else {
        threeDSceneData = null;
    }

    $: if (!persona?.first_scene) {
        showFirstScenePreview = false;
    }

    function getTagName(tagId: string | number): string {
        const id = parseTagId(tagId);
        const category = allCategories.find((c) => c.id === id);
        return category ? $t(category.nameKey) : String(tagId);
    }

    // ── UI Helpers ──
    $: normalizedPersonaType = (persona?.personaType || "")
        .trim()
        .toLowerCase();
    $: isTwoDPersona = normalizedPersonaType === "2d";
    $: isModelPersonaType =
        normalizedPersonaType === "3d" ||
        normalizedPersonaType === "2.5d" ||
        normalizedPersonaType === "vrm3d" ||
        normalizedPersonaType === "live2d";
    $: creatorHandle = persona?.creator_name
        ? persona.creator_name.startsWith("@")
            ? persona.creator_name
            : `@${persona.creator_name}`
        : "";

    $: categoryTags =
        persona?.tags?.filter((t: string) => parseTagId(t) < 1000) || [];
    $: regularTags =
        persona?.tags?.filter((t: string) => parseTagId(t) >= 1000) || [];
    $: displayRegularTags = regularTags.filter(
        (tag) => !PROFILE_META_TAG_IDS.includes(parseTagId(tag)),
    );
    $: hiddenImageCount =
        persona?.image_metadatas?.filter((asset) => asset.is_secret).length ?? 0;
    $: hasAdultTag = regularTags.some((tag) => parseTagId(tag) === 1003);
    $: hasStatusPanel = Boolean(
        persona?.status_template?.trim() && persona?.variables?.length,
    );
    $: renderTypeLabel =
        normalizedPersonaType === "3d" || normalizedPersonaType === "vrm3d"
            ? $t("profilePage.playInfo3d")
            : normalizedPersonaType === "2.5d" ||
                normalizedPersonaType === "live2d"
              ? $t("profilePage.playInfoLive2d")
              : normalizedPersonaType === "2d"
                ? $t("profilePage.playInfo2d")
                : "";
    $: renderTypeIcon =
        normalizedPersonaType === "3d" || normalizedPersonaType === "vrm3d"
            ? "ph:cube-duotone"
            : normalizedPersonaType === "2.5d" ||
                normalizedPersonaType === "live2d"
              ? "ph:monitor-play-duotone"
              : normalizedPersonaType === "2d"
                ? "ph:image-duotone"
                : "";
    $: playInfoChips = persona
        ? [
              {
                  icon:
                      persona.contentType === "story"
                          ? "ph:book-open-duotone"
                          : "ph:chat-circle-dots-duotone",
                  label:
                      persona.contentType === "story"
                          ? $t("profilePage.playInfoStoryMode")
                          : $t("profilePage.playInfoCharacterChat"),
                  tone: "accent" as const,
              },
              {
                  icon:
                      persona.contentType === "story" &&
                      persona.interactiveUIEnabled
                          ? "ph:app-window-duotone"
                          : "ph:keyboard-duotone",
                  label:
                      persona.contentType === "story" &&
                      persona.interactiveUIEnabled
                          ? $t("profilePage.playInfoInteractiveUi")
                          : $t("profilePage.playInfoFreeInput"),
              },
              ...(hasStatusPanel
                  ? [
                        {
                            icon: "ph:sliders-horizontal-duotone",
                            label: $t("profilePage.playInfoStatusPanel"),
                        } as PlayInfoChip,
                    ]
                  : []),
              ...(persona.first_scene?.trim()
                  ? [
                        {
                            icon: "ph:sparkle-duotone",
                            label: $t("profilePage.playInfoOpening"),
                        } as PlayInfoChip,
                    ]
                  : []),
              ...(hasAdultTag
                  ? [
                        {
                            icon: "ph:warning-circle-duotone",
                            label: $t("profilePage.playInfoAdult"),
                            tone: "adult" as const,
                        } as PlayInfoChip,
                    ]
                  : []),
              ...(renderTypeLabel
                  ? [
                        {
                            icon: renderTypeIcon,
                            label: renderTypeLabel,
                            tone: "tech" as const,
                        } as PlayInfoChip,
                    ]
                  : []),
          ]
        : [];
</script>

<svelte:head>
    {#if persona}
        <title>{persona.name} - {branding.publicBrandName}</title>
        <meta
            name="description"
            content={getProfileMetaDescription()}
        />
        <meta
            property="og:title"
            content={`${persona.name} - ${branding.publicBrandName}`}
        />
        <meta
            property="og:description"
            content={getProfileMetaDescription()}
        />
        <meta
            property="og:image"
            content={persona.portrait_url || branding.ogImageUrl}
        />
        <meta
            property="og:url"
            content={buildPublicUrl(`/profile?c=${persona.id}`)}
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
            name="twitter:title"
            content={`${persona.name} - ${branding.publicBrandName}`}
        />
        <meta
            name="twitter:image"
            content={persona.portrait_url || branding.ogImageUrl}
        />
    {:else}
        <title>Profile - {branding.publicBrandName}</title>
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
                                    showVideoPosterFallback={true}
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
                                        {#if hiddenImageCount > 0}
                                            <span
                                                class="image-counter-separator"
                                            ></span>
                                            <Icon icon="ph:lock-key-bold" />
                                            <span
                                                title={$t(
                                                    "profilePage.hiddenImages",
                                                    {
                                                        values: {
                                                            count: hiddenImageCount,
                                                        },
                                                    },
                                                )}
                                                >{hiddenImageCount}</span
                                            >
                                        {/if}
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
                            <div
                                class="thumbnail-strip"
                                bind:this={thumbnailStripEl}
                            >
                                {#each galleryImages as img, i}
                                    <button
                                        class="thumb"
                                        class:active={i === currentImageIndex}
                                        style={`--thumb-ratio: ${thumbnailAspectRatios[i] ?? DEFAULT_THUMB_RATIO};`}
                                        on:click|stopPropagation={() =>
                                            goToImage(i)}
                                    >
                                        <div class="thumb-content">
                                            <AssetPreview
                                                asset={img}
                                                showVideoPosterFallback={true}
                                                on:load={(event) =>
                                                    handleThumbnailLoad(
                                                        i,
                                                        event,
                                                    )}
                                            />
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>

                    <!-- Hero Info -->
                    <div class="hero-info">
                        <h1 class="character-name">{persona.name}</h1>

                        {#if persona.creator_name}
                            <button
                                class="creator-chip"
                                type="button"
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
                                <span>by {creatorHandle}</span>
                            </button>
                        {/if}

                        {#if persona.one_liner}
                            <p class="one-liner">{getDisplayOneLiner()}</p>
                        {/if}

                        {#if playInfoChips.length > 0}
                            <div class="play-info-block">
                                <p class="play-info-label">
                                    {$t("profilePage.playInfoLabel")}
                                </p>
                                <div class="play-info-chips">
                                    {#each playInfoChips as chip}
                                        <span
                                            class={`play-info-chip ${chip.tone
                                                ? `play-info-chip-${chip.tone}`
                                                : ""}`}
                                        >
                                            <Icon icon={chip.icon} width="16" />
                                            <span>{chip.label}</span>
                                        </span>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        {#if persona.personaType === "2.5D"}
                            <div class="live2d-rights-notice">
                                <Icon icon="ph:shield-check-duotone" />
                                <p>
                                    {$t("profilePage.live2dRightsNotice")}
                                </p>
                            </div>
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
                        {#if categoryTags.length > 0 || displayRegularTags.length > 0}
                            <div class="tags-container">
                                {#each categoryTags as tag}
                                    <span class="tag tag-category"
                                        >{getTagName(tag)}</span
                                    >
                                {/each}
                                {#each displayRegularTags as tag}
                                    <span class="tag tag-regular"
                                        >{getTagName(tag)}</span
                                    >
                                {/each}
                            </div>
                        {/if}

                        <!-- Stats Row -->
                        <div class="stats-row">
                            <div
                                class="stat-chip stat-chip-labelled"
                                title={$t("profilePage.likeButtonLabel")}
                            >
                                <span class="stat-label"
                                    >{$t("profilePage.likeButtonLabel")}</span
                                >
                                <span class="stat-value"
                                    >{persona.likes_count}</span
                                >
                            </div>
                            <div
                                class="stat-chip stat-chip-labelled"
                                title={$t("profilePage.chatCountLabel")}
                            >
                                <span class="stat-label"
                                    >{$t("profilePage.chatCountLabel")}</span
                                >
                                <span class="stat-value"
                                    >{persona.chat_count}</span
                                >
                            </div>
                            <div class="action-buttons stats-actions">
                                <div
                                    class="more-actions"
                                    bind:this={moreActionsEl}
                                >
                                    <button
                                        class="more-actions-button"
                                        type="button"
                                        aria-label={$t(
                                            "profilePage.moreActions",
                                        ) || "More actions"}
                                        title={$t(
                                            "profilePage.moreActions",
                                        ) || "More actions"}
                                        aria-expanded={showMoreActions}
                                        aria-haspopup="menu"
                                        on:click={toggleMoreActions}
                                    >
                                        <span
                                            class="more-actions-icon"
                                            aria-hidden="true"
                                        >
                                            <Icon
                                                icon="ph:dots-three-outline-bold"
                                                width="18"
                                            />
                                        </span>
                                        <span
                                            class="more-actions-ellipsis"
                                            aria-hidden="true"
                                            >...</span
                                        >
                                    </button>

                                    {#if showMoreActions}
                                        <div
                                            class="more-actions-menu"
                                            role="menu"
                                            aria-label={$t(
                                                "profilePage.moreActions",
                                            ) || "More actions"}
                                        >
                                            <button
                                                class="more-actions-item destructive"
                                                type="button"
                                                role="menuitem"
                                                on:click={openReportModal}
                                            >
                                                <Icon
                                                    icon="ph:flag-bold"
                                                    width="18"
                                                />
                                                <span
                                                    >{$t("settingModal.report")
                                                        || "Report"}</span
                                                >
                                            </button>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>

                        <!-- CTA + Actions -->
                        <div class="cta-row">
                            <div class="primary-actions">
                                <button
                                    class="chat-start-button"
                                    on:click={handleStartChat}
                                >
                                    <Icon
                                        icon="ph:chat-circle-dots-duotone"
                                        width="22"
                                    />
                                    <span
                                        >{$t("profilePage.startChatButton")}</span
                                    >
                                </button>
                                <button
                                    class="like-heart-button"
                                    on:click={() => {
                                        if (persona) handleLike(persona);
                                    }}
                                    aria-label={$t("profilePage.likeButtonLabel")}
                                    aria-pressed={persona.is_liked}
                                >
                                    <span class="like-heart-shell">
                                        <span class="like-heart-icon">
                                            <Icon
                                                icon={persona.is_liked
                                                    ? "ph:heart-fill"
                                                    : "ph:heart"}
                                            />
                                        </span>
                                    </span>
                                </button>
                                {#if persona.visibility !== "private"}
                                    <button
                                        class="share-inline-button"
                                        on:click={handleShare}
                                        aria-label={$t("settingModal.share") ||
                                            "Share"}
                                        title={$t("settingModal.share") ||
                                            "Share"}
                                    >
                                        <Icon
                                            icon="ph:share-network-bold"
                                            width="20"
                                        />
                                    </button>
                                {/if}
                            </div>
                        </div>
                    </div>
                </section>

                <!-- ═══ Detail Section ═══ -->
                <section class="detail-section">
                    <!-- First Scene -->
                    {#if persona.first_scene}
                        <div class="first-scene-container">
                            {#if threeDSceneData}
                                <div class="scene-body">
                                    <div class="threed-data-wrapper">
                                        <div class="threed-chips">
                                            {#if threeDSceneData.current_emotion}
                                                <div class="data-chip emotion">
                                                        <span class="chip-label"
                                                            ><Icon
                                                                icon="ph:smiley-duotone"
                                                        />
                                                            {$t(
                                                                "profilePage.emotion",
                                                            )}</span
                                                        >
                                                    <span class="chip-value"
                                                        >{threeDSceneData.current_emotion}</span
                                                    >
                                                </div>
                                            {/if}
                                            {#if threeDSceneData.core_desire}
                                                <div class="data-chip desire">
                                                        <span class="chip-label"
                                                            ><Icon
                                                                icon="ph:target-duotone"
                                                        />
                                                            {$t(
                                                                "profilePage.desire",
                                                            )}</span
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
                                                        />
                                                        {$t(
                                                            "profilePage.personality",
                                                        )}</span
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
                                </div>
                            {:else}
                                <div class="scene-body scene-body-preview">
                                    {#if persona.first_scene === "<tr>"}
                                        <p class="scene-text">
                                            {$t("profilePage.translating")}
                                        </p>
                                    {:else}
                                        <div
                                            class="scene-preview-shell"
                                            class:is-collapsed={!showFirstScenePreview}
                                        >
                                            <div class="scene-preview-content">
                                                <FirstSceneChatPreview
                                                    {persona}
                                                    userName={getEffectiveUserName()}
                                                />
                                            </div>
                                            <button
                                                class="scene-preview-overlay"
                                                class:is-hidden={showFirstScenePreview}
                                                type="button"
                                                on:click={() =>
                                                    (showFirstScenePreview =
                                                        true)}
                                                aria-label={$t(
                                                    "profilePage.expandScenePreview",
                                                )}
                                            >
                                                <span
                                                    class="scene-preview-blur-layer blur-soft"
                                                    aria-hidden="true"
                                                ></span>
                                                <span
                                                    class="scene-preview-blur-layer blur-mid"
                                                    aria-hidden="true"
                                                ></span>
                                                <span
                                                    class="scene-preview-blur-layer blur-strong"
                                                    aria-hidden="true"
                                                ></span>
                                                <span
                                                    class="scene-preview-shade"
                                                    aria-hidden="true"
                                                ></span>
                                                <span
                                                    class="scene-preview-overlay-button"
                                                    aria-hidden="true"
                                                >
                                                    <Icon
                                                        icon="ph:caret-down-bold"
                                                        width="18"
                                                    />
                                                </span>
                                            </button>
                                        </div>
                                        {#if showFirstScenePreview}
                                            <div
                                                class="scene-preview-collapse-row"
                                            >
                                                <button
                                                    type="button"
                                                    class="scene-preview-collapse"
                                                    on:click={() =>
                                                        (showFirstScenePreview =
                                                            false)}
                                                    aria-label={$t(
                                                        "profilePage.collapseScenePreview",
                                                    )}
                                                >
                                                    <Icon
                                                        icon="ph:caret-up-bold"
                                                        width="18"
                                                    />
                                                </button>
                                            </div>
                                        {/if}
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/if}
                </section>

                <!-- Comments -->
                <section class="comments-section">
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
                            placeholder={$t("profilePage.commentPlaceholder")}
                        />
                        <button
                            class="comment-submit-button"
                            on:click={handlePostComment}
                            aria-label={$t("profilePage.registerButton")}
                        >
                            {$t("profilePage.registerButton")}
                        </button>
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
        color: var(--foreground);
        background: var(--card);
        padding: 0.25rem 0.6rem;
        border-radius: 999px;
        font-weight: 600;
        backdrop-filter: blur(4px);
        z-index: 10;
        border: 1px solid var(--border);
    }

    .image-counter-separator {
        width: 1px;
        height: 0.85rem;
        margin: 0 0.1rem;
        background: var(--border);
        border-radius: 999px;
    }

    .secret-indicator {
        position: absolute;
        top: 12px;
        left: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--secondary);
        color: var(--warning);
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 600;
        z-index: 10;
        backdrop-filter: blur(4px);
        border: 1px solid var(--border);
    }

    .nav-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: var(--card);
        color: var(--foreground);
        border: 1px solid var(--border);
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
        background: var(--secondary);
        border-color: var(--border-hover);
        transform: translateY(-50%) scale(1.1);
    }
    .nav-arrow.left {
        left: 12px;
    }
    .nav-arrow.right {
        right: 12px;
    }

    /* Thumbnail Strip */
    .thumbnail-strip {
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
        padding: 0.7rem max(0px, calc(50% - 66px)) 0.45rem;
        scrollbar-width: thin;
        scrollbar-color: var(--border) transparent;
        scroll-padding-inline: max(0px, calc(50% - 66px));
    }
    .thumbnail-strip::-webkit-scrollbar {
        height: 4px;
    }
    .thumbnail-strip::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 4px;
    }
    .thumb {
        width: auto;
        height: 76px;
        min-width: 58px;
        max-width: 132px;
        aspect-ratio: var(--thumb-ratio, 0.78);
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid transparent;
        cursor: pointer;
        flex-shrink: 0;
        padding: 0;
        background: var(--muted);
        transition:
            transform 0.22s ease,
            border-color 0.22s ease,
            box-shadow 0.22s ease,
            background-color 0.22s ease;
        position: relative;
    }

    .thumb.active {
        border-color: var(--primary);
        transform: translateY(-3px) scale(1.03);
        box-shadow:
            0 14px 26px rgba(15, 23, 42, 0.14),
            0 0 0 3px rgba(239, 123, 69, 0.32);
    }
    .thumb:hover:not(.active) {
        border-color: var(--border-hover);
    }
    .thumb-content {
        width: 100%;
        height: 100%;
        display: flex;
        pointer-events: none; /* Let button handle clicks */
    }

    /* Right: Hero Info */
    .hero-info {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding-top: 1rem;
    }
    .live2d-rights-notice {
        margin: 0.3rem 0 0.8rem;
        display: flex;
        align-items: flex-start;
        gap: 0.45rem;
        padding: 0.65rem 0.75rem;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--secondary);
        color: var(--foreground);
        font-size: 0.82rem;
        line-height: 1.35;
    }
    .live2d-rights-notice p {
        margin: 0;
    }

    .play-info-block {
        display: flex;
        flex-direction: column;
        gap: 0.72rem;
        margin-bottom: 1.15rem;
    }

    .play-info-label {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted-foreground);
    }

    .play-info-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
    }

    .play-info-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.42rem 0.82rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--card) 92%, transparent);
        color: var(--foreground);
        font-size: 0.83rem;
        font-weight: 600;
        line-height: 1;
    }

    .play-info-chip :global(svg) {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        color: var(--muted-foreground);
    }

    .play-info-chip-accent {
        color: var(--primary);
        border-color: color-mix(in srgb, var(--primary) 32%, var(--border));
        background: color-mix(in srgb, var(--primary) 12%, transparent);
    }

    .play-info-chip-accent :global(svg) {
        color: var(--primary);
    }

    .play-info-chip-adult {
        color: var(--destructive);
        border-color: color-mix(in srgb, var(--destructive) 28%, var(--border));
        background: color-mix(in srgb, var(--destructive) 12%, transparent);
    }

    .play-info-chip-adult :global(svg) {
        color: var(--destructive);
    }

    .play-info-chip-tech {
        color: var(--secondary-foreground);
        border-color: var(--border);
        background: color-mix(in srgb, var(--secondary) 88%, transparent);
    }

    .play-info-chip-tech :global(svg) {
        color: var(--secondary-foreground);
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
        background-color: color-mix(in srgb, var(--primary) 12%, transparent);
        color: var(--primary);
        border: 1px solid color-mix(in srgb, var(--primary) 28%, var(--border));
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

    /* ── Detail Section ── */
    .detail-section {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        position: relative;
        padding-top: 1.4rem;
    }

    .detail-section::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(
            90deg,
            transparent 0%,
            color-mix(in srgb, var(--border) 68%, transparent) 10%,
            color-mix(in srgb, var(--border) 100%, transparent) 50%,
            color-mix(in srgb, var(--border) 68%, transparent) 90%,
            transparent 100%
        );
    }

    /* First Scene */
    .first-scene-container {
        border: none;
        border-radius: 0;
        overflow: visible;
        background: transparent;
    }
    .scene-body {
        padding: 0;
        border-top: 1px solid var(--border);
    }

    .scene-body-preview {
        padding-bottom: 0;
    }

    .scene-preview-shell {
        position: relative;
        overflow: hidden;
        border-radius: 0;
        border: none;
        background: transparent;
        max-height: 1200px;
        transition:
            max-height 0.42s cubic-bezier(0.22, 1, 0.36, 1),
            border-color 0.25s ease;
    }

    .scene-preview-shell.is-collapsed {
        max-height: 176px;
    }

    .scene-preview-shell.is-collapsed .scene-preview-content {
        pointer-events: none;
        user-select: none;
    }

    .scene-preview-content {
        padding: 0;
    }

    .scene-preview-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 0.95rem 1rem;
        border: none;
        background: transparent;
        cursor: pointer;
        opacity: 1;
        transition:
            opacity 0.25s ease,
            visibility 0.25s ease;
    }

    .scene-preview-overlay.is-hidden {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
    }

    .scene-preview-blur-layer,
    .scene-preview-shade {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .scene-preview-blur-layer {
        background: color-mix(in srgb, var(--background) 4%, transparent);
    }

    .scene-preview-blur-layer.blur-soft {
        backdrop-filter: blur(1.5px);
        -webkit-backdrop-filter: blur(1.5px);
        mask-image: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.2) 0%,
            rgba(0, 0, 0, 0.42) 42%,
            rgba(0, 0, 0, 0.65) 100%
        );
        -webkit-mask-image: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.2) 0%,
            rgba(0, 0, 0, 0.42) 42%,
            rgba(0, 0, 0, 0.65) 100%
        );
    }

    .scene-preview-blur-layer.blur-mid {
        inset: 22% 0 0 0;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        mask-image: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.08) 0%,
            rgba(0, 0, 0, 0.4) 48%,
            rgba(0, 0, 0, 0.86) 100%
        );
        -webkit-mask-image: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.08) 0%,
            rgba(0, 0, 0, 0.4) 48%,
            rgba(0, 0, 0, 0.86) 100%
        );
    }

    .scene-preview-blur-layer.blur-strong {
        inset: 48% 0 0 0;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        mask-image: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.04) 0%,
            rgba(0, 0, 0, 0.46) 44%,
            rgba(0, 0, 0, 1) 100%
        );
        -webkit-mask-image: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.04) 0%,
            rgba(0, 0, 0, 0.46) 44%,
            rgba(0, 0, 0, 1) 100%
        );
    }

    .scene-preview-shade {
        background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--background) 2%, transparent) 0%,
            color-mix(in srgb, var(--background) 8%, transparent) 28%,
            color-mix(in srgb, var(--background) 18%, transparent) 52%,
            color-mix(in srgb, var(--background) 48%, transparent) 76%,
            color-mix(in srgb, var(--background) 88%, transparent) 100%
        );
    }

    .scene-preview-overlay-button {
        width: 42px;
        height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
        background: color-mix(in srgb, var(--card) 92%, transparent);
        color: var(--foreground);
        box-shadow: var(--shadow-sm);
        position: relative;
        z-index: 1;
    }

    .scene-preview-collapse-row {
        display: flex;
        justify-content: center;
        margin-top: 0.8rem;
    }

    .scene-preview-collapse {
        width: 40px;
        height: 40px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
        background: color-mix(in srgb, var(--card) 90%, transparent);
        color: var(--muted-foreground);
        cursor: pointer;
        transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            background-color 0.2s ease,
            color 0.2s ease;
    }

    .scene-preview-collapse:hover {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--primary) 32%, var(--border));
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        color: var(--foreground);
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
        background: transparent;
        border: none;
        border-radius: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        width: 100%;
    }
    .comments-title {
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--foreground);
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .comments-list {
        display: flex;
        flex-direction: column;
        gap: 0;
        margin-bottom: 0;
    }
    .comment-card {
        display: flex;
        gap: 1rem;
        padding: 1rem 0;
        background: transparent;
        border-radius: 0;
        border: none;
        border-bottom: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
        transition: border-color 0.2s;
    }
    .comment-card:hover {
        border-color: color-mix(in srgb, var(--border-hover) 90%, transparent);
    }
    .comment-card:first-child {
        padding-top: 0;
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
        padding: 0.75rem 0 1.2rem;
        background: transparent;
        border-radius: 0;
        border: none;
    }

    .comment-input-box {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-top: 0.4rem;
        background: transparent;
        padding: 0;
        border-radius: 0;
        border: none;
        transition: none;
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
    }
    .comment-input-box:focus-within {
        background: transparent;
        box-shadow: none;
    }
    .comment-input-box input {
        flex-grow: 1;
        width: 0;
        min-width: 0;
        min-height: 50px;
        background: var(--input) !important;
        border: 1px solid var(--border) !important;
        border-radius: 16px;
        outline: none !important;
        box-shadow: none !important;
        appearance: none;
        -webkit-appearance: none;
        color: var(--foreground);
        padding: 0 1rem;
        font-size: 0.95rem;
        transition:
            border-color 0.2s ease,
            background-color 0.2s ease;
    }
    .comment-input-box input::placeholder {
        color: var(--text-placeholder);
    }
    .comment-input-box input:focus {
        outline: none !important;
        box-shadow: none !important;
        border-color: var(--primary) !important;
        background: var(--input-focus) !important;
    }
    .comment-submit-button {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 64px;
        height: 50px;
        padding: 0 1rem;
        flex-shrink: 0;
        border-radius: 16px;
        background: var(--secondary);
        color: var(--foreground);
        border: 1px solid var(--border);
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        white-space: nowrap;
        transition:
            background 0.2s ease,
            border-color 0.2s ease,
            color 0.2s ease,
            transform 0.2s ease;
    }
    .comment-submit-button:hover {
        transform: translateY(-1px);
        background: var(--accent);
        border-color: var(--border-hover);
        color: var(--foreground);
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
        .comments-section {
            padding: 0;
        }
    }
    .scroll-container {
        --profile2-surface: var(--card);
        --profile2-surface-soft: color-mix(in srgb, var(--card) 92%, transparent);
        --profile2-surface-muted: color-mix(in srgb, var(--muted) 92%, transparent);
        --profile2-line: color-mix(in srgb, var(--border) 88%, transparent);
        --profile2-line-strong: color-mix(in srgb, var(--border-hover) 90%, transparent);
        --profile2-primary-soft: color-mix(in srgb, var(--primary) 12%, transparent);
        --profile2-primary-line: color-mix(in srgb, var(--primary) 32%, var(--border));
        --profile2-primary-glow: color-mix(in srgb, var(--primary) 24%, transparent);
        --profile2-danger-soft: color-mix(in srgb, var(--destructive) 12%, transparent);
        --profile2-danger-line: color-mix(in srgb, var(--destructive) 28%, var(--border));
        --profile2-warning-soft: color-mix(in srgb, var(--warning) 12%, transparent);
        --profile2-warning-line: color-mix(in srgb, var(--warning) 28%, var(--border));
        background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--background) 88%, var(--card) 12%),
            var(--background)
        );
    }

    .profile-page-wrapper {
        position: relative;
        padding: 2.5rem 1.5rem 4.5rem;
        overflow-y: auto;
        background: transparent;
    }

    .profile-container {
        max-width: 1220px;
        gap: 2.5rem;
    }

    .hero-section {
        grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
        gap: 2.5rem;
        align-items: start;
    }

    .hero-gallery {
        position: sticky;
        top: 1.25rem;
        gap: 1rem;
    }

    .image-gallery-wrapper,
    .hero-info,
    .first-scene-container,
    .comments-section {
        border: none;
        background: transparent;
        box-shadow: none;
        backdrop-filter: none;
    }

    .image-gallery-wrapper {
        aspect-ratio: 4 / 5;
        border-radius: 32px;
        background: var(--profile2-surface);
        border: 1px solid var(--profile2-line);
        box-shadow: var(--shadow-dialog);
    }

    .image-gallery-wrapper :global(.asset-preview-media),
    .image-gallery-wrapper :global(.video-container),
    .image-gallery-wrapper :global(.fallback),
    .thumb-content :global(.asset-preview-media),
    .thumb-content :global(.video-container),
    .thumb-content :global(.fallback) {
        width: 100%;
        height: 100%;
    }

    .image-counter {
        top: 1rem;
        right: 1rem;
        padding: 0.5rem 0.8rem;
        border-radius: 999px;
        background: var(--profile2-surface-soft);
        border-color: var(--profile2-line);
        color: var(--foreground);
    }

    .secret-indicator {
        top: 1rem;
        left: 1rem;
        padding: 0.55rem 0.85rem;
        background: var(--profile2-warning-soft);
        border-color: var(--profile2-warning-line);
        color: var(--warning);
    }

    .nav-arrow {
        opacity: 0.82;
        width: 44px;
        height: 44px;
        background: var(--profile2-surface-soft);
        color: var(--foreground);
        border-color: var(--profile2-line);
    }

    .image-gallery-wrapper:hover .nav-arrow,
    .nav-arrow:focus-visible {
        opacity: 1;
    }

    .thumbnail-strip {
        gap: 0.65rem;
        padding: 0.9rem max(0px, calc(50% - 86px)) 0.55rem;
        scroll-padding-inline: max(0px, calc(50% - 86px));
    }

    .thumb {
        width: auto;
        height: 98px;
        min-width: 72px;
        max-width: 172px;
        aspect-ratio: var(--thumb-ratio, 0.78);
        border-radius: 20px;
        border-width: 1px;
        background: var(--profile2-surface-muted);
    }

    .thumb.active {
        border-color: var(--primary);
        box-shadow:
            var(--shadow-card),
            0 0 0 4px var(--profile2-primary-glow);
    }

    .hero-info {
        padding: 0.3rem 0 0;
        justify-content: flex-start;
        align-items: stretch;
        align-self: stretch;
        text-align: left;
    }

    .play-info-block {
        gap: 0.78rem;
        margin-bottom: 1.2rem;
    }

    .play-info-label {
        color: var(--muted-foreground);
    }

    .play-info-chip {
        padding: 0.48rem 0.88rem;
        border-color: var(--profile2-line);
        background: var(--profile2-surface-soft);
        color: var(--foreground);
    }

    .play-info-chip :global(svg) {
        color: var(--muted-foreground);
    }

    .character-name {
        font-family: "Pretendard", "Noto Sans KR", sans-serif;
        font-size: clamp(1.95rem, 3.6vw, 3.25rem);
        line-height: 1.02;
        letter-spacing: -0.03em;
        margin-bottom: 0.65rem;
    }

    .one-liner {
        font-size: 1.14rem;
        line-height: 1.55;
        margin-bottom: 0.85rem;
        color: var(--foreground);
    }

    .creator-chip {
        display: inline-flex;
        align-items: center;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--muted-foreground);
        font-size: 0.92rem;
        font-weight: 600;
        line-height: 1.3;
        margin-bottom: 0.95rem;
        align-self: flex-start;
        cursor: pointer;
        transition: color 0.18s ease;
        white-space: nowrap;
    }

    .creator-chip:hover {
        color: var(--foreground);
    }

    .character-description {
        margin-bottom: 1.45rem;
        padding: 0.1rem 0 0.1rem 1rem;
        border-radius: 0;
        background: transparent;
        border: none;
        border-left: 1px solid var(--profile2-primary-line);
        color: var(--muted-foreground);
        line-height: 1.78;
        max-width: 62ch;
    }

    .live2d-rights-notice {
        margin-bottom: 1rem;
        padding: 0.1rem 0 0.1rem 0.05rem;
        border-radius: 0;
        background: transparent;
        border: none;
        color: var(--muted-foreground);
    }

    .tags-container {
        gap: 0.65rem;
        margin-bottom: 1.65rem;
        justify-content: flex-start;
    }

    .tag {
        padding: 0.35rem 0.75rem;
        font-weight: 700;
        border-radius: 999px;
    }

    .tag-category {
        color: var(--primary);
        background: var(--profile2-primary-soft);
        border-color: var(--profile2-primary-line);
    }

    .tag-regular {
        background: var(--profile2-surface-soft);
        border-color: var(--profile2-line);
        color: var(--muted-foreground);
    }

    .stats-row {
        flex-wrap: wrap;
        gap: 1rem;
        margin-bottom: 1.45rem;
        justify-content: flex-start;
        align-items: center;
        width: 100%;
        min-width: 0;
    }

    .stat-chip {
        padding: 0;
        border-radius: 0;
        background: transparent;
        border: none;
        color: var(--muted-foreground);
        box-shadow: none;
        gap: 0.45rem;
        flex: 0 0 auto;
        white-space: nowrap;
    }

    .stat-chip-labelled {
        align-items: baseline;
        gap: 0.55rem;
        white-space: nowrap;
    }

    .stat-label {
        font-size: 0.84rem;
        letter-spacing: 0.02em;
        color: var(--muted-foreground);
        white-space: nowrap;
    }

    .stat-value {
        font-size: 1.02rem;
        font-weight: 700;
        color: var(--foreground);
        white-space: nowrap;
    }

    .cta-row {
        align-items: flex-start;
        gap: 1.3rem 2rem;
        flex-wrap: wrap;
        margin-top: auto;
        padding-top: 1.4rem;
    }

    .primary-actions {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        flex-wrap: wrap;
    }

    .chat-start-button {
        max-width: none;
        min-width: 230px;
        border-radius: 999px;
        padding: 1rem 1.55rem;
        background: var(--primary-gradient);
        color: var(--primary-foreground);
        box-shadow: var(--shadow-card);
        animation: none;
    }

    .like-heart-button {
        width: 58px;
        height: 58px;
    }

    .like-heart-shell {
        position: relative;
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .like-heart-icon {
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .like-heart-icon :global(svg) {
        width: 100%;
        height: 100%;
        color: var(--destructive);
    }

    .like-heart-button[aria-pressed="false"] .like-heart-icon :global(svg) {
        color: var(--muted-foreground);
    }

    .like-heart-button,
    .share-inline-button,
    .more-actions-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border-radius: 999px;
        border: 1px solid var(--profile2-line);
        background: var(--profile2-surface-soft);
        color: var(--muted-foreground);
        cursor: pointer;
        transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            background-color 0.2s ease,
            color 0.2s ease;
    }

    .like-heart-button:hover,
    .share-inline-button:hover,
    .more-actions-button:hover,
    .more-actions-button[aria-expanded="true"] {
        transform: translateY(-1px);
        background: var(--profile2-primary-soft);
        border-color: var(--profile2-primary-line);
        color: var(--foreground);
    }

    .like-heart-button[aria-pressed="true"] {
        border-color: var(--profile2-danger-line);
        background: var(--profile2-danger-soft);
    }

    .share-inline-button,
    .more-actions-button {
        width: 58px;
        height: 58px;
        display: inline-flex;
        flex-shrink: 0;
    }

    .share-inline-button :global(svg),
    .more-actions-button :global(svg) {
        width: 20px;
        height: 20px;
    }

    .action-buttons {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        position: relative;
    }

    .stats-actions {
        margin-left: auto;
        padding-left: 0.4rem;
        flex-shrink: 0;
    }

    .more-actions {
        position: relative;
        display: flex;
        align-items: center;
    }

    .more-actions-button {
        width: 42px;
        height: 42px;
        border-radius: 14px;
        border-color: var(--profile2-line);
        color: var(--muted-foreground);
    }

    .more-actions-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .more-actions-ellipsis {
        display: none;
        font-size: 1rem;
        font-weight: 700;
        line-height: 1;
        letter-spacing: 0.12em;
    }

    .more-actions-menu {
        position: absolute;
        top: calc(100% + 0.7rem);
        right: 0;
        min-width: 148px;
        padding: 0.4rem;
        border-radius: 18px;
        border: 1px solid var(--profile2-line);
        background: var(--popover);
        box-shadow: var(--shadow-popover);
        backdrop-filter: blur(18px);
        z-index: 6;
    }

    .more-actions-item {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.78rem 0.84rem;
        border-radius: 12px;
        border: none;
        background: transparent;
        color: var(--foreground);
        font-size: 0.92rem;
        font-weight: 700;
        line-height: 1.2;
        text-align: left;
        white-space: nowrap;
        cursor: pointer;
        transition:
            background-color 0.2s ease,
            color 0.2s ease;
    }

    .more-actions-item:hover {
        background: color-mix(in srgb, var(--accent) 88%, transparent);
        color: var(--foreground);
    }

    .more-actions-item.destructive {
        color: var(--destructive);
    }

    .more-actions-item.destructive:hover {
        background: var(--profile2-danger-soft);
        color: var(--destructive);
    }

    .detail-section {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
        gap: 2.4rem;
        align-items: start;
    }

    .detail-section > *:only-child {
        grid-column: 1 / -1;
    }

    .first-scene-container {
        border-radius: 0;
        padding-top: 0;
        border-top: none;
    }

    .scene-body {
        padding: 0;
        border-top: none;
    }

    .scene-preview-shell,
    .threed-narrative {
        border-radius: 22px;
        border: 1px solid var(--profile2-line);
        background: var(--profile2-surface-soft);
    }

    .scene-preview-shell {
        border-radius: 0;
        border: none;
        background: transparent;
    }

    .scene-preview-shell.is-collapsed {
        max-height: 182px;
    }

    .scene-preview-content {
        padding: 0;
    }

    .scene-preview-overlay-button {
        background: var(--profile2-surface-soft);
        border-color: var(--profile2-line);
    }

    .scene-preview-collapse {
        border-color: var(--profile2-line);
        background: var(--profile2-surface-soft);
    }

    .data-chip {
        border-radius: 16px;
        background: transparent;
        border-color: var(--profile2-line);
    }

    .comments-section {
        padding: 0;
        border-top: none;
    }

    .comments-list {
        gap: 0;
        margin-bottom: 1.2rem;
    }

    .comment-card {
        padding: 1rem 0;
        border-radius: 0;
        background: transparent;
        border: none;
        border-bottom: 1px solid var(--profile2-line);
    }

    .comment-card:hover {
        background: transparent;
        border-color: var(--profile2-line-strong);
    }

    .no-comments {
        background: transparent;
        border: none;
        border-radius: 0;
        padding: 0.5rem 0 1.1rem;
    }

    .comment-input-box {
        border-radius: 0;
        padding: 0;
        background: transparent;
        border: none;
    }

    .comment-input-box:focus-within {
        box-shadow: none;
    }

    .comment-submit-button {
        border-radius: 16px;
        background: var(--secondary);
        box-shadow: none;
    }

    @media (max-width: 1100px) {
        .hero-section,
        .detail-section {
            grid-template-columns: 1fr;
        }

        .hero-gallery {
            position: static;
            max-width: 560px;
        }

        .hero-info {
            text-align: left;
        }
    }

    @media (max-width: 760px) {
        .profile-page-wrapper {
            padding: 1rem 0.85rem 2.4rem;
            margin-top: 0;
        }

        .hero-info {
            padding-top: 0.85rem;
        }

        .comment-input-box {
            gap: 0.6rem;
        }

        .comment-input-box input,
        .comment-submit-button {
            min-height: 46px;
            height: 46px;
            border-radius: 14px;
        }

        .comment-submit-button {
            min-width: 58px;
            padding: 0 0.9rem;
            font-size: 0.86rem;
        }

        .cta-row {
            flex-direction: column;
            align-items: stretch;
        }

        .stats-row {
            display: grid;
            grid-template-columns: max-content max-content minmax(0, 1fr) auto;
            column-gap: 0.85rem;
            row-gap: 0;
            align-items: center;
            width: 100%;
        }

        .stats-actions {
            grid-column: 4;
            justify-self: end;
            margin-left: 0;
            padding-left: 0;
        }

        .chat-start-button {
            width: 100%;
        }

        .primary-actions {
            width: 100%;
        }

        .stats-actions .more-actions-button {
            width: auto;
            height: auto;
            padding: 0 0.2rem;
            border: none;
            border-radius: 8px;
            background: transparent;
            color: var(--muted-foreground);
        }

        .stats-actions .more-actions-icon {
            display: none;
        }

        .stats-actions .more-actions-ellipsis {
            display: block;
        }
    }

    @media (max-width: 640px) {
        .profile-container {
            gap: 1.25rem;
        }

        .image-gallery-wrapper {
            aspect-ratio: 1 / 1.1;
            border-radius: 24px;
        }

        .nav-arrow {
            opacity: 1;
            width: 40px;
            height: 40px;
            background: var(--profile2-surface);
        }

        .thumbnail-strip {
            gap: 0.5rem;
            padding: 0.72rem max(0px, calc(50% - 68px)) 0.45rem;
            scroll-padding-inline: max(0px, calc(50% - 68px));
        }

        .thumb {
            width: auto;
            height: 80px;
            min-width: 58px;
            max-width: 136px;
            aspect-ratio: var(--thumb-ratio, 0.78);
            border-radius: 16px;
        }

        .hero-info {
            text-align: left;
        }

        .character-description {
            padding-left: 0.85rem;
        }

        .scene-preview-shell.is-collapsed {
            max-height: 164px;
        }

        .scene-preview-content {
            padding: 0.9rem 0.9rem 1rem;
        }

        .scene-preview-overlay {
            padding: 0.75rem 0.85rem;
        }

        .scene-preview-overlay-button {
            width: 38px;
            height: 38px;
        }

        .scene-preview-collapse {
            width: 36px;
            height: 36px;
        }

        .play-info-block,
        .creator-chip {
            align-self: flex-start;
        }

        .play-info-chips {
            justify-content: flex-start;
        }

        .character-name {
            font-size: clamp(1.78rem, 8.5vw, 2.5rem);
        }

        .comment-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.2rem;
        }

        .primary-actions {
            width: auto;
            gap: 0.75rem;
        }

        .stats-row {
            column-gap: 0.75rem;
        }

        .stats-actions {
            justify-self: end;
            padding-left: 0;
        }

        .stat-chip-labelled {
            gap: 0.4rem;
        }

        .stat-label {
            font-size: 0.79rem;
        }

        .stat-value {
            font-size: 0.98rem;
        }

        .like-heart-button,
        .share-inline-button,
        .more-actions-button {
            width: 52px;
            height: 52px;
        }

        .like-heart-shell,
        .like-heart-icon {
            width: 30px;
            height: 30px;
        }

        .stats-actions .more-actions-button {
            width: auto;
            height: auto;
            min-width: 0;
            padding: 0 0.15rem;
        }
    }
</style>


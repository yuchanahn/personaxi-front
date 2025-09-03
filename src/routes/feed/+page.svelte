<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount, onDestroy, tick } from "svelte";
    import type { ImageMetadata, Persona } from "$lib/types";
    import { writable } from "svelte/store";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { PORTRAIT_URL, API_BASE_URL } from "$lib/constants";
    import { loadContent, loadlikesdata } from "$lib/api/content";
    import { type AuctionPersona } from "$lib/services/auction";
    import { api } from "$lib/api";
    import { fetchAndSetAssetTypes } from "$lib/api/edit_persona";
    import AssetPreview from "$lib/components/AssetPreview.svelte";

    //TODO: 사용자가 끝에 다다르면, 또 새로운 정보를 부르거나, 다시 처음부터 나오게 하기.
    //TODO: 나중에 처리 해주기!

    let liveIds: string[] = [];
    let auctions: AuctionPersona[] = [];

    let contents = writable<Persona[]>([]);
    let currentImageIndices = new Map<string, number>();
    let imageInterval: ReturnType<typeof setInterval>;

    let activePersonaId: string | null = null;
    let observer: IntersectionObserver;
    let feedContainer: HTMLElement; // .feed-container 요소를 바인딩할 변수

    $: getBackgroundImage = (content: Persona): string => {
        let imageUrl = `${PORTRAIT_URL}${content.owner_id[0]}/${content.id}.portrait`;
        if (content.image_metadatas && content.image_metadatas.length > 0) {
            const currentIndex = currentImageIndices.get(content.id) || 0;
            if (content.image_metadatas[currentIndex]?.url) {
                imageUrl = content.image_metadatas[currentIndex].url;
            }
        }
        return `url(${imageUrl})`;
    };

    $: getCurrentAsset = (content: Persona): ImageMetadata => {
        let asset: ImageMetadata = {
            url: `${PORTRAIT_URL}${content.owner_id[0]}/${content.id}.portrait`,
            description: "portrait",
            type: "image", // 포트레이트는 항상 이미지이므로 미리 타입을 지정
        };
        if (content.image_metadatas && content.image_metadatas.length > 0) {
            const currentIndex = currentImageIndices.get(content.id) || 0;
            if (content.image_metadatas[currentIndex]) {
                asset = content.image_metadatas[currentIndex];
            }
        }
        return asset;
    };

    onMount(async () => {
        // 1. 서버에서 컨텐츠 데이터 로드
        const data = await loadContent();
        const likes: string[] = await loadlikesdata();

        // 2. [핵심] 각 컨텐츠의 image_metadatas 타입을 확인하고 결과를 기다림
        for (const p of data) {
            if (p.image_metadatas && p.image_metadatas.length > 0) {
                // portrait 이미지를 맨 앞에 추가하고, 타입 확인
                p.image_metadatas.unshift({
                    url: `${PORTRAIT_URL}${p.owner_id[0]}/${p.id}.portrait`,
                    description: "portrait",
                    type: "image", // 포트레이트는 항상 이미지이므로 미리 타입을 지정
                });
                // 나머지 에셋들의 타입 확인
                const otherAssets = p.image_metadatas.slice(1);
                const assetsWithType = await fetchAndSetAssetTypes(otherAssets);
                p.image_metadatas = [p.image_metadatas[0], ...assetsWithType];

                currentImageIndices.set(p.id, 0);
            }

            // 좋아요 정보 처리 (기존과 동일)
            if (likes) {
                likes.forEach((like) => {
                    if (like === p.id) {
                        p.is_liked = true;
                    }
                });
            }
        }

        // 3. 모든 처리가 끝난 데이터를 스토어에 할당
        contents.set(data);

        // Intersection Observer 등 나머지 로직은 기존과 동일하게 유지됩니다.
        await tick();
        const options = {
            root: feedContainer,
            threshold: 0.8,
        };
        observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("active");
                    activePersonaId = entry.target.id;
                } else {
                    entry.target.classList.remove("active");
                }
            });
        }, options);
        const reels = feedContainer.querySelectorAll(".reel");
        reels.forEach((reel) => observer.observe(reel));

        imageInterval = setInterval(() => {
            if (!activePersonaId) return;
            const activePersona = $contents.find(
                (p) => p.id === activePersonaId,
            );
            if (
                activePersona &&
                activePersona.image_metadatas &&
                activePersona.image_metadatas.length > 1
            ) {
                const newIndices = new Map(currentImageIndices);
                const currentIndex = newIndices.get(activePersonaId) || 0;
                const nextIndex =
                    (currentIndex + 1) % activePersona.image_metadatas.length;
                newIndices.set(activePersonaId, nextIndex);
                currentImageIndices = newIndices;
            }
        }, 5000);
    });

    onDestroy(() => {
        clearInterval(imageInterval);
        if (observer) {
            observer.disconnect();
        }
    });

    $: isLive = (id: string) => liveIds.includes(id);

    $: isAuctioning = (id: string) => {
        return auctions.some((auction) => auction.personaId === id);
    };

    function navigateToCharacter(content: Persona) {
        switch (content.personaType) {
            case "live":
                goto(`/live`);
                break;
            case "3D":
                if (isAuctioning(content.id)) {
                    goto(`/auction?c=${content.id}`);
                } else if (isLive(content.id)) {
                    goto(`/live?c=${content.id}`);
                } else {
                    goto(`/character?c=${content.id}`);
                }
                break;
            case "2D":
                goto(`/2d?c=${content.id}`);
                break;
            case "text":
                goto(`/chat`);
                break;
        }
    }

    async function FeedbackBtn(persona: Persona, isLikeAction: boolean) {
        const endpoint = isLikeAction ? "like" : "dislike";
        const url = `/api/persona/${endpoint}?id=${persona.id}`;

        try {
            const res = await api.get(url);

            if (res.ok) {
                // 성공적으로 좋아요/싫어요 처리됨
                contents.update((currentContents) => {
                    return currentContents.map((p) => {
                        if (p.id === persona.id) {
                            return {
                                ...p,
                                is_liked: isLikeAction,
                                likes_count: isLikeAction
                                    ? p.likes_count + 1
                                    : p.likes_count - 1,
                            };
                        }
                        return p;
                    });
                });
            } else if (res.status === 409) {
                // 이미 좋아요/싫어요를 누른 경우
                const errorData = await res.json();
                alert(
                    $t("feed.alreadyFeedback", {
                        values: { action: isLikeAction ? "좋아요" : "싫어요" },
                    }),
                );
            } else {
                // 기타 에러
                const errorData = await res.json();
                alert(
                    $t("feed.feedbackFailed", {
                        values: {
                            action: isLikeAction ? "좋아요" : "싫어요",
                            message: errorData.message || res.statusText,
                        },
                    }),
                );
            }
        } catch (error) {
            console.error("Network or other error:", error);
            alert($t("feed.unexpectedError"));
        }
    }
</script>

<div class="feed-container" bind:this={feedContainer}>
    {#each $contents as content (content.id)}
        <section id={content.id} class="reel">
            <AssetPreview asset={getCurrentAsset(content)} />
            <div class="overlay">
                <div class="info-box">
                    <div class="creator-line">
                        <span class="creator-name">@{content.creator_name}</span
                        >
                    </div>

                    <div class="name-line">
                        <strong class="name">{content.name}</strong>
                    </div>

                    {#if content.greeting}
                        <p class="first-scene">
                            "{content.greeting.slice(0, 80)}{content.greeting
                                .length > 80
                                ? "..."
                                : ""}"
                        </p>
                    {/if}

                    <div class="tags-line"></div>
                </div>

                <div class="action-sidebar">
                    <button
                        class="action-button"
                        on:click={() => navigateToCharacter(content)}
                    >
                        <Icon
                            icon="ph:chat-circle-dots-duotone"
                            width="32"
                            height="32"
                        />
                        <span class="action-label">{$t("feed.interact")}</span>
                    </button>
                    <button
                        class="action-button"
                        on:click={() => FeedbackBtn(content, true)}
                        disabled={content.is_liked}
                    >
                        <Icon
                            icon={content.is_liked
                                ? "ph:heart-fill"
                                : "ph:heart-duotone"}
                            width="32"
                            height="32"
                        />
                        <span class="action-label">{content.likes_count}</span>
                    </button>
                    <!-- <button
                        class="action-button"
                        on:click={() => FeedbackBtn(content, false)}
                        disabled={!content.is_liked}
                    >
                        <Icon
                            icon={!content.is_liked
                                ? "ph:heart-break-fill"
                                : "ph:heart-break-duotone"}
                            width="32"
                            height="32"
                        />
                        <span class="action-label"
                            >{content.dislikes_count}</span
                        >
                    </button> -->
                    <!-- <button class="action-button">
                        <Icon icon="ph:eye-duotone" width="32" height="32" />
                        <span class="action-label">{content.feedback.view}</span
                        >
                    </button> -->
                    <button
                        class="action-button"
                        on:click={() => navigateToCharacter(content)}
                    >
                        <Icon icon="ph:eye-duotone" width="32" height="32" />
                        <span class="action-label">{content.chat_count}</span>
                    </button>
                </div>
            </div>
        </section>
    {/each}
</div>

<style>
    /* 전체 피드 컨테이너 */
    .feed-container {
        width: 100%;
        height: 100dvh;
        overflow-y: scroll;
        scroll-snap-type: y mandatory;
        background-color: #121212;
        scrollbar-width: none;
    }

    .feed-container::-webkit-scrollbar {
        display: none;
    }

    .reel {
        width: 100%;
        height: 96%;
        scroll-snap-align: start;
        position: relative;
        background-size: cover;
        background-position: center;
        color: white;
        transition: background-image 0.5s ease-in-out;
    }
    .reel::after {
        content: "";
        position: absolute;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        width: 30px;
        height: 4px;
        background: rgba(255, 255, 255, 0.5);
        border-radius: 2px;
        animation: bounce 2s infinite;
    }

    @keyframes bounce {
        0%,
        20%,
        50%,
        80%,
        100% {
            transform: translateX(-50%) translateY(0);
        }
        40% {
            transform: translateX(-50%) translateY(-5px);
        }
        60% {
            transform: translateX(-50%) translateY(-3px);
        }
    }
    /* 정보 오버레이 */
    .overlay {
        position: absolute;
        inset: 0;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        padding: 1rem 1rem 3rem 1rem;
        background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.8) 0%,
            rgba(0, 0, 0, 0) 50%
        );
    }

    .creator-line {
        font-size: 1rem;
        font-weight: 500;
        background-color: rgba(0, 0, 0, 0.3);
        padding: 0.2rem 0.6rem;
        border-radius: 8px;
        width: fit-content;
    }

    .info-box,
    .action-sidebar {
        opacity: 0;
        transition:
            opacity 0.5s ease-out,
            transform 0.5s ease-out;
    }
    .info-box {
        transform: translateY(20px);
        /* ▼▼▼ 빠진 내용 추가 ▼▼▼ */
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
    }
    .action-sidebar {
        transform: translateX(20px);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
    }

    .reel:global(.active) .info-box,
    .reel:global(.active) .action-sidebar {
        opacity: 1;
        transform: translate(0, 0);
    }

    .name-line {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .name {
        font-size: 1.8rem;
        font-weight: bold;
    }
    .first-scene {
        font-style: italic;
        color: #e0e0e0;
        max-width: 500px;
        line-height: 1.4;
    }
    .tags-line {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    /* 액션 버튼 사이드바 */
    .action-button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
        padding: 0;
        transition: transform 0.2s ease;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
    }
    .action-button:hover {
        transform: scale(1.1);
    }
    .action-label {
        font-size: 0.9rem;
        font-weight: 500;
    }
</style>

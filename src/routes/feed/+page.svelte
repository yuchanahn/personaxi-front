<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount, onDestroy, tick } from "svelte";
    import type { Persona } from "$lib/types";
    import { writable } from "svelte/store";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { PORTRAIT_URL, API_BASE_URL } from "$lib/constants";
    import { loadContent, loadlikesdata } from "$lib/api/content";
    import { type AuctionPersona } from "$lib/services/auction";

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

    onMount(async () => {
        const data = await loadContent();
        const likes: string[] = await loadlikesdata();
        data.forEach((p: Persona) => {
            if (p.image_metadatas && p.image_metadatas.length > 0) {
                currentImageIndices.set(p.id, 0);
                p.image_metadatas.unshift({
                    url: `${PORTRAIT_URL}${p.owner_id[0]}/${p.id}.portrait`,
                    description: "",
                });
            }
            if (likes) {
                likes.forEach((like) => {
                    if (like === p.id) {
                        p.is_liked = true;
                    }
                });
            }
        });
        contents.set(data);

        await tick();

        const options = {
            root: feedContainer, // 바인딩된 feedContainer를 root로 사용
            threshold: 0.8,
        };

        observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("active");
                    activePersonaId = entry.target.id;

                    console.log("CLASS : " + entry.target.classList);
                } else {
                    entry.target.classList.remove("active");
                }
            });
        }, options);

        const reels = feedContainer.querySelectorAll(".reel");
        reels.forEach((reel) => observer.observe(reel));

        // 인터벌 로직은 동일
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
        const url = `${API_BASE_URL}/api/persona/${endpoint}?id=${persona.id}`;

        try {
            const res = await fetch(url, {
                credentials: "include",
            });

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
        <section
            id={content.id}
            class="reel"
            style="background-image: {getBackgroundImage(content)};"
        >
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
        height: 100vh;
        overflow-y: scroll;
        scroll-snap-type: y mandatory;
        background-color: #121212;
        scrollbar-width: none;
    }
    .feed-container::-webkit-scrollbar {
        display: none;
    }

    /* 개별 캐릭터 릴 */
    .reel {
        width: 100%;
        height: 100vh;
        scroll-snap-align: start;
        position: relative;
        background-size: cover;
        background-position: center;
        color: white;
        /* 배경 이미지 전환 시 부드러운 효과 */
        transition: background-image 0.5s ease-in-out;
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
    .tag {
        background-color: rgba(255, 255, 255, 0.2);
        padding: 0.25rem 0.6rem;
        border-radius: 12px;
        font-size: 0.85rem;
    }

    /* 뱃지 */
    .badge {
        font-size: 0.75rem;
        font-weight: bold;
        padding: 0.2rem 0.5rem;
        border-radius: 6px;
        color: white;
    }
    .badge.live {
        background-color: #e91e63;
    }
    .badge.auction {
        background-color: #3f51b5;
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

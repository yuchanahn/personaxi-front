<script lang="ts">
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import { get, writable } from "svelte/store";
    import type { PersonaDTO, CreatorProfileDTO } from "$lib/types";
    import CharacterCard from "$lib/components/card/CharacterCard.svelte";
    import { t } from "svelte-i18n";
    import { api } from "$lib/api";
    import { goto } from "$app/navigation";
    import {
        followUser,
        unfollowUser,
        checkFollowStatus,
        getFollowers,
    } from "$lib/api/user";
    import { st_user } from "$lib/stores/user";

    let profile = writable<CreatorProfileDTO | null>(null);
    let isLoading = writable(true);
    let error = writable<string | null>(null);
    let isFollowing = writable(false);
    let followerCount = writable(0);

    type SortOption = "likes" | "name" | "chats";
    let sortOrder = writable<SortOption>("likes");

    let creatorId: string | null = null;

    $: creatorId = $page.url.searchParams.get("c");

    // Fetch Creator Profile
    $: if (creatorId) {
        isLoading.set(true);
        error.set(null);
        api.get2(`/api/creator/info?id=${creatorId}`)
            .then(async (res) => {
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(
                        errorData.error || "Failed to load creator profile.",
                    );
                }
                return res.json();
            })
            .then((data: CreatorProfileDTO) => {
                profile.set(data);
                // Fetch follower count
                return getFollowers(creatorId!);
            })
            .then((followers) => {
                followerCount.set(followers.length);
            })
            .catch((e) => {
                error.set(e.message);
            })
            .finally(() => {
                isLoading.set(false);
            });
    }

    // Check Follow Status (Reactive to user login state)
    $: if (creatorId && $st_user) {
        console.log(
            "Checking follow status for:",
            creatorId,
            "User:",
            $st_user,
        );
        checkFollowStatus(creatorId).then((status) => {
            console.log("Follow status result:", status);
            isFollowing.set(status);
        });
    } else {
        console.log(
            "Skipping follow check. CreatorId:",
            creatorId,
            "User:",
            $st_user,
        );
        isFollowing.set(false);
    }

    async function toggleFollow() {
        if (!$st_user) {
            alert($t("common.loginRequired"));
            return;
        }

        if (!creatorId) return;

        try {
            if ($isFollowing) {
                const success = await unfollowUser(creatorId);
                if (success) {
                    isFollowing.set(false);
                    followerCount.update((n) => Math.max(0, n - 1));
                }
            } else {
                const success = await followUser(creatorId);
                if (success) {
                    isFollowing.set(true);
                    followerCount.update((n) => n + 1);
                }
            }
        } catch (err) {
            console.error("Follow toggle failed", err);
            alert("Failed to update follow status");
        }
    }

    $: sortedPersonas = (() => {
        if (!$profile) return [];

        const personas = [...($profile.personas || [])];
        const order = $sortOrder; // 스토어 값을 직접 참조

        return personas.sort((a, b) => {
            if (order === "likes") {
                return b.likes_count - a.likes_count;
            }
            if (order === "chats") {
                return b.chat_count - a.chat_count;
            }
            if (order === "name") {
                return a.name.localeCompare(b.name);
            }
            return 0;
        });
    })();

    function handleCardClick(content: PersonaDTO) {
        goto(`/profile?c=${content.id}`);
    }
</script>

<div class="page-wrapper">
    {#if $isLoading}
        <div class="center-message">Loading creator profile...</div>
    {:else if $error}
        <div class="center-message error">Error: {$error}</div>
    {:else if $profile}
        <!-- 제작자 정보 헤더 -->
        <div class="creator-header">
            <div class="creator-info">
                <img
                    src={$profile.creator.portrait_url ||
                        "https://placehold.co/128x128/1a1a1a/ffffff?text=" +
                            $profile.creator.name.charAt(0)}
                    alt={$profile.creator.name}
                    class="creator-portrait"
                />
                <div class="creator-details">
                    <h1 class="creator-name">{$profile.creator.name}</h1>
                    <div class="stats-row">
                        <p class="creator-persona-count">
                            {$profile.personas?.length || 0}
                            {$t("creatorPage.personas")}
                        </p>
                        <span class="divider">•</span>
                        <p class="creator-follower-count">
                            {$followerCount} Followers
                        </p>
                    </div>
                </div>
            </div>
            <button
                class="follow-button"
                class:following={$isFollowing}
                on:click={toggleFollow}
            >
                {$isFollowing ? "Unfollow" : $t("creatorPage.follow")}
            </button>
        </div>

        <div class="hub-container">
            <div class="sort-controls">
                <button
                    class:active={$sortOrder === "likes"}
                    on:click={() => sortOrder.set("likes")}
                >
                    {$t("creatorPage.sortByLikes")}
                </button>
                <button
                    class:active={$sortOrder === "chats"}
                    on:click={() => sortOrder.set("chats")}
                >
                    {$t("creatorPage.sortByChats")}
                </button>
                <button
                    class:active={$sortOrder === "name"}
                    on:click={() => sortOrder.set("name")}
                >
                    {$t("creatorPage.sortByName")}
                </button>
            </div>
            <!-- isLive={() => false}
                        isAuctioning={() => false} -->
            <div class="content-grid">
                {#each sortedPersonas as content (content.id)}
                    <CharacterCard
                        {content}
                        on:click={() => handleCardClick(content)}
                    />
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .page-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--background);
        color: var(--foreground);
    }
    .center-message {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        font-size: 1.2rem;
        color: var(--muted-foreground);
    }
    .center-message.error {
        color: var(--destructive);
    }

    /* Creator Header */
    .creator-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 2rem 2.5rem;
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
    }
    .creator-info {
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }
    .creator-portrait {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid var(--border);
    }
    .creator-details {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .creator-name {
        font-size: 2rem;
        font-weight: 700;
        margin: 0;
    }
    .stats-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1rem;
        color: var(--muted-foreground);
    }
    .divider {
        color: var(--border);
    }
    .follow-button {
        background-color: var(--primary);
        color: var(--primary-foreground);
        border: none;
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        font-weight: 600;
        border-radius: var(--radius-button);
        cursor: pointer;
        transition: all 0.2s;
        min-width: 100px;
    }
    .follow-button:hover {
        background-color: var(--primary-hover);
    }
    .follow-button.following {
        background-color: var(--muted);
        color: var(--foreground);
        border: 1px solid var(--border);
    }
    .follow-button.following:hover {
        background-color: var(--destructive);
        color: var(--destructive-foreground);
        border-color: var(--destructive);
    }

    /* Content Area */
    .hub-container {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem 2.5rem;
    }
    .sort-controls {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
    }
    .sort-controls button {
        padding: 0.4rem 0.8rem;
        font-size: 0.8rem;
        font-weight: 500;
        background-color: var(--muted);
        color: var(--muted-foreground);
        border: 1px solid var(--border);
        border-radius: var(--radius-button);
        cursor: pointer;
        transition: all 0.2s ease-in-out;
    }
    .sort-controls button.active {
        background-color: var(--secondary);
        color: var(--secondary-foreground);
        border-color: var(--secondary);
    }
    .content-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1.5rem;
    }

    /* Responsive */
    @media (max-width: 768px) {
        .creator-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1.5rem;
            padding: 1.5rem;
        }
        .hub-container {
            padding: 1rem; /* 전체적인 패딩을 살짝 조정 */
        }
        .content-grid {
            /* 이 부분이 핵심! HUB처럼 3열로 고정하고 간격을 줄였어 */
            grid-template-columns: repeat(3, 1fr);
            gap: 0.75rem;
        }
    }
</style>

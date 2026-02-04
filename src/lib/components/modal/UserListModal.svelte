<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { fade, scale } from "svelte/transition";
    import { goto } from "$app/navigation";
    import Icon from "@iconify/svelte";
    import { t } from "svelte-i18n";
    import {
        getFollowers,
        getFollowing,
        followUser,
        unfollowUser,
        checkFollowStatus,
    } from "$lib/api/user";
    import { api } from "$lib/api";
    import { st_user } from "$lib/stores/user";

    export let isOpen = false;
    export let initialTab: "followers" | "following" = "followers";
    export let userId: string;

    const dispatch = createEventDispatcher();

    let activeTab = initialTab;
    let users: any[] = [];
    let isLoading = false;
    let error: string | null = null;

    // Cache for follow status of displayed users
    let followStatus: Record<string, boolean> = {};

    $: if (isOpen) {
        activeTab = initialTab;
        loadUsers();
    }

    $: if (activeTab) {
        if (isOpen) loadUsers();
    }

    async function loadUsers() {
        isLoading = true;
        error = null;
        users = [];
        try {
            let ids: string[] = [];
            if (activeTab === "followers") {
                ids = await getFollowers(userId);
            } else {
                ids = await getFollowing(userId);
            }

            if (ids.length > 0) {
                const userPromises = ids.map(async (id) => {
                    try {
                        const res = await api.get2(
                            `/api/creator/info?id=${id}`,
                        );
                        if (res.ok) {
                            const data = await res.json();
                            return {
                                id: id,
                                name: data.creator.name,
                                portrait_url: data.creator.portrait_url,
                            };
                        }
                    } catch (e) {
                        console.error(`Failed to load user ${id}`, e);
                    }
                    return null;
                });

                const results = await Promise.all(userPromises);
                users = results.filter((u) => u !== null);

                // Check follow status for current user
                if ($st_user) {
                    // Optimization: If viewing my own following list, everyone is followed.
                    if (userId === $st_user.id && activeTab === "following") {
                        users.forEach((u) => (followStatus[u.id] = true));
                    } else {
                        // Otherwise, fetch my following list to check status efficiently
                        // Instead of N calls to checkFollowStatus, we fetch my following list once.
                        // Note: If the following list is huge, this might be heavy, but better than N calls for now.
                        // Ideally backend should return "is_following" field in the user list.
                        const myFollowing = await getFollowing($st_user.id);
                        const myFollowingSet = new Set(myFollowing);

                        users.forEach((u) => {
                            followStatus[u.id] = myFollowingSet.has(u.id);
                        });
                    }
                }
            }
        } catch (e: any) {
            error = e.message;
        } finally {
            isLoading = false;
        }
    }

    async function toggleFollow(targetId: string) {
        if (!$st_user) return;

        const isFollowing = followStatus[targetId];
        try {
            let success = false;
            if (isFollowing) {
                success = await unfollowUser(targetId);
            } else {
                success = await followUser(targetId);
            }

            if (success) {
                followStatus[targetId] = !isFollowing;
                // If we are in "following" tab and unfollow, maybe remove from list?
                // For now, let's keep it to avoid UI jumping, just update button state.
            }
        } catch (e) {
            console.error("Failed to toggle follow", e);
        }
    }

    function close() {
        isOpen = false;
        dispatch("close");
    }
</script>

{#if isOpen}
    <div
        class="modal-backdrop"
        on:click={close}
        transition:fade={{ duration: 200 }}
    >
        <div
            class="modal-content"
            on:click|stopPropagation
            transition:scale={{ duration: 200, start: 0.95 }}
        >
            <div class="modal-header">
                <div class="tabs">
                    <button
                        class:active={activeTab === "followers"}
                        on:click={() => (activeTab = "followers")}
                    >
                        Followers
                    </button>
                    <button
                        class:active={activeTab === "following"}
                        on:click={() => (activeTab = "following")}
                    >
                        Following
                    </button>
                </div>
                <button class="close-btn" on:click={close}>
                    <Icon icon="ri:close-line" width="24" height="24" />
                </button>
            </div>

            <div class="modal-body">
                {#if isLoading}
                    <div class="loading">Loading...</div>
                {:else if error}
                    <div class="error">{error}</div>
                {:else if users.length === 0}
                    <div class="empty">No users found.</div>
                {:else}
                    <div class="user-list">
                        {#each users as user (user.id)}
                            <div class="user-item">
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div
                                    class="user-info"
                                    on:click={() => {
                                        goto(`/creator?c=${user.id}`);
                                        close();
                                    }}
                                >
                                    <img
                                        src={user.portrait_url ||
                                            `https://placehold.co/40x40/1a1a1a/ffffff?text=${user.name.charAt(0)}`}
                                        alt={user.name}
                                        class="avatar"
                                    />
                                    <span class="name">{user.name}</span>
                                </div>
                                {#if $st_user && $st_user.id !== user.id}
                                    <button
                                        class="follow-btn"
                                        class:following={followStatus[user.id]}
                                        on:click={() => toggleFollow(user.id)}
                                    >
                                        {followStatus[user.id]
                                            ? "Unfollow"
                                            : "Follow"}
                                    </button>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }

    .modal-content {
        background: var(--card);
        width: 90%;
        max-width: 400px;
        max-height: 80vh;
        border-radius: var(--radius-card);
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: var(--shadow-popover);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid var(--border);
    }

    .tabs {
        display: flex;
        gap: 1rem;
    }

    .tabs button {
        background: none;
        border: none;
        font-size: 1rem;
        font-weight: 600;
        color: var(--muted-foreground);
        cursor: pointer;
        padding-bottom: 0.25rem;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
    }

    .tabs button.active {
        color: var(--foreground);
        border-bottom-color: var(--primary);
    }

    .close-btn {
        background: none;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .close-btn:hover {
        background: var(--muted);
        color: var(--foreground);
    }

    .modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
    }

    .loading,
    .error,
    .empty {
        text-align: center;
        color: var(--muted-foreground);
        padding: 2rem 0;
    }

    .error {
        color: var(--destructive);
    }

    .user-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .user-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem;
        border-radius: var(--radius-input);
        transition: background-color 0.2s;
    }

    .user-item:hover {
        background-color: var(--muted);
    }

    .user-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
    }

    .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid var(--border);
    }

    .name {
        font-weight: 500;
        font-size: 0.95rem;
    }

    .follow-btn {
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        padding: 0.4rem 0.8rem;
        border-radius: var(--radius-button);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .follow-btn:hover {
        background: var(--primary-hover);
    }

    .follow-btn.following {
        background: var(--muted);
        color: var(--foreground);
        border: 1px solid var(--border);
    }

    .follow-btn.following:hover {
        background: var(--destructive);
        color: var(--destructive-foreground);
        border-color: var(--destructive);
    }
</style>

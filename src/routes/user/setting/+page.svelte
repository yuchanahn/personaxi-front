<script lang="ts">
    import { PORTRAIT_URL } from "$lib/constants";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import type { Persona } from "$lib/types";
    import { getCurrentUser } from "$lib/api/auth";
    import { logout } from "$lib/stores/auth";
    import { fetchLivePersonas, setLiveStatus } from "$lib/services/live";
    import { locale, t } from "svelte-i18n";
    import AuctionModal from "$lib/components/modal/AuctionModal.svelte";
    import PointConvertModal from "$lib/components/modal/PointConvertModal.svelte";
    import NeedMoreNeuronsModal from "$lib/components/modal/NeedMoreNeuronsModal.svelte";
    import NeuronIcon from "$lib/components/icons/NeuronIcon.svelte";
    import { get } from "svelte/store";
    import type { User } from "$lib/types";
    import Icon from "@iconify/svelte";
    import { api } from "$lib/api";
    import { toast } from "$lib/stores/toast";
    import {
        getUploadUrl,
        uploadFileWithProgress,
    } from "$lib/api/edit_persona";
    import { st_user } from "$lib/stores/user";
    import { chatSessions } from "$lib/stores/chatSessions";

    const supabaseURL = "/storage/v1/object/public/personaxi-assets/";

    let user = {
        id: "",
        name: "",
        credits: 0,
        gender: "",
        plan: "",
        profile: "",
        email: "",
        state: "",
        data: {
            nickname: "",
            language: "",
            lastLoginAt: "",
            createdAt: "",
            hasReceivedFirstCreationReward: false,
            lastLoginIP: "",
        },
    } as User;

    let personas: Persona[] = [];
    let error = "";
    let liveIds: string[] = [];

    let showAuctionModal = false;
    let showPointConvertModal = false;

    async function handleConvertConfirm(e: CustomEvent) {
        const amount = e.detail.amount;
        try {
            await api.convertPoints(amount);

            const $t = get(t); // Access store value
            toast.success($t("pointConvertModal.success"));

            // Refresh user data
            const userRes = await getCurrentUser();
            if (userRes) user = userRes as User;
        } catch (err: any) {
            const $t = get(t);
            toast.error(
                $t("pointConvertModal.fail", {
                    values: { error: err.message },
                }),
            );
        }
    }

    let selectedPersona: Persona | null = null;

    let isEditingProfile = false;
    let originalUser: User | null = null;

    onMount(async () => {
        try {
            const userRes = await getCurrentUser();
            if (userRes) {
                user = userRes as User;
                notificationStore.init(user.id);

                if (!user.data || user.data.language === "") {
                    user.data = {
                        nickname: user.name,
                        language: get(locale) || "",
                        lastLoginAt: "",
                        createdAt: "",
                        hasReceivedFirstCreationReward: false,
                        lastLoginIP: "",
                    };

                    console.log(
                        "language data missing, set default:",
                        user.data.language,
                    );

                    settings.update((s) => {
                        s.language = (user.data.language as Language) || "en";
                        return { ...s };
                    });
                }
            } else {
                error = "Failed to load user";
                goto("/login");
            }

            const personasRes = await api.get(`/api/persona/user`);
            if (personasRes.ok) {
                personas = await personasRes.json();
            } else {
                error = "Failed to load personas";
            }

            const liveRes = await fetchLivePersonas();
            liveIds = liveRes.map((x) => x);
        } catch (err) {
            error = "Error: " + err;
        }
    });

    $: currentLiveIds = liveIds;

    function isLive(id: string) {
        return liveIds.includes(id);
    }

    async function toggleLive(personaId: string) {
        const now = isLive(personaId);
        await setLiveStatus(personaId, !now);
        liveIds = now
            ? liveIds.filter((id) => id !== personaId)
            : [...liveIds, personaId];
    }

    // --- 🔽 페르소나 공개/비공개 상태 변경 함수 🔽 ---
    async function toggleVisibility(persona: Persona) {
        // 현재 상태의 반대 상태를 newVisibility로 설정
        const newVisibility =
            persona.visibility === "public" ? "private" : "public";

        try {
            const res = await api.post(`/api/persona/visibility`, {
                personaId: persona.id,
                visibility: newVisibility,
            });

            if (res.ok) {
                // API 호출이 성공하면, 화면에 바로 반영
                const updatedPersonas = personas.map((p) => {
                    if (p.id === persona.id) {
                        return { ...p, visibility: newVisibility };
                    }
                    return p;
                });
                personas = updatedPersonas;
                error = "";
            } else {
                const errorText = await res.text();
                error = `Failed to update visibility: ${errorText}`;
            }
        } catch (err) {
            error = "Error updating visibility: " + err;
        }
    }

    function openAuctionModal(p: Persona) {
        selectedPersona = p;
        showAuctionModal = true;
    }

    let paymentModalOpen = false;

    function handleModalClose() {
        paymentModalOpen = false;
    }

    interface UserSettingRequest {
        name: string;
        nickname: string;
        language: string;
        profile: string;
    }

    function startEditing() {
        originalUser = JSON.parse(JSON.stringify(user));
        isEditingProfile = true;
    }

    function cancelEditing() {
        if (originalUser) {
            user = originalUser;
        }
        isEditingProfile = false;
    }

    async function handleProfileUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        try {
            // 1. Get Upload URL
            // Only delete if it's NOT the original file (i.e. it's a temp file)
            const isTemp = user.profile !== originalUser?.profile;
            const oldUrl =
                user.profile && !user.profile.startsWith("blob:") && isTemp
                    ? user.profile
                    : undefined;
            const response = await getUploadUrl("user_profile", oldUrl);
            const { signedURL, fileName } = await response.json();

            // 2. Upload File
            await uploadFileWithProgress(signedURL, file, (percent) => {
                console.log(`Upload progress: ${percent}%`);
            });

            // 3. Update User State (Preview)
            user.profile = `${supabaseURL}${fileName}`;
        } catch (err) {
            console.error("Failed to upload profile image:", err);
            error = "Failed to upload profile image";
        }
    }

    async function saveProfileChanges() {
        const settingRq: UserSettingRequest = {
            name: user.name,
            nickname: user.data.nickname || "",
            language: get(locale) || "en",
            profile: user.profile,
        };

        try {
            const res = await api.post(`/api/user/edit`, settingRq);

            if (res.ok) {
                isEditingProfile = false;
                error = "";
            } else {
                const errorText = await res.text();
                error = `Failed to update user settings: ${errorText}`;
            }
        } catch (err) {
            error = "Error updating settings: " + err;
        }
    }

    import SettingsModal from "$lib/components/modal/UserSettingsModal.svelte";
    import { settings, type Language } from "$lib/stores/settings";
    import AssetPreview from "$lib/components/AssetPreview.svelte";
    import NotificationDrawer from "$lib/components/notification/NotificationDrawer.svelte";
    import { notificationStore } from "$lib/stores/notification";
    import UserListModal from "$lib/components/modal/UserListModal.svelte";
    import { getFollowers, getFollowing } from "$lib/api/user";

    let showSettingsModal = false;
    let isNotificationDrawerOpen = false;
    const { unreadCount } = notificationStore;

    let showUserListModal = false;
    let userListTab: "followers" | "following" = "followers";
    let followerCount = 0;
    let followingCount = 0;

    onMount(async () => {
        try {
            const userRes = await getCurrentUser();
            if (userRes) {
                user = userRes as User;
                notificationStore.init(user.id);

                // Load follow stats
                getFollowers(user.id).then(
                    (ids) => (followerCount = ids.length),
                );
                getFollowing(user.id).then(
                    (ids) => (followingCount = ids.length),
                );

                if (!user.data || user.data.language === "") {
                    // ... existing logic ...
                    user.data = {
                        nickname: user.name,
                        language: get(locale) || "",
                        lastLoginAt: "",
                        createdAt: "",
                        hasReceivedFirstCreationReward: false,
                        lastLoginIP: "",
                    };
                    // ...
                    settings.update((s) => {
                        s.language = (user.data.language as Language) || "en";
                        return { ...s };
                    });
                }
            } else {
                error = "Failed to load user";
                goto("/login");
            }

            // ... existing logic ...
            const personasRes = await api.get(`/api/persona/user`);
            if (personasRes.ok) {
                personas = await personasRes.json();
            } else {
                error = "Failed to load personas";
            }

            const liveRes = await fetchLivePersonas();
            liveIds = liveRes.map((x) => x);
        } catch (err) {
            error = "Error: " + err;
        }
    });

    function openUserList(tab: "followers" | "following") {
        userListTab = tab;
        showUserListModal = true;
    }

    import CharacterCard from "$lib/components/card/CharacterCard.svelte";
    import { loadLikedContent, loadFollowedContent } from "$lib/api/content";

    let activeTab: "created" | "liked" | "following" = "created";
    let likedPersonas: any[] = []; // PersonaDTO
    let followedPersonas: any[] = []; // PersonaDTO
    let isLoadingTab = false;

    async function switchTab(tab: "created" | "liked" | "following") {
        activeTab = tab;
        if (tab === "liked" && likedPersonas.length === 0) {
            isLoadingTab = true;
            likedPersonas = await loadLikedContent();
            isLoadingTab = false;
        } else if (tab === "following" && followedPersonas.length === 0) {
            isLoadingTab = true;
            followedPersonas = await loadFollowedContent();
            isLoadingTab = false;
        }
    }

    function handleCardClick(content: any) {
        goto(`/profile?c=${content.id}`);
    }

    function handleStartChat(persona: Persona) {
        // Default to Flash-Lite
        let llmType = "gemini-flash-lite";

        // Check if user has a saved preference for this session
        chatSessions.update((sessions) => {
            const existingSession = sessions.find(
                (session) => session.id === persona.id,
            );
            if (existingSession && existingSession.llmType) {
                llmType = existingSession.llmType;
            }
            return sessions;
        });

        // Force Flash-Lite for 3D/Live2D modes (override saved preference)
        if (persona.personaType === "3D" || persona.personaType === "2.5D") {
            llmType = "gemini-flash-lite";
        }

        if (persona.personaType === "2D" || persona.personaType === "2d") {
            goto(`/2d?c=${persona.id}&llmType=${llmType}`);
        } else if (persona.personaType === "3D") {
            goto(`/character?c=${persona.id}&llmType=${llmType}`);
        } else if (persona.personaType === "2.5D") {
            goto(`/live2d?c=${persona.id}&llmType=${llmType}`);
        }
    }
</script>

<div class="page-container">
    <div
        style="display: flex; align-items: center; justify-content: space-between;"
    >
        <div class="header">
            <h1>{$t("settingPage.title")}</h1>
        </div>
        <div class="flex items-center gap-2">
            <button
                class="btn-icon settings-button relative"
                on:click={() => (isNotificationDrawerOpen = true)}
            >
                <Icon icon="lucide:bell" width="28" height="28" />
                {#if $unreadCount > 0}
                    <span
                        class="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"
                    ></span>
                {/if}
            </button>
            {#if $locale}
                <button
                    class="btn-icon settings-button"
                    on:click={() => (showSettingsModal = true)}
                >
                    <Icon icon="ph:gear-six-bold" width="32" height="32" />
                </button>
            {/if}
        </div>
    </div>

    {#if error}
        <p class="error">{error}</p>
    {/if}

    <div class="profile-section card">
        <div class="profile-header">
            {#if user.profile}
                <div class="profile-avatar-wrapper">
                    <img
                        src={user.profile}
                        alt="Profile"
                        class="profile-avatar"
                    />
                    {#if isEditingProfile}
                        <button
                            class="edit-avatar-overlay"
                            on:click={() =>
                                document
                                    .getElementById("profile-upload")
                                    ?.click()}
                        >
                            <Icon
                                icon="ph:camera-plus-bold"
                                width="24"
                                height="24"
                            />
                        </button>
                    {/if}
                </div>
            {:else}
                <div class="profile-avatar-wrapper">
                    <div class="profile-avatar-placeholder">
                        {user.name.charAt(0)}
                    </div>
                    {#if isEditingProfile}
                        <button
                            class="edit-avatar-overlay"
                            on:click={() =>
                                document
                                    .getElementById("profile-upload")
                                    ?.click()}
                        >
                            <Icon
                                icon="ph:camera-plus-bold"
                                width="24"
                                height="24"
                            />
                        </button>
                    {/if}
                </div>
            {/if}
            <input
                type="file"
                id="profile-upload"
                accept="image/*"
                style="display: none;"
                on:change={handleProfileUpload}
            />

            <div class="profile-info">
                {#if !isEditingProfile}
                    <div class="name-display-wrapper">
                        <h2>
                            {#if user.data.nickname}
                                {user.data.nickname}<span class="creator-name"
                                    >@{user.name}</span
                                >
                            {:else}
                                <span class="creator-name">@{user.name}</span>
                            {/if}
                        </h2>
                        <button
                            class="btn-icon-edit"
                            on:click={startEditing}
                            aria-label="Edit Profile"
                        >
                            <Icon icon="ri:edit-line" />
                        </button>
                    </div>
                {:else}
                    <input
                        type="text"
                        class="editing"
                        bind:value={user.data.nickname}
                        placeholder="Nickname"
                    />
                    <input type="text" class="editing" bind:value={user.name} />
                {/if}
            </div>

            {#if !isEditingProfile}
                <div class="profile-header-actions">
                    <button class="btn-logout" on:click={logout}>
                        <Icon icon="tabler:logout" width="16" height="16" />
                    </button>
                </div>
            {:else}
                <div class="profile-header-actions">
                    <button class="btn editing" on:click={cancelEditing}>
                        <Icon icon="ri:close-line" />
                    </button>
                    <button
                        class="btn btn-primary editing"
                        on:click={saveProfileChanges}
                    >
                        <Icon icon="ri:check-line" />
                    </button>
                </div>
            {/if}
        </div>

        <div class="profile-details">
            <!-- Row 1: Neurons -->
            <div class="profile-detail-row">
                <div class="info-group">
                    <span class="label">{$t("settingPage.credits")}</span>
                    <div class="value-wrapper">
                        <NeuronIcon size={24} color={"#a0a0a0"} />
                        <span class="value"
                            >{$st_user?.credits || user.credits}</span
                        >
                    </div>
                </div>
                <button
                    class="btn btn-primary"
                    on:click={() => (paymentModalOpen = true)}
                >
                    {$t("settingPage.charge")}
                </button>
            </div>

            <!-- Row 2: Creator Points -->
            <div class="profile-detail-row">
                <div class="info-group">
                    <span class="label">{$t("settingPage.creatorPoints")}</span>
                    <span class="value">{user.creator_points || 0} P</span>
                </div>
                <button
                    class="btn btn-primary"
                    on:click={() => (showPointConvertModal = true)}
                >
                    {$t("settingPage.transfer")}
                </button>
            </div>
        </div>

        <!-- Follow Stats -->
        <div class="follow-stats">
            <button
                class="stat-item"
                on:click={() => openUserList("followers")}
            >
                <span class="stat-value">{followerCount}</span>
                <span class="stat-label">Followers</span>
            </button>
            <div class="stat-divider"></div>
            <button
                class="stat-item"
                on:click={() => openUserList("following")}
            >
                <span class="stat-value">{followingCount}</span>
                <span class="stat-label">Following</span>
            </button>
        </div>
    </div>

    <!-- TAB HEADER -->
    <div class="section-header">
        <div class="tab-buttons">
            <button
                class="tab-btn"
                class:active={activeTab === "created"}
                on:click={() => switchTab("created")}
            >
                <span class="desktop-text">{$t("settingPage.myPersonas")}</span>
                <span class="mobile-text">
                    <Icon icon="ph:cards-bold" width="24" height="24" />
                </span>
            </button>
            <button
                class="tab-btn"
                class:active={activeTab === "liked"}
                on:click={() => switchTab("liked")}
            >
                <span class="desktop-text">{$t("settingPage.liked")}</span>
                <span class="mobile-text">
                    <Icon icon="ph:heart-bold" width="24" height="24" />
                </span>
            </button>
            <button
                class="tab-btn"
                class:active={activeTab === "following"}
                on:click={() => switchTab("following")}
            >
                <span class="desktop-text">{$t("settingPage.following")}</span>
                <span class="mobile-text">
                    <Icon icon="ph:users-bold" width="24" height="24" />
                </span>
            </button>
        </div>

        {#if activeTab === "created"}
            <button class="btn btn-primary" on:click={() => goto("/edit")}>
                <span class="desktop-text">{$t("settingPage.newPersona")}</span>
                <span class="mobile-text">
                    <Icon icon="ph:plus-bold" width="24" height="24" />
                </span>
            </button>
        {/if}
    </div>

    <div class="personas-section">
        {#if isLoadingTab}
            <div class="loading-state">Loading...</div>
        {:else if activeTab === "created"}
            <div class="persona-grid">
                {#each personas as persona}
                    <div class="persona-card">
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div
                            class="card-header clickable"
                            on:click={() => handleStartChat(persona)}
                        >
                            <AssetPreview
                                asset={{
                                    url: persona.portrait_url,
                                    description: "",
                                }}
                            />
                            <div class="chat-overlay">
                                <Icon
                                    icon="ph:chat-circle-dots-bold"
                                    width="32"
                                    height="32"
                                />
                            </div>

                            {#if isLive(persona.id)}
                                <div class="live-indicator">LIVE</div>
                            {/if}
                        </div>

                        <div class="card-body">
                            <h3>{persona.name}</h3>
                            <p class="persona-type">
                                {persona.personaType} Type
                            </p>
                        </div>

                        <div class="card-footer">
                            <div class="actions-group">
                                <button
                                    class="btn"
                                    on:click={() =>
                                        goto(`/edit?c=${persona.id}`)}
                                    aria-label={$t("settingPage.edit")}
                                >
                                    <Icon icon="ri:edit-line" />
                                </button>

                                <button
                                    class="btn"
                                    class:public={persona.visibility ===
                                        "public"}
                                    on:click={() => toggleVisibility(persona)}
                                    aria-label={persona.visibility === "public"
                                        ? $t("settingPage.makePrivate")
                                        : $t("settingPage.makePublic")}
                                >
                                    {#if persona.visibility === "public"}
                                        <Icon icon="ph:eye-bold" />
                                    {:else}
                                        <Icon icon="ph:eye-slash-bold" />
                                    {/if}
                                </button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {:else if activeTab === "liked"}
            <div class="persona-grid">
                {#each likedPersonas as content}
                    <CharacterCard
                        {content}
                        on:click={() => handleCardClick(content)}
                    />
                {/each}
                {#if likedPersonas.length === 0}
                    <div class="empty-state">{$t("settingPage.noLiked")}</div>
                {/if}
            </div>
        {:else if activeTab === "following"}
            <div class="persona-grid">
                {#each followedPersonas as content}
                    <CharacterCard
                        {content}
                        on:click={() => handleCardClick(content)}
                    />
                {/each}
                {#if followedPersonas.length === 0}
                    <div class="empty-state">
                        {$t("settingPage.noFollowing")}
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    {#if showAuctionModal && selectedPersona}
        <AuctionModal
            persona={selectedPersona}
            on:close={() => (showAuctionModal = false)}
        />
    {/if}

    {#if user}
        <PointConvertModal
            isOpen={showPointConvertModal}
            userPoints={user.creator_points || 0}
            on:close={() => (showPointConvertModal = false)}
            on:confirm={handleConvertConfirm}
        />
    {/if}
    <NeedMoreNeuronsModal
        bind:isOpen={paymentModalOpen}
        on:close={handleModalClose}
        isNeedNeurons={false}
    />
    <NotificationDrawer
        bind:isOpen={isNotificationDrawerOpen}
        on:close={() => (isNotificationDrawerOpen = false)}
    />
    <SettingsModal bind:isOpen={showSettingsModal} />

    <!-- <div class="footer-links">
        <a href="/policy"
            >{$t("settingPage.privacyPolicy", { default: "Privacy Policy" })}</a
        >
        <span class="divider">|</span>
        <a href="/terms"
            >{$t("settingPage.termsOfService", {
                default: "Terms of Service",
            })}</a
        >
    </div> -->
</div>

<style>
    /* ... existing styles ... */
    .follow-stats {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        border-top: 1px solid var(--border-card);
        gap: 2rem;
    }
    .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: none;
        border: none;
        cursor: pointer;
        transition: transform 0.2s;
    }
    .stat-item:hover {
        transform: scale(1.05);
    }
    .stat-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--foreground);
    }
    .stat-label {
        font-size: 0.85rem;
        color: var(--muted-foreground);
    }
    .stat-divider {
        width: 1px;
        height: 30px;
        background-color: var(--border);
    }

    .page-container {
        display: flex;
        flex-direction: column;
        max-width: 960px;
        width: 100%;
        margin: 0 auto;
        padding: 0 1.5rem;
        height: 100%;
        box-sizing: border-box;
        padding-bottom: 2rem;
    }

    .footer-links {
        margin-top: auto;
        padding: 2rem 0 1rem;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 1rem;
        font-size: 0.85rem;
        color: var(--muted-foreground);
    }

    .footer-links a {
        color: var(--muted-foreground);
        text-decoration: none;
        transition: color 0.2s;
    }

    .footer-links a:hover {
        color: var(--foreground);
        text-decoration: underline;
    }

    .footer-links .divider {
        color: var(--border);
    }
    .header {
        flex-shrink: 0;
        padding-top: 2rem;
        padding-bottom: 1rem;
    }
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        top: 0;
        padding: 1rem;
        z-index: 10;
        border-bottom: 1px solid var(--border);
        margin-bottom: 1rem;
    }
    .settings-button {
        background: none;
        border: none;
        padding: 0.5rem;
        cursor: pointer;
        color: var(--muted-foreground);
        transition: all 0.2s;
        border-radius: 50%;
    }
    .settings-button:hover {
        color: var(--foreground);
        background-color: var(--muted);
        transform: rotate(45deg);
    }
    .editing {
        width: 100%;
    }
    .btn.editing {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.1rem;
    }
    .personas-section::-webkit-scrollbar {
        width: 6px;
    }
    .personas-section::-webkit-scrollbar-track {
        background: transparent;
    }
    .personas-section::-webkit-scrollbar-thumb {
        background: var(--muted-foreground);
        border-radius: 3px;
        opacity: 0.5;
    }
    .personas-section::-webkit-scrollbar-thumb:hover {
        background: var(--foreground);
        opacity: 0.8;
    }
    .profile-header,
    .profile-details {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        gap: 1rem;
    }
    h1 {
        font-size: 2.25rem;
        font-weight: bold;
    }
    h2 {
        font-size: 1.5rem;
        font-weight: 600;
    }
    h3 {
        font-size: 1.25rem;
        font-weight: 600;
    }
    .card {
        background-color: var(--card);
        border-radius: var(--radius-card);
        padding: 1.5rem;
        border: 1px solid var(--border-card);
    }

    .profile-section {
        flex-shrink: 0;
        margin-bottom: 1rem;
    }
    .personas-section {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 0.5rem;
        margin: 0 -0.5rem;
    }
    .profile-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid var(--border);
    }
    .profile-avatar-placeholder {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background-color: var(--muted);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2.5rem;
        font-weight: bold;
        color: var(--foreground);
    }
    .profile-avatar-wrapper {
        position: relative;
        width: 80px;
        height: 80px;
    }
    .edit-avatar-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        cursor: pointer;
        border: none;
        opacity: 0;
        transition: opacity 0.2s;
    }
    .profile-avatar-wrapper:hover .edit-avatar-overlay {
        opacity: 1;
    }
    .profile-info {
        flex-grow: 1;
    }
    .profile-details {
        background-color: var(--secondary);
        padding: 1.5rem;
        border-radius: var(--radius-input);
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .profile-detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        width: 100%;
    }

    @media (min-width: 768px) {
        .profile-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3rem;
            align-items: center;
        }
    }

    .info-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .value-wrapper {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
    .profile-details .label {
        font-size: 0.8rem;
        color: var(--muted-foreground);
    }
    .profile-details .value {
        font-size: 1.1rem;
        font-weight: 600;
    }
    .persona-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
        gap: 1rem;
    }
    .persona-card {
        position: relative;
        background: var(--card);
        border-radius: var(--radius-card);
        border: 1px solid var(--border-card);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
    }
    .persona-card:hover {
        transform: translateY(-8px);
        box-shadow: var(--shadow-popover);
        border-color: var(--primary);
    }
    .card-header {
        aspect-ratio: 1 / 1;
        width: 100%;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0;
        position: relative;
    }
    .card-header.clickable {
        cursor: pointer;
    }
    .card-header.clickable:hover .chat-overlay {
        opacity: 1;
    }
    .chat-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        opacity: 0;
        transition: opacity 0.2s;
        pointer-events: none;
    }
    .card-header .avatar-image {
        width: 100%;
        height: 100%;
        object-fit: cover; /* 비율 유지하면서 영역 채우기 */
        object-position: center; /* 중앙 정렬 */
        border-radius: 8px; /* 선택사항: 모서리 둥글게 */
    }

    .live-indicator {
        position: absolute;
        top: 1.5rem;
        right: 1.5rem;
        background-color: var(--destructive);
        color: var(--destructive-foreground);
        padding: 0.25rem 0.75rem;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: bold;
        box-shadow: 0 2px 5px hsl(0 85% 52% / 0.5);
    }
    .card-body {
        text-align: center;
        padding: 1.5rem;
    }
    .card-body .persona-type {
        color: var(--muted-foreground);
        font-size: 0.9rem;
    }
    .card-footer {
        margin-top: auto;
        padding: 0 1.5rem 1.5rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    .actions-group {
        display: flex;
        gap: 0.75rem;
        width: 100%;
    }
    .actions-group > .btn {
        flex-grow: 1;
    }
    .btn {
        padding: 0.6rem 1.2rem;
        font-size: 0.9rem;
        font-weight: 600;
        background: var(--secondary);
        color: var(--secondary-foreground);
        border-radius: var(--radius-button);
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
        position: relative;
        overflow: hidden;
        border: 1px solid var(--border);
    }
    .btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: var(--shadow-mini);
    }
    .btn:active:not(:disabled) {
        transform: translateY(0);
    }
    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
    }
    .btn-primary {
        background: var(--primary-gradient);
        background-size: 200% 200%;
        animation: gradient-animation 3s ease infinite;
        border-color: var(--primary-gradient);
        border-radius: 22px;
        color: var(--primary-foreground);
    }
    .btn-primary:hover {
        opacity: 0.9;
    }
    .btn.public {
        background: transparent;
        color: hsl(142, 71%, 45%);
        border-color: hsl(142, 71%, 45%);
    }
    .btn.public:hover {
        background-color: hsl(142, 71%, 45%, 0.1);
    }
    .btn-danger {
        background: transparent;
        border-color: var(--destructive);
        color: var(--destructive);
    }
    .btn-danger:hover {
        background: var(--destructive);
        color: var(--destructive-foreground);
    }
    .btn-toggle.active {
        background: var(--destructive);
        border-color: var(--destructive);
        color: var(--destructive-foreground);
    }
    .error {
        color: var(--destructive);
        background-color: hsl(0 85% 52% / 0.1);
        padding: 1rem;
        border-radius: var(--radius-input);
    }
    .creator-name {
        color: var(--muted-foreground);
        font-size: 0.75em;
        font-weight: bold;
        font-style: italic;
    }
    .btn-logout {
        background-color: transparent;
        color: var(--muted-foreground);
        border-color: var(--border);
    }
    .btn-logout:hover {
        background-color: hsl(0 85% 52% / 0.1);
        color: var(--destructive);
        border-color: var(--destructive);
    }
    .name-display-wrapper {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .btn-icon-edit {
        background: none;
        border: none;
        padding: 0.25rem;
        cursor: pointer;
        color: var(--muted-foreground);
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        border-radius: var(--radius-button);
    }
    .btn-icon-edit:hover {
        color: var(--foreground);
        background-color: var(--muted);
        transform: scale(1.05);
    }
    @media (max-width: 768px) {
        h1 {
            font-size: 1.75rem;
        }
        h2 {
            font-size: 1.25rem;
        }
        h3 {
            font-size: 1.1rem;
        }
        .profile-details .label {
            font-size: 0.75rem;
        }
        .profile-details .value {
            font-size: 1rem;
        }
        .btn {
            font-size: 0.8rem;
            padding: 0.5rem 1rem;
        }
        .card-body .persona-type {
            font-size: 0.85rem;
        }
        .creator-name {
            font-size: 0.7em;
        }
    }
    .tab-buttons {
        display: flex;
        gap: 0.5rem;
    }
    .tab-btn {
        background: transparent;
        border: none;
        padding: 0.5rem 1rem;
        cursor: pointer;
        color: var(--muted-foreground);
        font-weight: 600;
        font-size: 1.1rem;
        transition: all 0.2s;
        border-bottom: 2px solid transparent;
        white-space: nowrap; /* Prevent wrapping */
    }
    .tab-btn:hover {
        color: var(--foreground);
    }
    .tab-btn.active {
        color: var(--foreground);
        border-bottom-color: var(--primary);
    }
    .loading-state,
    .empty-state {
        padding: 3rem;
        text-align: center;
        color: var(--muted-foreground);
        font-size: 1.1rem;
    }

    /* Responsive Text Logic */
    .mobile-text {
        display: none;
    }

    @media (max-width: 768px) {
        .tab-btn {
            padding: 0.5rem 0.5rem; /* Reduce padding on mobile */
            font-size: 1rem;
        }
        .desktop-text {
            display: none;
        }
        .mobile-text {
            display: inline;
        }
    }
</style>

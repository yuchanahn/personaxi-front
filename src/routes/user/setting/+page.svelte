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

            const $t = get(t);
            toast.success($t("pointConvertModal.success"));

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
    let isPWA = false;

    function logoutHandler() {
        if (confirm("정말 로그아웃 하시겠습니까?")) {
            logout();
        }
    }

    onMount(async () => {
        if (typeof window !== "undefined") {
            const isStandalone = window.matchMedia(
                "(display-mode: standalone)",
            ).matches;
            // @ts-ignore
            const isIOSStandalone = window.navigator.standalone === true;
            isPWA = isStandalone || isIOSStandalone;
        }

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

    async function toggleVisibility(persona: Persona) {
        const newVisibility =
            persona.visibility === "public" ? "private" : "public";

        try {
            const res = await api.post(`/api/persona/visibility`, {
                personaId: persona.id,
                visibility: newVisibility,
            });

            if (res.ok) {
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
            const isTemp = user.profile !== originalUser?.profile;
            const oldUrl =
                user.profile && !user.profile.startsWith("blob:") && isTemp
                    ? user.profile
                    : undefined;
            const response = await getUploadUrl("user_profile", oldUrl);
            const { signedURL, fileName } = await response.json();

            await uploadFileWithProgress(signedURL, file, (percent) => {
                console.log(`Upload progress: ${percent}%`);
            });

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
    import PaymentHistoryModal from "$lib/components/modal/PaymentHistoryModal.svelte";
    import { settings, type Language } from "$lib/stores/settings";
    import AssetPreview from "$lib/components/AssetPreview.svelte";
    import NotificationDrawer from "$lib/components/notification/NotificationDrawer.svelte";
    import { notificationStore } from "$lib/stores/notification";
    import UserListModal from "$lib/components/modal/UserListModal.svelte";
    import { getFollowers, getFollowing } from "$lib/api/user";
    import { needMoreNeuronsModal } from "$lib/stores/modal";

    let showSettingsModal = false;
    let showPaymentHistoryModal = false;
    let isNotificationDrawerOpen = false;
    const { unreadCount } = notificationStore;

    let showUserListModal = false;
    let showCreatorInfoModal = false;
    let userListTab: "followers" | "following" = "followers";
    let followerCount = 0;
    let followingCount = 0;

    onMount(async () => {
        try {
            const userRes = await getCurrentUser();
            if (userRes) {
                user = userRes as User;
                notificationStore.init(user.id);

                getFollowers(user.id).then(
                    (ids) => (followerCount = ids.length),
                );
                getFollowing(user.id).then(
                    (ids) => (followingCount = ids.length),
                );

                if (!user.data || user.data.language === "") {
                    user.data = {
                        nickname: user.name,
                        language: get(locale) || "",
                        lastLoginAt: "",
                        createdAt: "",
                        hasReceivedFirstCreationReward: false,
                        lastLoginIP: "",
                    };
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

    function openUserList(tab: "followers" | "following") {
        userListTab = tab;
        showUserListModal = true;
    }

    import CharacterCard from "$lib/components/card/CharacterCard.svelte";
    import { loadLikedContent, loadFollowedContent } from "$lib/api/content";

    let activeTab: "profile" | "created" | "liked" | "following" = "profile";
    let likedPersonas: any[] = [];
    let followedPersonas: any[] = [];
    let isLoadingTab = false;

    async function switchTab(
        tab: "profile" | "created" | "liked" | "following",
    ) {
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
        let llmType = "gemini-flash-lite";

        chatSessions.update((sessions) => {
            const existingSession = sessions.find(
                (session) => session.id === persona.id,
            );
            if (existingSession && existingSession.llmType) {
                llmType = existingSession.llmType;
            }
            return sessions;
        });

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
    <!-- Compact Header -->
    <header class="page-header">
        <h1 class="page-title">{$t("settingPage.title")}</h1>
        <div class="header-actions">
            <button
                class="icon-btn"
                on:click={() => (isNotificationDrawerOpen = true)}
                aria-label="Notifications"
            >
                <Icon icon="lucide:bell" width="24" height="24" />
                {#if $unreadCount > 0}
                    <span class="notification-badge"></span>
                {/if}
            </button>
            {#if $locale}
                <button
                    class="icon-btn"
                    on:click={() => (showSettingsModal = true)}
                    aria-label="Settings"
                >
                    <Icon icon="ph:gear-six-bold" width="24" height="24" />
                </button>
            {/if}
        </div>
    </header>

    {#if error}
        <div class="error-banner">
            <Icon icon="ph:warning-circle-bold" width="20" height="20" />
            <span>{error}</span>
        </div>
    {/if}

    <!-- Content Tabs -->
    <div class="content-section">
        <div class="tabs-header">
            <div class="tabs-nav">
                <button
                    class="tab-item"
                    class:active={activeTab === "profile"}
                    on:click={() => switchTab("profile")}
                >
                    <Icon icon="ph:user-bold" width="20" height="20" />
                    <span class="tab-label">내 정보</span>
                </button>
                <button
                    class="tab-item"
                    class:active={activeTab === "created"}
                    on:click={() => switchTab("created")}
                >
                    <Icon icon="ph:cards-bold" width="20" height="20" />
                    <span class="tab-label">{$t("settingPage.myPersonas")}</span
                    >
                </button>
                <button
                    class="tab-item"
                    class:active={activeTab === "liked"}
                    on:click={() => switchTab("liked")}
                >
                    <Icon icon="ph:heart-bold" width="20" height="20" />
                    <span class="tab-label">{$t("settingPage.liked")}</span>
                </button>
                <button
                    class="tab-item"
                    class:active={activeTab === "following"}
                    on:click={() => switchTab("following")}
                >
                    <Icon icon="ph:users-bold" width="20" height="20" />
                    <span class="tab-label">{$t("settingPage.following")}</span>
                </button>
            </div>

            {#if activeTab === "created"}
                <button class="primary-btn" on:click={() => goto("/edit")}>
                    <Icon icon="ph:plus-bold" width="20" height="20" />
                    <span class="btn-label">{$t("settingPage.newPersona")}</span
                    >
                </button>
            {/if}
        </div>

        <div class="content-area">
            {#if activeTab === "profile"}
                <!-- Profile Tab Content -->
                <div class="profile-tab-content">
                    <div class="profile-card">
                        <div class="profile-main">
                            <!-- Left: Avatar -->
                            <div class="profile-avatar-section">
                                {#if user.profile}
                                    <div class="avatar-wrapper">
                                        <img
                                            src={user.profile}
                                            alt="Profile"
                                            class="avatar-image"
                                        />
                                        {#if isEditingProfile}
                                            <button
                                                class="avatar-edit-btn"
                                                on:click={() =>
                                                    document
                                                        .getElementById(
                                                            "profile-upload",
                                                        )
                                                        ?.click()}
                                            >
                                                <Icon
                                                    icon="ph:camera-plus-bold"
                                                    width="20"
                                                    height="20"
                                                />
                                            </button>
                                        {/if}
                                    </div>
                                {:else}
                                    <div class="avatar-wrapper">
                                        <div class="avatar-placeholder">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        {#if isEditingProfile}
                                            <button
                                                class="avatar-edit-btn"
                                                on:click={() =>
                                                    document
                                                        .getElementById(
                                                            "profile-upload",
                                                        )
                                                        ?.click()}
                                            >
                                                <Icon
                                                    icon="ph:camera-plus-bold"
                                                    width="20"
                                                    height="20"
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
                            </div>

                            <!-- Center: User Info -->
                            <div class="profile-info-section">
                                {#if !isEditingProfile}
                                    <div class="user-name-group">
                                        <h2 class="user-display-name">
                                            {user.data.nickname || user.name}
                                        </h2>
                                        <span class="user-handle"
                                            >@{user.name}</span
                                        >
                                        <button
                                            class="edit-icon-btn"
                                            on:click={startEditing}
                                            aria-label="Edit Profile"
                                        >
                                            <Icon
                                                icon="ri:edit-line"
                                                width="18"
                                                height="18"
                                            />
                                        </button>
                                    </div>
                                {:else}
                                    <div class="edit-inputs">
                                        <input
                                            type="text"
                                            class="input-field"
                                            bind:value={user.data.nickname}
                                            placeholder="Display Name"
                                        />
                                        <input
                                            type="text"
                                            class="input-field"
                                            bind:value={user.name}
                                            placeholder="Username"
                                        />
                                    </div>
                                {/if}

                                <!-- Follow Stats -->
                                <div class="follow-stats-inline">
                                    <button
                                        class="stat-btn"
                                        on:click={() =>
                                            openUserList("followers")}
                                    >
                                        <span class="stat-num"
                                            >{followerCount}</span
                                        >
                                        <span class="stat-label">Followers</span
                                        >
                                    </button>
                                    <span class="stat-divider">·</span>
                                    <button
                                        class="stat-btn"
                                        on:click={() =>
                                            openUserList("following")}
                                    >
                                        <span class="stat-num"
                                            >{followingCount}</span
                                        >
                                        <span class="stat-label">Following</span
                                        >
                                    </button>
                                </div>
                            </div>

                            <!-- Right: Actions -->
                            <div class="profile-actions-section">
                                {#if !isEditingProfile}
                                    <!-- <div class="action-row">
                                        {#if !isPWA}
                                            <button
                                                class="compact-action-btn"
                                                on:click={() =>
                                                    goto("/install")}
                                                aria-label="App Install Guide"
                                                title="App Install Guide"
                                            >
                                                <Icon
                                                    icon="material-symbols:download-rounded"
                                                    width="24"
                                                    height="24"
                                                />
                                            </button>
                                        {/if}
                                        <button
                                            class="compact-action-btn logout"
                                            on:click={logout}
                                            aria-label="Logout"
                                            title="Logout"
                                        >
                                            <Icon
                                                icon="tabler:logout"
                                                width="24"
                                                height="24"
                                            />
                                        </button>
                                    </div> -->
                                    <div class="enhanced-actions">
                                        <div class="bottom-utility-row">
                                            <button
                                                class="logout-link-btn"
                                                on:click={logoutHandler}
                                            >
                                                <Icon
                                                    icon="tabler:logout"
                                                    width="18"
                                                />
                                                <span>로그아웃</span>
                                            </button>
                                        </div>
                                        {#if !isPWA}
                                            <button
                                                class="install-banner-btn"
                                                on:click={() =>
                                                    goto("/install")}
                                            >
                                                <Icon
                                                    icon="material-symbols:download-rounded"
                                                    width="20"
                                                />
                                                <span>앱 설치</span>
                                            </button>
                                        {/if}
                                    </div>
                                {:else}
                                    <div class="edit-actions">
                                        <button
                                            class="cancel-btn"
                                            on:click={cancelEditing}
                                        >
                                            <Icon
                                                icon="ri:close-line"
                                                width="20"
                                                height="20"
                                            />
                                        </button>
                                        <button
                                            class="save-btn"
                                            on:click={saveProfileChanges}
                                        >
                                            <Icon
                                                icon="ri:check-line"
                                                width="20"
                                                height="20"
                                            />
                                        </button>
                                    </div>
                                {/if}
                            </div>
                        </div>

                        <!-- Stats Grid -->
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-header">
                                    <span class="stat-title">
                                        {$t("settingPage.credits")}
                                    </span>
                                    <button
                                        class="history-request-btn"
                                        on:click={() =>
                                            (showPaymentHistoryModal = true)}
                                    >
                                        <Icon
                                            icon="ph:receipt-bold"
                                            width="14"
                                            height="14"
                                        />
                                        {$t("paymentHistoryModal.title")}
                                    </button>
                                </div>
                                <div class="stat-value-container">
                                    <div class="stat-value-row">
                                        <NeuronIcon
                                            size={28}
                                            color={"#a0a0a0"}
                                        />
                                        <span class="stat-value-large"
                                            >{$st_user?.credits ||
                                                user.credits}</span
                                        >
                                    </div>
                                    <button
                                        class="primary-btn compact"
                                        on:click={() =>
                                            needMoreNeuronsModal.set({
                                                isOpen: true,
                                                isNeedNeurons: false,
                                            })}
                                    >
                                        <Icon
                                            icon="ph:plus-bold"
                                            width="16"
                                            height="16"
                                        />
                                        {$t("settingPage.charge")}
                                    </button>
                                </div>
                            </div>

                            <div class="stat-card">
                                <div class="stat-header">
                                    <span class="stat-title">
                                        {$t("settingPage.creatorPoints")}
                                        <button
                                            class="info-icon-btn"
                                            on:click={() =>
                                                (showCreatorInfoModal = true)}
                                        >
                                            <Icon
                                                icon="ph:info-bold"
                                                width="14"
                                                height="14"
                                            />
                                        </button>
                                    </span>
                                </div>
                                <div class="stat-value-container">
                                    <div class="stat-value-row">
                                        <span class="stat-value-large"
                                            >{user.creator_points || 0}</span
                                        >
                                        <span class="stat-unit">Points</span>
                                    </div>
                                    <button
                                        class="primary-btn compact"
                                        on:click={() =>
                                            (showPointConvertModal = true)}
                                    >
                                        <Icon
                                            icon="ph:arrows-left-right-bold"
                                            width="16"
                                            height="16"
                                        />
                                        {$t("settingPage.transfer")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            {:else if isLoadingTab}
                <div class="loading-state">
                    <Icon
                        icon="svg-spinners:ring-resize"
                        width="32"
                        height="32"
                    />
                    <span>Loading...</span>
                </div>
            {:else if activeTab === "created"}
                <div class="content-grid">
                    {#each personas as persona}
                        <div class="persona-card-new">
                            <button
                                class="persona-preview"
                                on:click={() => handleStartChat(persona)}
                            >
                                <AssetPreview
                                    asset={{
                                        url: persona.portrait_url,
                                        description: "",
                                    }}
                                />
                                <div class="hover-overlay">
                                    <Icon
                                        icon="ph:chat-circle-dots-bold"
                                        width="32"
                                        height="32"
                                    />
                                </div>
                                {#if isLive(persona.id)}
                                    <span class="live-badge">LIVE</span>
                                {/if}
                            </button>

                            <div class="persona-info">
                                <h3 class="persona-name">{persona.name}</h3>
                                <p class="persona-type-text">
                                    {persona.personaType} Type
                                </p>
                            </div>

                            <div class="persona-actions">
                                <button
                                    class="action-btn"
                                    on:click={() =>
                                        goto(`/edit?c=${persona.id}`)}
                                    aria-label="Edit"
                                >
                                    <Icon
                                        icon="ri:edit-line"
                                        width="18"
                                        height="18"
                                    />
                                </button>
                                <button
                                    class="action-btn"
                                    class:active={persona.visibility ===
                                        "public"}
                                    on:click={() => toggleVisibility(persona)}
                                    aria-label={persona.visibility === "public"
                                        ? "Make Private"
                                        : "Make Public"}
                                >
                                    <Icon
                                        icon={persona.visibility === "public"
                                            ? "ph:eye-bold"
                                            : "ph:eye-slash-bold"}
                                        width="18"
                                        height="18"
                                    />
                                </button>
                            </div>
                        </div>
                    {/each}
                    {#if personas.length === 0}
                        <div class="empty-state">
                            <Icon
                                icon="ph:cards-bold"
                                width="48"
                                height="48"
                                style="opacity: 0.3;"
                            />
                            <p>No personas yet</p>
                        </div>
                    {/if}
                </div>
            {:else if activeTab === "liked"}
                <div class="content-grid">
                    {#each likedPersonas as content}
                        <CharacterCard
                            {content}
                            on:click={() => handleCardClick(content)}
                        />
                    {/each}
                    {#if likedPersonas.length === 0}
                        <div class="empty-state">
                            <Icon
                                icon="ph:heart-bold"
                                width="48"
                                height="48"
                                style="opacity: 0.3;"
                            />
                            <p>{$t("settingPage.noLiked")}</p>
                        </div>
                    {/if}
                </div>
            {:else if activeTab === "following"}
                <div class="content-grid">
                    {#each followedPersonas as content}
                        <CharacterCard
                            {content}
                            on:click={() => handleCardClick(content)}
                        />
                    {/each}
                    {#if followedPersonas.length === 0}
                        <div class="empty-state">
                            <Icon
                                icon="ph:users-bold"
                                width="48"
                                height="48"
                                style="opacity: 0.3;"
                            />
                            <p>{$t("settingPage.noFollowing")}</p>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>

    <!-- Modals -->
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

    <NotificationDrawer
        bind:isOpen={isNotificationDrawerOpen}
        on:close={() => (isNotificationDrawerOpen = false)}
    />

    <SettingsModal bind:isOpen={showSettingsModal} />

    <PaymentHistoryModal
        bind:isOpen={showPaymentHistoryModal}
        on:close={() => (showPaymentHistoryModal = false)}
    />

    <UserListModal
        bind:isOpen={showUserListModal}
        bind:initialTab={userListTab}
        userId={user.id}
    />

    <!-- Creator Info Modal -->
    {#if showCreatorInfoModal}
        <div
            class="modal-overlay"
            on:click={() => (showCreatorInfoModal = false)}
            role="button"
            tabindex="0"
            on:keypress={(e) =>
                e.key === "Enter" && (showCreatorInfoModal = false)}
        >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="modal-box" on:click|stopPropagation>
                <h2 class="modal-title">
                    {$t("settingPage.creatorPointInfo.title")}
                </h2>
                <p class="modal-desc">
                    {$t("settingPage.creatorPointInfo.desc")}
                </p>
                <button
                    class="primary-btn full-width"
                    on:click={() => (showCreatorInfoModal = false)}
                >
                    {$t("common.confirm", { default: "Confirm" })}
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    /* ============================================
       LAYOUT & CONTAINER
       ============================================ */
    .page-container {
        max-width: 1024px;
        width: 100%;
        margin: 0 auto;
        padding: 0 1rem;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding-bottom: 3rem;
    }

    /* ============================================
       HEADER
       ============================================ */
    .page-header {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 1.5rem 0 1rem;
        border-bottom: 1px solid var(--border);
    }

    .page-title {
        font-size: 1.75rem;
        font-weight: 700;
        margin: 0;
        text-align: center;
    }

    .header-actions {
        position: absolute;
        right: 0;
        display: flex;
        gap: 0.5rem;
    }

    .icon-btn {
        position: relative;
        background: var(--secondary);
        border: 1px solid var(--border);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        color: var(--foreground);
    }

    .icon-btn:hover {
        background: var(--muted);
        transform: scale(1.05);
    }

    .notification-badge {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 8px;
        height: 8px;
        background: var(--destructive);
        border-radius: 50%;
        border: 2px solid var(--card);
    }

    /* ============================================
       ERROR BANNER
       ============================================ */
    .error-banner {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        background: hsl(0 85% 52% / 0.1);
        border: 1px solid var(--destructive);
        border-radius: 12px;
        color: var(--destructive);
        font-size: 0.9rem;
    }

    /* ============================================
       PROFILE CARD
       ============================================ */
    .profile-card {
        background: var(--card);
        border: 1px solid var(--border-card);
        border-radius: 16px;
        overflow: hidden;
    }

    .profile-main {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 1.5rem;
        padding: 2rem;
        align-items: start;
    }

    /* Avatar Section */
    .profile-avatar-section {
        flex-shrink: 0;
    }

    .avatar-wrapper {
        position: relative;
        width: 96px;
        height: 96px;
    }

    .avatar-image {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid var(--border);
    }

    .avatar-placeholder {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: linear-gradient(
            135deg,
            var(--primary) 0%,
            var(--primary) 100%
        );
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2.5rem;
        font-weight: 700;
        color: var(--primary-foreground);
        border: 3px solid var(--border);
    }

    .avatar-edit-btn {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--primary);
        border: 2px solid var(--card);
        color: var(--primary-foreground);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
    }

    .avatar-edit-btn:hover {
        transform: scale(1.1);
    }

    /* Info Section */
    .profile-info-section {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: 0;
    }

    .user-name-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .user-display-name {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
    }

    .user-handle {
        color: var(--muted-foreground);
        font-size: 0.95rem;
        font-weight: 500;
    }

    .edit-icon-btn {
        background: none;
        border: none;
        padding: 0.25rem;
        cursor: pointer;
        color: var(--muted-foreground);
        transition: all 0.2s;
        border-radius: 6px;
    }

    .edit-icon-btn:hover {
        color: var(--foreground);
        background: var(--muted);
    }

    .edit-inputs {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .input-field {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--background);
        color: var(--foreground);
        font-size: 0.95rem;
    }

    .input-field:focus {
        outline: none;
        border-color: var(--primary);
    }

    .follow-stats-inline {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .stat-btn {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        transition: opacity 0.2s;
    }

    .stat-btn:hover {
        opacity: 0.7;
    }

    .stat-num {
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--foreground);
    }

    .stat-label {
        font-size: 0.85rem;
        color: var(--muted-foreground);
    }

    .stat-divider {
        color: var(--muted-foreground);
        font-size: 0.9rem;
    }

    /* Actions Section */
    .profile-actions-section {
        display: flex;
        align-items: flex-start;
    }
    .edit-actions {
        display: flex;
        gap: 0.5rem;
    }

    .cancel-btn,
    .save-btn {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        border: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
    }

    .cancel-btn {
        background: transparent;
        color: var(--muted-foreground);
    }

    .cancel-btn:hover {
        background: var(--muted);
        color: var(--foreground);
    }

    .save-btn {
        background: var(--primary);
        color: var(--primary-foreground);
        border-color: var(--primary);
    }

    .save-btn:hover {
        opacity: 0.9;
    }

    /* Stats Grid */
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
        padding: 0 2rem 2.5rem;
        border-top: 1px solid var(--border);
        padding-top: 2.5rem; /* Increased spacing */
        margin-top: 1.5rem; /* Additional separation */
    }

    .stat-card {
        background: var(--secondary);
        border-radius: 12px;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .stat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .stat-title {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .info-icon-btn {
        background: none;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        padding: 2px;
        display: inline-flex;
        transition: color 0.2s;
    }

    .info-icon-btn:hover {
        color: var(--primary);
    }

    .history-request-btn {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.8rem;
        color: var(--muted-foreground);
        background: var(--secondary);
        border: 1px solid var(--border);
        padding: 0.3rem 0.6rem;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .history-request-btn:hover {
        background: var(--muted);
        color: var(--foreground);
    }

    .stat-value-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .stat-value-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .stat-value-large {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--foreground);
    }

    .stat-unit {
        font-size: 0.95rem;
        color: var(--muted-foreground);
        font-weight: 500;
    }

    /* ============================================
       CONTENT SECTION
       ============================================ */
    .content-section {
        display: flex;
        flex-direction: column;
        flex: 1;
    }

    .tabs-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 0 0 1rem;
        border-bottom: 2px solid var(--border);
    }

    .tabs-nav {
        display: flex;
        gap: 0.5rem;
    }

    .tab-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: transparent;
        border: none;
        border-radius: 8px;
        color: var(--muted-foreground);
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 600;
        font-size: 0.95rem;
    }

    .tab-item:hover {
        background: var(--muted);
        color: var(--foreground);
    }

    .tab-item.active {
        background: var(--primary);
        color: var(--primary-foreground);
    }

    .tab-label {
        display: inline;
    }

    .primary-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.25rem;
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 600;
        font-size: 0.95rem;
    }

    .primary-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }

    .primary-btn.compact {
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
    }

    .btn-label {
        display: inline;
    }

    .full-width {
        width: 100%;
    }

    /* Content Area */
    .content-area {
        padding: 1.5rem 0;
        flex: 1;
        overflow-y: auto;
    }

    .profile-tab-content {
        max-width: 100%;
    }

    .content-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 1rem;
    }

    .loading-state,
    .empty-state {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 4rem 2rem;
        color: var(--muted-foreground);
        font-size: 0.95rem;
    }

    /* Persona Card (New Design) */
    .persona-card-new {
        background: var(--card);
        border: 1px solid var(--border-card);
        border-radius: 14px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .persona-card-new:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
        border-color: var(--primary);
    }

    .persona-preview {
        position: relative;
        aspect-ratio: 1;
        width: 100%;
        overflow: hidden;
        background: var(--muted);
        border: none;
        padding: 0;
        cursor: pointer;
    }

    .hover-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .persona-preview:hover .hover-overlay {
        opacity: 1;
    }

    .live-badge {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        background: var(--destructive);
        color: var(--destructive-foreground);
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 700;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .persona-info {
        padding: 1rem;
        text-align: center;
    }

    .persona-name {
        font-size: 1rem;
        font-weight: 600;
        margin: 0 0 0.25rem;
        color: var(--foreground);
    }

    .persona-type-text {
        font-size: 0.8rem;
        color: var(--muted-foreground);
        margin: 0;
    }

    .persona-actions {
        display: flex;
        gap: 0.5rem;
        padding: 0 1rem 1rem;
        margin-top: auto;
    }

    .action-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.6rem;
        background: var(--secondary);
        border: 1px solid var(--border);
        border-radius: 8px;
        color: var(--foreground);
        cursor: pointer;
        transition: all 0.2s;
    }

    .action-btn:hover {
        background: var(--muted);
        transform: translateY(-1px);
    }

    .action-btn.active {
        background: transparent;
        border-color: hsl(142, 71%, 45%);
        color: hsl(142, 71%, 45%);
    }

    .action-btn.active:hover {
        background: hsl(142, 71%, 45%, 0.1);
    }

    /* ============================================
       MODAL
       ============================================ */
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
    }

    .modal-box {
        background: var(--card);
        padding: 2rem;
        border-radius: 16px;
        max-width: 400px;
        width: 100%;
        border: 1px solid var(--border);
    }

    .modal-title {
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0 0 0.75rem;
        color: var(--foreground);
    }

    .modal-desc {
        font-size: 0.95rem;
        color: var(--muted-foreground);
        margin: 0 0 1.5rem;
        line-height: 1.6;
    }

    /* ============================================
       RESPONSIVE
       ============================================ */
    @media (max-width: 768px) {
        .page-title {
            font-size: 1.5rem;
        }

        .profile-main {
            grid-template-columns: auto 1fr;
            gap: 1rem;
            padding: 1.5rem;
        }

        .profile-actions-section {
            grid-column: 1 / -1;
            width: 100%;
        }

        .avatar-wrapper {
            width: 72px;
            height: 72px;
        }

        .user-display-name {
            font-size: 1.25rem;
        }

        .stats-grid {
            grid-template-columns: 1fr;
            padding: 1rem 1.5rem 1.5rem;
        }

        .tabs-nav {
            flex: 1;
            overflow-x: auto;
        }

        .tab-label,
        .btn-label,
        .logout-text {
            display: none;
        }

        .tab-item {
            flex: 1;
            justify-content: center;
            padding: 0.75rem 0.5rem;
            min-width: fit-content;
        }

        .content-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 0.75rem;
        }

        .content-area {
            padding-bottom: 80px;
        }
    }

    @media (max-width: 480px) {
        .page-container {
            padding: 0 0.75rem;
        }

        .content-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    /* 버튼 컨테이너: 상단 정보와 더 가깝게 */
    .enhanced-actions {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        margin-top: 0.5rem;
        width: 100%;
    }

    /* 앱 설치 버튼: 너무 무겁지 않게 */
    .install-banner-btn {
        all: unset; /* 기본 스타일 초기화 */
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 1rem;
        background: var(--secondary); /* 배경보다 살짝 밝거나 비슷한 톤 */
        border: 1px solid var(--border);
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .install-banner-btn:hover {
        background: var(--muted);
    }

    /* 로그아웃 버튼: 설치 버튼과 높이 맞춤 */
    .logout-link-btn {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--muted-foreground);
        font-size: 0.85rem;
        padding: 0.5rem;
    }
</style>

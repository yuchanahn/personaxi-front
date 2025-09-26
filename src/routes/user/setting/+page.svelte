<script lang="ts">
    import { PORTRAIT_URL } from "$lib/constants";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import type { Persona } from "$lib/types";
    import { getCurrentUser, logout } from "$lib/api/auth";
    import { fetchLivePersonas, setLiveStatus } from "$lib/services/live";
    import { locale, t } from "svelte-i18n";
    import AuctionModal from "$lib/components/modal/AuctionModal.svelte";
    import { Avatar } from "bits-ui";
    import NeedMoreNeuronsModal from "$lib/components/modal/NeedMoreNeuronsModal.svelte";
    import NeuronIcon from "$lib/components/icons/NeuronIcon.svelte";
    import { get } from "svelte/store";
    import type { User } from "$lib/types";
    import Icon from "@iconify/svelte";
    import { api } from "$lib/api";

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
    let selectedPersona: Persona | null = null;

    let isEditingProfile = false;
    let originalUser: User | null = null;

    onMount(async () => {
        try {
            const userRes = await getCurrentUser();
            if (userRes) {
                user = userRes as User;

                if (!user.data) {
                    user.data = {
                        nickname: user.name,
                        language: get(locale) || "",
                        lastLoginAt: "",
                        createdAt: "",
                        hasReceivedFirstCreationReward: false,
                        lastLoginIP: "",
                    };
                }
            } else {
                error = "Failed to load user : " + userRes.status;
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

    async function saveProfileChanges() {
        const settingRq: UserSettingRequest = {
            name: user.name,
            nickname: user.data.nickname || "",
            language: get(locale) || "en",
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

    let showSettingsModal = false;
</script>

<div class="page-container">
    <div
        style="display: flex; align-items: center; justify-content: space-between;"
    >
        <div class="header">
            <h1>{$t("settingPage.title")}</h1>
        </div>
        {#if $locale}
            <button
                class="btn-icon settings-button"
                on:click={() => (showSettingsModal = true)}
            >
                <Icon icon="ph:gear-six-bold" width="32" height="32" />
            </button>
        {/if}
    </div>

    {#if error}
        <p class="error">{error}</p>
    {/if}

    <div class="profile-section card">
        <div class="profile-header">
            {#if user.profile}
                <img src={user.profile} alt="Profile" class="profile-avatar" />
            {:else}
                <div class="profile-avatar-placeholder">
                    {user.name.charAt(0)}
                </div>
            {/if}

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
            <div>
                <span class="label">{$t("settingPage.credits")}</span>

                <div style="display: flex; align-items: center;">
                    <NeuronIcon size={24} color={"#a0a0a0"} />

                    <span class="value">{user.credits}</span>
                </div>
            </div>

            <div>
                <span class="label">{$t("settingPage.plan")}</span>

                <span class="value">{user.plan}</span>
            </div>

            <button
                class="btn btn-primary"
                on:click={() => (paymentModalOpen = true)}
                >{$t("settingPage.charge")}</button
            >
        </div>
    </div>

    <div class="section-header">
        <h2>{$t("settingPage.myPersonas")}</h2>
        <button class="btn btn-primary" on:click={() => goto("/edit")}>
            {$t("settingPage.newPersona")}
        </button>
    </div>
    <div class="personas-section">
        <div class="persona-grid">
            {#each personas as persona}
                <div class="persona-card">
                    <div class="card-header">
                        <img
                            src={`${PORTRAIT_URL}${persona.owner_id[0]}/${
                                persona.id
                            }.portrait`}
                            alt={persona.name}
                            class="avatar-image"
                        />
                        {#if isLive(persona.id)}
                            <div class="live-indicator">LIVE</div>
                        {/if}
                    </div>

                    <div class="card-body">
                        <h3>{persona.name}</h3>
                        <p class="persona-type">{persona.personaType} Type</p>
                    </div>

                    <div class="card-footer">
                        {#if persona.personaType === "3D"}
                            <div class="actions-group">
                                <button
                                    class="btn btn-toggle"
                                    class:active={isLive(persona.id)}
                                    on:click={() => toggleLive(persona.id)}
                                    aria-label={isLive(persona.id)
                                        ? $t("settingPage.broadcastEnd")
                                        : $t("settingPage.broadcastStart")}
                                >
                                    <Icon icon="mdi:broadcast" />
                                </button>
                                <button
                                    class="btn"
                                    on:click={() => openAuctionModal(persona)}
                                    disabled={isLive(persona.id)}
                                    aria-label={$t("settingPage.auctionStart")}
                                >
                                    <Icon icon="ri:auction-fill" />
                                </button>
                            </div>
                        {/if}
                        <div class="actions-group">
                            <button
                                class="btn"
                                on:click={() => goto(`/edit?c=${persona.id}`)}
                                aria-label={$t("settingPage.edit")}
                            >
                                <Icon icon="ri:edit-line" />
                            </button>
                            <!-- --- 🔽 삭제 버튼을 공개/비공개 토글 버튼으로 변경 🔽 --- -->
                            <button
                                class="btn"
                                class:public={persona.visibility === "public"}
                                on:click={() => toggleVisibility(persona)}
                                aria-label={persona.visibility === "public"
                                    ? "캐릭터를 비공개로 전환"
                                    : "캐릭터를 공개로 전환"}
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
    </div>

    {#if showAuctionModal && selectedPersona}
        <AuctionModal
            persona={selectedPersona}
            on:close={() => (showAuctionModal = false)}
        />
    {/if}
    <NeedMoreNeuronsModal
        bind:isOpen={paymentModalOpen}
        on:close={handleModalClose}
        isNeedNeurons={false}
    />
    <SettingsModal bind:isOpen={showSettingsModal} />
</div>

<style>
    .page-container {
        display: flex;
        flex-direction: column;
        max-width: 960px;
        width: 100%;
        margin: 0 auto;
        padding: 0 1.5rem;
        height: 100%;
        box-sizing: border-box;
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
    .profile-info {
        flex-grow: 1;
    }
    .profile-details {
        background-color: var(--secondary);
        padding: 1rem;
        border-radius: var(--radius-input);
        flex-wrap: wrap;
    }
    .profile-details > div {
        display: flex;
        flex-direction: column;
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
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0;
        position: relative;
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
</style>

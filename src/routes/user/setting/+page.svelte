<script lang="ts">
    import { API_BASE_URL, PORTRAIT_URL } from "$lib/constants";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import type { Persona } from "$lib/types";
    import { logout } from "$lib/api/auth";
    import { fetchLivePersonas, setLiveStatus } from "$lib/services/live";
    import { locale, t } from "svelte-i18n";
    import AuctionModal from "$lib/components/modal/AuctionModal.svelte";
    import { Avatar } from "bits-ui";
    import NeedMoreNeuronsModal from "$lib/components/modal/NeedMoreNeuronsModal.svelte";
    import NeuronIcon from "$lib/components/icons/NeuronIcon.svelte";
    import { get } from "svelte/store";
    import type { User } from "$lib/types";
    import Icon from "@iconify/svelte";

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
    let originalUser: User | null = null; // 취소 시 복원을 위한 원본 데이터

    onMount(async () => {
        try {
            const userRes = await fetch(`${API_BASE_URL}/api/user/me`, {
                credentials: "include",
            });
            if (userRes.ok) {
                user = await userRes.json();

                if (!user.data) {
                    user.data = {
                        nickname: user.name,
                        language: get(locale) || "",
                        lastLoginAt: "",
                        createdAt: "",
                        hasReceivedFirstCreationReward: false,
                        lastLoginIP: "",
                    };
                } else {
                    if (user.data.language != "") {
                        $locale = user.data.language;
                    }
                }
            } else {
                error = "Failed to load user : " + userRes.status;
            }

            const personasRes = await fetch(
                `${API_BASE_URL}/api/persona/user`,
                {
                    credentials: "include",
                },
            );
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

    async function deletePersona(id: string) {
        const res = await fetch(`${API_BASE_URL}/api/persona/${id}`, {
            method: "DELETE",
            credentials: "include",
        });
        if (res.ok) {
            personas = personas.filter((p) => p.id !== id);
        } else {
            error = "Failed to delete persona";
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

    function confirmDelete(id: string, name: string) {
        if (confirm($t("settingPage.deleteConfirm", { values: { name } }))) {
            deletePersona(id);
        }
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
            const res = await fetch(`${API_BASE_URL}/api/user/edit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settingRq),
                credentials: "include",
            });

            if (res.ok) {
                //user = await res.json();
                isEditingProfile = false; // 성공 시 수정 모드 종료
                error = ""; // 에러 메시지 초기화
            } else {
                const errorText = await res.text();
                error = `Failed to update user settings: ${errorText}`;
            }
        } catch (err) {
            error = "Error updating settings: " + err;
        }
    }

    async function handleLanguageChange(lang: string) {
        locale.set(lang);
        saveProfileChanges();
    }
</script>

<div class="page-container">
    <div
        style="display: flex; align-items: center; justify-content: space-between;"
    >
        <div class="header">
            <h1>{$t("settingPage.title")}</h1>
        </div>
        {#if $locale}
            <div class="language-selector">
                <select
                    bind:value={$locale}
                    on:change={async (e) => {
                        locale.set(e.currentTarget.value);
                        await handleLanguageChange(e.currentTarget.value);
                    }}
                    aria-label="언어 선택"
                >
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                </select>
            </div>
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
                    <button class="btn" on:click={cancelEditing}>
                        {$t("settingPage.cancel")}
                    </button>
                    <button
                        class="btn btn-primary"
                        on:click={saveProfileChanges}
                    >
                        {$t("settingPage.save")}
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
                        <Avatar.Root class="avatar-root">
                            <Avatar.Image
                                src={`${PORTRAIT_URL}${persona.owner_id[0]}/${persona.id}.portrait`}
                                alt={persona.name}
                                class="avatar-image"
                            />
                            <Avatar.Fallback class="avatar-fallback"
                                >{persona.name.charAt(0)}</Avatar.Fallback
                            >
                        </Avatar.Root>
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
                            <button
                                class="btn btn-danger"
                                on:click={() =>
                                    confirmDelete(persona.id, persona.name)}
                                aria-label={$t("settingPage.delete")}
                            >
                                <Icon icon="ri:delete-bin-line" />
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
</div>

<style>
    :root {
        --bg-primary: #121212;
        --bg-secondary: #1e1e1e;
        --bg-tertiary: #2a2a2a;
        --text-primary: #e0e0e0;
        --text-secondary: #a0a0a0;
        --border-color: #333;
        --accent-primary: #4a90e2;
        --accent-danger: #e24a4a;
        --live-color: #e91e63;
    }
    .page-container {
        display: flex;
        flex-direction: column;
        max-width: 960px;
        margin: 0 auto;
        padding: 0 1.5rem;
        height: 100vh;
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
        position: sticky;
        top: 0;
        padding: 1rem;
        z-index: 10;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 1rem;
    }

    .personas-section::-webkit-scrollbar {
        width: 8px;
    }
    .personas-section::-webkit-scrollbar-track {
        background: var(--bg-secondary);
        border-radius: 4px;
    }
    .personas-section::-webkit-scrollbar-thumb {
        background: #555;
        border-radius: 4px;
    }
    .personas-section::-webkit-scrollbar-thumb:hover {
        background: #777;
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
        background-color: var(--bg-secondary);
        border-radius: 12px;
        padding: 1.5rem;
        border: 1px solid var(--border-color);
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
        border: 3px solid var(--border-color);
    }
    .profile-avatar-placeholder {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background-color: var(--bg-tertiary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2.5rem;
        font-weight: bold;
        color: var(--text-primary);
    }
    .profile-info {
        flex-grow: 1;
    }
    .profile-info .email {
        color: var(--text-secondary);
        font-size: 0.9rem;
    }
    .profile-details {
        background-color: var(--bg-tertiary);
        padding: 1rem;
        border-radius: 8px;
        flex-wrap: wrap;
    }
    .profile-details > div {
        display: flex;
        flex-direction: column;
    }
    .profile-details .label {
        font-size: 0.8rem;
        color: var(--text-secondary);
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
        background: var(--bg-secondary);
        border-radius: 12px;
        border: 1px solid var(--border-color);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transition:
            transform 0.2s,
            box-shadow 0.2s;
    }
    .persona-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    }

    .card-header {
        aspect-ratio: 1 / 1;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0;
        background: transparent;
        position: relative;
    }

    select {
        background-color: #2e2e2e; /* select 박스 자체의 배경색 */
        color: white; /* 선택된 값의 글자색 */
        border: 1px solid #555;
        border-radius: 8px;
        padding: 8px;
    }

    /* option 태그의 스타일. 이 부분이 많은 브라우저에서 무시됩니다. */
    select option {
        background: #333333;
        color: white;
    }

    .live-indicator {
        position: absolute;
        top: 1.5rem;
        right: 1.5rem;
        background-color: var(--live-color);
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: bold;
        box-shadow: 0 2px 5px rgba(233, 30, 99, 0.5);
    }

    .card-body {
        text-align: center;
        padding: 1.5rem;
    }
    .card-body .persona-type {
        color: var(--text-secondary);
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
        background: var(--bg-tertiary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
    }
    .btn:hover:not(:disabled) {
        background: #3c3c3c;
        border-color: #555;
    }
    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-primary {
        background: var(--accent-primary);
        border-color: var(--accent-primary);
        color: white;
    }
    .btn-primary:hover {
        background: #62a2e9;
        border-color: #62a2e9;
    }

    .btn-danger {
        background: transparent;
        border-color: var(--accent-danger);
        color: var(--accent-danger);
    }
    .btn-danger:hover {
        background: var(--accent-danger);
        color: white;
    }

    .btn-toggle.active {
        background: var(--live-color);
        border-color: var(--live-color);
        color: white;
    }

    .error {
        color: var(--accent-danger);
        background-color: rgba(226, 74, 74, 0.1);
        padding: 1rem;
        border-radius: 8px;
    }

    .creator-name {
        color: #888; /* 예시: 연한 회색으로 변경 */
        font-size: 0.75em; /* 부모 요소보다 약간 작게 */
        font-weight: bold; /* 굵게 (bold) */
        font-style: italic; /* 이탤릭체 (italic) */
    }
    .btn-logout {
        background-color: transparent;
        color: var(--text-secondary);
        border-color: var(--border-color);
    }

    .btn-logout:hover {
        background-color: rgba(226, 74, 74, 0.1); /* 붉은색 배경 (10% 투명도) */
        color: var(--accent-danger);
        border-color: var(--accent-danger);
    }

    /* 이름과 수정 아이콘을 나란히 배치하기 위한 래퍼 */
    .name-display-wrapper {
        display: flex;
        align-items: center; /* 세로 중앙 정렬 */
        gap: 0.5rem; /* 이름과 아이콘 사이 간격 */
    }

    /* 아이콘 버튼 스타일 */
    .btn-icon-edit {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        color: var(--text-secondary); /* 평상시엔 옅은 색 */
        transition: color 0.2s;
        display: inline-flex;
        align-items: center;
    }

    .btn-icon-edit:hover {
        color: var(--text-primary); /* 마우스 올리면 밝은 색 */
    }

    /* ================================== */
    /* 모바일 반응형 스타일         */
    /* ================================== */
    @media (max-width: 768px) {
        /* 페이지 전체의 기본 글자 크기를 약간 줄일 수 있습니다.
       html { font-size: 14px; } 
       (단, rem 단위를 전역적으로 사용했을 때 효과적입니다.)
    */

        /* 헤더 제목 크기 조절 */
        h1 {
            font-size: 1.75rem;
        }
        h2 {
            font-size: 1.25rem;
        }
        h3 {
            font-size: 1.1rem;
        }

        /* 프로필 섹션 글자 크기 조절 */
        .profile-info .email {
            font-size: 0.8rem;
        }
        .profile-details .label {
            font-size: 0.75rem;
        }
        .profile-details .value {
            font-size: 1rem;
        }

        /* 버튼 글자 크기 조절 */
        .btn {
            font-size: 0.8rem;
            padding: 0.5rem 1rem;
        }

        /* 페르소나 카드 내부 글자 크기 조절 */
        .card-body .persona-type {
            font-size: 0.85rem;
        }
        .creator-name {
            font-size: 0.7em;
        }
    }
</style>

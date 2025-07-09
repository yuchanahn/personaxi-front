<script lang="ts">
    import { API_BASE_URL } from "$lib/constants";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import type { Persona } from "$lib/types";
    import { logout } from "$lib/api/auth";
    import { fetchLivePersonas, setLiveStatus } from "$lib/services/live";
    import { locale, t } from "svelte-i18n";
    import AuctionModal from "$lib/components/modal/AuctionModal.svelte";
    import { Avatar } from "bits-ui";
    import PaymentModal from "$lib/components/modal/PaymentModal.svelte";

    let user: {
        id: string;
        name: string;
        credits: number;
        gender: string;
        plan: string;
        profile: string;
        email: string;
        data: {
            nickname: string;
            language: string;
            lastLoginAt: string;
            createdAt: string;
            lastLoginIP: string;
        };
    } = {
        id: "",
        name: "",
        credits: 0,
        gender: "",
        plan: "",
        profile: "",
        email: "",
        data: {
            nickname: "",
            language: "",
            lastLoginAt: "",
            createdAt: "",
            lastLoginIP: "",
        },
    };
    let personas: Persona[] = [];
    let error = "";
    let liveIds: string[] = [];

    let showAuctionModal = false;
    let selectedPersona: Persona | null = null;

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
                        language: "en",
                        lastLoginAt: "",
                        createdAt: "",
                        lastLoginIP: "",
                    };
                } else {
                    $locale = user.data.language;
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

    /*
    type UserSettingRequest struct {
	    Nickname string `json:"nickname"`
	    Language string `json:"language"`
    }
    */

    interface UserSettingRequest {
        nickname: string;
        language: string;
    }

    async function updateUserSettings(value: string) {
        const settingRq: UserSettingRequest = {
            nickname: user.data.nickname || user.name,
            language: value || "en",
        };
        const res = await fetch(`${API_BASE_URL}/api/user/edit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(settingRq),
            credentials: "include",
        });
        if (res.ok) {
            //user = await res.json();
        } else {
            error = "Failed to update user settings";
        }
    }
</script>

<div class="page-container">
    <div class="header">
        <h1>{$t("settingPage.title")}</h1>
    </div>
    {#if $locale}
        <div class="language-selector">
            <select
                bind:value={$locale}
                on:change={async (e) => {
                    locale.set(e.currentTarget.value);
                    await updateUserSettings(e.currentTarget.value);
                }}
                aria-label="언어 선택"
            >
                <option value="ko">한국어</option>
                <option value="en">English</option>
            </select>
        </div>
    {/if}

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
                <h2>{user.name}</h2>
                <p class="email">{user.email}</p>
            </div>
            <button class="btn" on:click={logout}
                >{$t("settingPage.logout")}</button
            >
        </div>
        <div class="profile-details">
            <div>
                <span class="label">{$t("settingPage.credits")}</span>
                <span class="value">{user.credits} C</span>
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
                                src={`https://uohepkqmwbstbmnkoqju.supabase.co/storage/v1/object/public/portraits/${persona.owner_id[0]}/${persona.id}.portrait`}
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
                                >
                                    {isLive(persona.id)
                                        ? $t("settingPage.broadcastEnd")
                                        : $t("settingPage.broadcastStart")}
                                </button>
                                <button
                                    class="btn"
                                    on:click={() => openAuctionModal(persona)}
                                    disabled={isLive(persona.id)}
                                >
                                    {$t("settingPage.auctionStart")}
                                </button>
                            </div>
                        {/if}
                        <div class="actions-group">
                            <button
                                class="btn"
                                on:click={() => goto(`/edit?c=${persona.id}`)}
                                >{$t("settingPage.edit")}</button
                            >
                            <button
                                class="btn btn-danger"
                                on:click={() =>
                                    confirmDelete(persona.id, persona.name)}
                                >{$t("settingPage.delete")}</button
                            >
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
    <PaymentModal
        bind:isOpen={paymentModalOpen}
        isCreditLow={false}
        on:close={handleModalClose}
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
        padding: 0 1.5rem; /* 수직 패딩은 각 섹션에서 관리하도록 변경 */
        height: 100vh; /* ★★★ 뷰포트 전체 높이를 차지하도록 설정 */
        box-sizing: border-box; /* ★★★ 패딩이 높이에 포함되도록 설정 */
    }
    .header {
        flex-shrink: 0; /* 이 영역은 줄어들지 않음 */
        padding-top: 2rem; /* 위쪽 여백 추가 */
        padding-bottom: 1rem;
    }

    /* 기존 .section-header를 아래 코드로 교체 */
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        position: sticky; /* ★★★ 스크롤 시 상단에 고정 */
        top: 0;
        background: var(
            --bg-primary
        ); /* 스크롤 시 아래 내용이 비치지 않도록 배경색 지정 */
        padding: 1rem;
        z-index: 10;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 1rem;
    }

    /* 스크롤바 디자인 (새로 추가) */
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
        flex-shrink: 0; /* 이 영역은 줄어들지 않음 */
        margin-bottom: 1rem; /* 아래쪽 여백 추가 */
    }

    .personas-section {
        display: flex;
        flex-direction: column;
        flex: 1; /* ★★★ 남은 모든 공간을 차지하도록 설정 (가장 중요) */
        min-height: 0; /* ★★★ flex 자식 요소의 넘침(overflow) 방지 */
        overflow-y: auto; /* ★★★ 내용이 넘칠 경우 이 영역만 스크롤 생성 */
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
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
    }

    .persona-card {
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
        position: relative;
        display: flex;
        justify-content: center;
        padding-top: 2rem;
        background: linear-gradient(
            180deg,
            var(--bg-tertiary) 50%,
            transparent 50%
        );
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

    .avatar-root {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        border: 4px solid var(--bg-primary);
        background-color: var(--bg-tertiary);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    }
    .avatar-image,
    .avatar-fallback {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 3rem;
        font-weight: bold;
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

    /* 공용 버튼 스타일 */
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
</style>

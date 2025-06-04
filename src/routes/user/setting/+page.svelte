<script lang="ts">
    import { API_BASE_URL } from "$lib/constants";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import type { Persona } from "$lib/types";
    import { logout } from "$lib/api/auth";
    import { fetchLivePersonas, setLiveStatus } from "$lib/services/live";
    import { createAuction } from "$lib/api/auction";
    import AuctionModal from "$lib/components/modal/AuctionModal.svelte";

    let user: {
        id: string;
        name: string;
        credits: number;
        gender: string;
        plan: string;
        profile: string;
        email: string;
    } = {
        id: "",
        name: "",
        credits: 0,
        gender: "",
        plan: "",
        profile: "",
        email: "",
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
</script>

<div class="container">
    <div class="xbox">
        <h1>User Settings</h1>
        <button on:click={logout}>Logout</button>
    </div>
    {#if error}
        <p class="error">{error}</p>
    {/if}

    <div class="user-info">
        <div class="xbox">
            {#if user.profile}
                <!-- svelte-ignore a11y_img_redundant_alt -->
                <img
                    src={user.profile}
                    alt="Profile Image"
                    width="100"
                    height="100"
                />
            {/if}
            <h2>{user.name}</h2>
        </div>
        <p>Email: {user.email}</p>
        <p>Credits: {user.credits}</p>
        <p>Plan: {user.plan}</p>
    </div>

    <div class="personas">
        <h2>Your Personas</h2>
        <button on:click={() => goto("/personaxi-front/edit")}
            >Create New Persona</button
        >
        <div class="persona-grid">
            {#each personas as persona}
                <div class="persona-card">
                    <button on:click={() => toggleLive(persona.id)}
                        >{isLive(persona.id) ? "Stop Live" : "Go Live"}</button
                    >
                    <button on:click={() => openAuctionModal(persona)}
                        >Start Auction</button
                    >
                    <div class="xbox">
                        <img
                            src={`https://uohepkqmwbstbmnkoqju.supabase.co/storage/v1/object/public/portraits/${persona.owner_id[0]}/${persona.id}.portrait`}
                            alt="portrait"
                            class="portrait"
                        />
                        <div class="ybox">
                            <h1>{persona.name}</h1>
                            <p>Type: {persona.personaType}</p>
                            <div class="actions">
                                <button
                                    on:click={() =>
                                        goto(
                                            `/personaxi-front/edit?c=${persona.id}`,
                                        )}>Edit</button
                                >
                            </div>
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
</div>

<style>
    .xbox {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
    }
    .ybox {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }
    .xbox img {
        border-radius: 50%;
        object-fit: cover;
    }
    .container {
        max-width: 800px;
        margin: 0 auto;
        padding: 1rem;
    }
    .user-info {
        margin-bottom: 2rem;
    }
    .personas {
        margin-top: 1rem;
    }
    .persona-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
    }
    .persona-card {
        background: #2a2a2a;
        padding: 1rem;
        border-radius: 8px;
        color: white;
    }
    .actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }
    button {
        padding: 0.5rem 1rem;
        background: #181818;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    button:hover {
        background: #333;
    }
    .error {
        color: red;
    }
</style>

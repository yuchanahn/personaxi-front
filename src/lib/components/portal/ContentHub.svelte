<script lang="ts">
    import { goto } from "$app/navigation";
    import { loadContent } from "$lib/api/content";
    import type { Persona } from "$lib/types";
    import { onMount } from "svelte";
    import { get, writable } from "svelte/store";
    import { fetchLivePersonas } from "$lib/services/live";
    /*
    GO lang
    type Persona struct {
    	ID             string   `json:"id"`
    	OwnerID        string   `json:"owner_id"`
    	Name           string   `json:"name"`
    	PersonaType    string   `json:"personaType"`
    	Style          string   `json:"style"`
    	Intro          string   `json:"intro"`
    	Tone           string   `json:"tone"`
    	Instructions   []string `json:"instructions"`
    	PromptExamples []string `json:"promptExamples"`
    }
    */
    let contents = writable<Persona[]>([]);

    let liveIds: string[] = [];

    onMount(async () => {
        const data = await loadContent();
        contents.set(data);

        const live = await fetchLivePersonas();
        liveIds = [...live];
    });

    $: isLive = (id: string) => liveIds.includes(id);
</script>

<img src="/personaxi-front/logo.png" alt="Logo" class="logo" />

<div class="hub">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    {#each $contents as content}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="tile"
            on:click={() => {
                switch (content.personaType) {
                    case "live":
                        goto(`/personaxi-front/live`);
                        break;
                    case "3D":
                        if (!isLive(content.id)) {
                            goto(`/personaxi-front/character?c=${content.id}`);
                        } else {
                            goto(`/personaxi-front/live?c=${content.id}`);
                        }
                        break;
                    case "2D":
                        goto(`/personaxi-front/2d?c=${content.id}`);
                        break;
                    case "text":
                        goto(`/personaxi-front/chat`);
                        break;
                }
            }}
        >
            <div class="tile-content">
                <img
                    src={`https://uohepkqmwbstbmnkoqju.supabase.co/storage/v1/object/public/portraits/${content.owner_id[0]}/${content.id}.portrait`}
                    alt="portrait"
                    class="portrait"
                />
                <div class="tile-text">
                    <strong>
                        {content.name}
                        {#if isLive(content.id)}
                            <span class="live-badge">LIVE 🔴</span>
                        {/if}
                    </strong>
                    <p>{content.style}</p>
                </div>
            </div>
        </div>
    {/each}
</div>

<style>
    .hub {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
        padding: 1rem;
    }

    .tile {
        background: #181818;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        transition: transform 0.2s;
        display: flex;
        align-items: center;
    }

    .tile:hover {
        transform: scale(1.05);
    }
    .live-badge {
        background: red;
        color: white;
        font-size: 0.7rem;
        font-weight: bold;
        padding: 0.2rem 0.5rem;
        border-radius: 6px;
        margin-left: 0.5rem;
    }

    .tile-content {
        display: flex;
        align-items: center;
        gap: 1rem;
        width: 100%;
    }

    .portrait {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #444;
    }

    .tile-text {
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .tile-text strong {
        font-size: 1.1rem;
    }

    .logo {
        width: 120px;
        height: auto;
        display: block;
        margin: 1rem auto;
    }
</style>

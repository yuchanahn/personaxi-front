<script lang="ts">
    import { createAuction } from "$lib/api/auction";
    import type { Persona } from "$lib/types";
    import { createEventDispatcher } from "svelte";
    import { t } from "svelte-i18n";

    export let persona: Persona;
    const dispatch = createEventDispatcher();

    let startBid: number = 100;
    let duration: number = 300; // 기본값 5분
    let error = "";

    async function handleSubmit() {
        try {
            await createAuction(persona.id, startBid, duration);
            dispatch("close");
        } catch (err: any) {
            error = err.message || $t("auctionModal.createFailed");
        }
    }
</script>

<div class="modal-backdrop">
    <div class="modal">
        <h2>Start Auction for {persona.name}</h2>

        <label>
            Starting Bid (Credits):
            <input type="number" bind:value={startBid} min="1" />
        </label>

        <label>
            Duration (seconds):
            <input type="number" bind:value={duration} min="60" />
        </label>

        {#if error}
            <p class="error">{error}</p>
        {/if}

        <div class="buttons">
            <button on:click={handleSubmit}>Create Auction</button>
            <button on:click={() => dispatch("close")}>Cancel</button>
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }
    .modal {
        background: #222;
        padding: 2rem;
        border-radius: 8px;
        color: white;
        width: 300px;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    input {
        width: 100%;
        padding: 0.5rem;
        background: #111;
        color: white;
        border: 1px solid #444;
        border-radius: 4px;
    }
    .buttons {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
    }
    button {
        padding: 0.5rem 1rem;
        background: #444;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
    }
    button:hover {
        background: #666;
    }
    .error {
        color: red;
    }
</style>

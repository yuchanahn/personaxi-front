<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { placeBid } from "$lib/api/auction";

    export let personaId: string;
    const dispatch = createEventDispatcher();

    let amount = 0;
    let error = "";

    async function submit() {
        try {
            await placeBid(personaId, amount);
            dispatch("close");
        } catch (e: any) {
            error = e.message;
            dispatch("error", e.message);
        }
    }
</script>

<div class="modal-backdrop">
    <h2>Enter Your Bid</h2>
    <input type="number" bind:value={amount} min="1" />
    {#if error}<p class="error">{error}</p>{/if}
    <button on:click={submit}>Submit</button>
    <button on:click={() => dispatch("close")}>Cancel</button>
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
        justify-content: center;
        align-items: center;
        z-index: 9999;
    }
</style>

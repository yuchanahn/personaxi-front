<script>
    export let session = { id: "", name: "" };
    export let onClick;
    export let onDelete;
</script>

<div class="slot">
    <button on:click={onClick}>{session.name}</button>
    <button on:click={onDelete} class="slot-delete">
        ...
    </button>

</div>


<style>
   .slot {
        display: flex;
        justify-content: left;
        align-items: left;
        height: 100%;
        background-color: none;
        color: white;
        font-size: 1.1rem;
        border-radius: 8px;
    }

    .slot:hover {
        background-color: #3e3f4b;
    }

    .slot button {
        background: none;
        border: none;
        color: inherit;
        font-size: inherit;
        cursor: pointer;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        transition: background-color 0.3s ease;
    }


    .slot-delete {
        background: none;
        border: none;
        color: inherit;
        font-size: inherit;
        cursor: pointer;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        transition: background-color 0.3s ease;
        margin-left: auto; 
    }

</style>

<script lang="ts">
    let contents = [
        { id: 1, title: "Character: Arya", type: "character" },
        { id: 2, title: "Scenario: Blood Island", type: "scenario" },
        { id: 3, title: "World: Neo-Seoul", type: "world" },
    ];
</script>

<img src="/personaxi-front/logo.png" alt="Logo" class="logo" />

<div class="hub">
    {#each contents as content}
        <div class="tile" on:click={() => alert(`Clicked ${content.title}`)}>
            <strong>{content.type.toUpperCase()}</strong>
            <p>{content.title}</p>
        </div>
    {/each}
</div>

<style>
    .hub {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
    }

    .tile:hover {
        transform: scale(1.05);
    }
    .logo {
        width: 120px;
        height: auto;
        display: block;
    }
</style>

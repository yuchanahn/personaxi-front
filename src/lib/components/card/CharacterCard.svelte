<script lang="ts">
    import type { Persona } from "$lib/types";
    import { PORTRAIT_URL } from "$lib/constants";
    import { createEventDispatcher } from "svelte";
    import Icon from "@iconify/svelte";

    export let content: Persona;
    export let isLive: (id: string) => boolean;
    export let isAuctioning: (id: string) => boolean;

    const dispatch = createEventDispatcher();

    $: assetCount = content.image_metadatas?.length || 0;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="tile" on:click={() => dispatch("click")}>
    <div class="image-container">
        <img
            src={`${PORTRAIT_URL}${content.owner_id?.[0]}/${content.id}.portrait`}
            alt={content.name}
            class="portrait-image"
        />
        {#if content.creator_name}
            <span class="creator-tag">@{content.creator_name}</span>
        {/if}
        <div class="overlay-stats">
            <span class="stat">
                <Icon icon="mdi:chat" />
                {content.chat_count}
            </span>
            <span class="stat">
                <Icon icon="mdi:image-multiple" />
                {assetCount}
            </span>
        </div>

        <div class="like-overlay">
            <Icon icon="mdi:heart" />
            {content.likes_count}
        </div>
    </div>

    <div class="tile-info">
        <div class="title-line">
            {content.name}
        </div>
        <div class="tags-line">
            {#if content.tags}
                {#each content.tags as tag}
                    <span>#{tag}</span>
                {/each}
            {/if}
        </div>
    </div>
</div>

<style>
    .tile {
        background: #1e1e1e;
        color: white;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        cursor: pointer;
        transition:
            transform 0.2s ease-in-out,
            box-shadow 0.2s ease-in-out;
        border: 1px solid #2a2a2a;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .tile:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
    }

    .image-container {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        overflow: hidden;
    }

    .portrait-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .creator-tag {
        position: absolute;
        bottom: 0.5rem;
        right: 0.5rem;
        background-color: rgba(0, 0, 0, 0.6);
        color: #f0f0f0;
        padding: 0.2rem 0.5rem;
        border-radius: 6px;
        font-size: 0.7rem;
        z-index: 2;
    }

    .overlay-stats {
        position: absolute;
        top: 0.1rem;
        right: 0.1rem;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.1rem;
        z-index: 2;
    }

    .overlay-stats .stat {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.75rem;
        color: white;
        background-color: rgba(0, 0, 0, 0.6);
        padding: 0.2rem 0.4rem;
        border-radius: 4px;
    }

    .like-overlay {
        position: absolute;
        bottom: 0.5rem;
        left: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.75rem;
        color: white;
        background-color: rgba(0, 0, 0, 0.6);
        padding: 0.2rem 0.4rem;
        border-radius: 4px;
        z-index: 2; /* 이미지 위 */
    }

    .tile-info {
        padding: 0.8rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .title-line {
        font-size: 1rem;
        font-weight: bold;
        color: #eee;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .tags-line {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-size: 0.7rem;
        color: #bbb;
    }

    .tags-line span {
        margin-right: 0.3rem;
    }

    @media (max-width: 600px) {
        .creator-tag {
            font-size: 0.5rem;
            bottom: 0.2rem;
            right: 0.2rem;
        }
        .tags-line {
            font-size: 0.6rem;
        }
        .overlay-stats .stat,
        .like-overlay {
            font-size: 0.65rem;
            padding: 0.15rem 0.3rem;
            gap: 0.2rem;
        }
    }
</style>

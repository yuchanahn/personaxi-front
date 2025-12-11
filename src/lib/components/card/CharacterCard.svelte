<script lang="ts">
    import type { ImageMetadata, PersonaDTO } from "$lib/types";
    import { createEventDispatcher } from "svelte";
    import Icon from "@iconify/svelte";
    import { goto } from "$app/navigation";
    import { allCategories } from "$lib/constants";
    import { t } from "svelte-i18n";
    import AssetPreview from "$lib/components/AssetPreview.svelte";

    export let content: PersonaDTO;

    const dispatch = createEventDispatcher();

    $: assetCount = content.image_metadatas?.length || 0;
    $: is3D = content.tags?.includes("1001");
    $: isLive2D = content.tags?.includes("1002");
    $: isSpecialType = is3D || isLive2D;

    function goToCreatorPage(event: MouseEvent) {
        event.stopPropagation();
        if (content.owner_id) {
            goto(`/creator?c=${content.owner_id.findLast((id) => id)}`);
        }
    }

    let meta: ImageMetadata;

    $: if (content && content.id) {
        meta = {
            url: content.portrait_url,
            description: "",
        };
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="tile" on:click={() => dispatch("click")}>
    <div class="image-container">
        <AssetPreview asset={meta} />

        {#if content.creator_name}
            <div class="creator-tag" on:click={goToCreatorPage}>
                <span>@{content.creator_name}</span>
            </div>
        {/if}

        {#if !isSpecialType}
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
        {/if}

        <div class="like-overlay">
            <Icon icon="mdi:heart" />
            {content.likes_count}
        </div>

        {#if content.tags && content.tags.includes("1001")}
            <div class="badge-vrm">
                <Icon icon="ph:cube-transparent-duotone" />
                <span>VRM</span>
            </div>
        {/if}

        {#if content.tags && content.tags.includes("1002")}
            <div class="badge-live2d">
                <Icon icon="ph:star-four-duotone" />
                <span>Live2D</span>
            </div>
        {/if}
    </div>

    <div class="tile-info">
        <div class="title-line">{content.name}</div>
        <div class="tags-line">
            {#if content.tags}
                {#each content.tags as tag}
                    <span
                        >#{$t(
                            `${allCategories.find((category) => category.id.toString() === tag)?.nameKey || "tags.untagged"}`,
                        )}</span
                    >
                {/each}
            {/if}
        </div>
    </div>
</div>

<style>
    .tile {
        background: var(--card);
        color: var(--foreground);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow-card);
        cursor: pointer;
        transition:
            transform 0.2s ease-in-out,
            box-shadow 0.2s ease-in-out;
        border: 1px solid var(--border-card);
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .tile:hover {
        transform: translateY(-5px);
        box-shadow: var(--shadow-popover);
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
        color: white;
        padding: 0.2rem 0.5rem;
        border-radius: var(--radius-button);
        font-size: 0.7rem;
        font-weight: 600;
        z-index: 2;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(4px);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .creator-tag:hover {
        background-color: rgba(0, 0, 0, 0.8);
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
        border-radius: var(--radius-button);
        font-weight: 600;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(4px);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
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
        border-radius: var(--radius-button);
        font-weight: 600;
        z-index: 2;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(4px);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
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
        color: var(--foreground);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .tags-line {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-size: 0.7rem;
        color: var(--muted-foreground);
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
            padding: 0.15rem 0.3rem;
        }
        .overlay-stats .stat,
        .like-overlay {
            font-size: 0.65rem;
            padding: 0.15rem 0.3rem;
            gap: 0.2rem;
        }
        .badge-vrm,
        .badge-live2d {
            font-size: 0.6rem;
            padding: 0.15rem 0.4rem;
        }
    }

    .badge-vrm {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem; /* Changed to right */
        display: flex;
        align-items: center;
        gap: 0.2rem; /* Reduced gap */
        font-size: 0.65rem; /* Reduced font size */
        font-weight: 700;
        color: white;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        padding: 0.2rem 0.5rem; /* Reduced padding */
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
        z-index: 3;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(4px);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }

    .badge-live2d {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem; /* Changed to right */
        display: flex;
        align-items: center;
        gap: 0.2rem; /* Reduced gap */
        font-size: 0.65rem; /* Reduced font size */
        font-weight: 700;
        color: white;
        background: linear-gradient(135deg, #ec4899, #f43f5e);
        padding: 0.2rem 0.5rem; /* Reduced padding */
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(236, 72, 153, 0.4);
        z-index: 3;
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(4px);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }
</style>

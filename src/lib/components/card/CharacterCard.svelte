<script lang="ts">
    import type { PersonaDTO } from "$lib/types";
    import { createEventDispatcher } from "svelte";
    import Icon from "@iconify/svelte";
    import { goto } from "$app/navigation"; // goto를 import합니다.

    export let content: PersonaDTO;

    // isLive와 isAuctioning 프롭은 더 이상 필요하지 않다면 제거해도 좋아.
    //export let isLive: (id: string) => boolean;
    //export let isAuctioning: (id: string) => boolean;

    const dispatch = createEventDispatcher();

    $: assetCount = content.image_metadatas?.length || 0;

    // 제작자 태그 클릭 핸들러
    function goToCreatorPage(event: MouseEvent) {
        // 이벤트 버블링을 막아서 카드 전체의 클릭 이벤트가 실행되지 않도록 함
        event.stopPropagation();
        if (content.owner_id) {
            goto(`/creator?c=${content.owner_id.findLast((id) => id)}`);
        }
    }
</script>

<div class="tile" on:click={() => dispatch("click")}>
    <div class="image-container">
        <img
            src={content.portrait_url}
            alt={content.name}
            class="portrait-image"
        />

        {#if content.creator_name}
            <div class="creator-tag" on:click={goToCreatorPage}>
                <span>@{content.creator_name}</span>
            </div>
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
        <div class="title-line">{content.name}</div>
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

    /* --- 🔽 제작자 태그 스타일 수정 🔽 --- */
    .creator-tag {
        position: absolute;
        bottom: 0.5rem;
        right: 0.5rem;
        background-color: hsl(var(--background) / 0.9);
        color: var(--foreground); /* white 대신 테마의 전경색 사용 */
        padding: 0.2rem 0.5rem;
        border-radius: var(--radius-button);
        font-size: 0.7rem;
        font-weight: 600;
        z-index: 2;
        border: 1px solid hsl(var(--border) / 0.5);
        backdrop-filter: blur(8px);
        text-shadow: 0 1px 2px hsl(var(--background) / 0.8);
        /* 링크처럼 보이도록 커서 및 호버 효과 추가 */
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .creator-tag:hover {
        background-color: hsl(var(--secondary) / 0.9);
    }
    /* --- 여기까지 --- */

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
        color: var(--foreground); /* aliceblue 대신 테마의 전경색 사용 */
        background-color: hsl(var(--background) / 0.9);
        padding: 0.2rem 0.4rem;
        border-radius: var(--radius-button);
        font-weight: 600;
        border: 1px solid hsl(var(--border) / 0.5);
        backdrop-filter: blur(8px);
        text-shadow: 0 1px 2px hsl(var(--background) / 0.8);
    }

    .like-overlay {
        position: absolute;
        bottom: 0.5rem;
        left: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.75rem;
        color: var(--foreground); /* white 대신 테마의 전경색 사용 */
        background-color: hsl(var(--background) / 0.9);
        padding: 0.2rem 0.4rem;
        border-radius: var(--radius-button);
        font-weight: 600;
        z-index: 2;
        border: 1px solid hsl(var(--border) / 0.5);
        backdrop-filter: blur(8px);
        text-shadow: 0 1px 2px hsl(var(--background) / 0.8);
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
        }
        .overlay-stats .stat,
        .like-overlay {
            font-size: 0.65rem;
            padding: 0.15rem 0.3rem;
            gap: 0.2rem;
        }
    }
</style>

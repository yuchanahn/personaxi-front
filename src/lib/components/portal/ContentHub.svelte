<script lang="ts">
    // 스크립트 부분은 요청하신 대로 변경 없이 그대로 두었어요!
    import { goto } from "$app/navigation";
    import {
        loadContent,
        loadContentWithTags,
        loadContentWithName,
    } from "$lib/api/content";
    import type { Persona } from "$lib/types";
    import { onMount } from "svelte";
    import { get, writable } from "svelte/store";
    import { fetchLivePersonas } from "$lib/services/live";
    import { fetchAuctionPersonas } from "$lib/services/auction";
    import type { AuctionPersona } from "$lib/services/auction";
    import { t } from "svelte-i18n";
    import { PORTRAIT_URL } from "$lib/constants";

    let contents = writable<Persona[]>([]);
    let liveIds: string[] = [];
    let auctions: AuctionPersona[] = [];

    function delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    onMount(async () => {
        const data = await loadContent();
        contents.set(data);

        const live = await fetchLivePersonas();
        auctions = await fetchAuctionPersonas();

        auctions.forEach(async (auction) => {
            const now = new Date();
            const delayTime = new Date(auction.endAt).getTime() - now.getTime();
            if (delayTime > 0) {
                await delay(delayTime);
                auctions = auctions.filter(
                    (a) => a.personaId !== auction.personaId,
                );
            }
        });

        liveIds = [...live];
    });

    $: isLive = (id: string) => liveIds.includes(id);
    $: isAuctioning = (id: string) => {
        return auctions.some((auction) => auction.personaId === id);
    };

    let query = "";
    let searchType: "name" | "tags" = "name";

    async function executeSearch() {
        if (!query.trim()) {
            const data = await loadContent();
            contents.set(data);
            return;
        }

        let data: Persona[] = [];
        if (searchType === "name") {
            data = await loadContentWithName(query);
        } else if (searchType === "tags") {
            const tags = query
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag !== "");
            if (tags.length > 0) {
                data = await loadContentWithTags(tags);
            } else {
                data = await loadContent();
            }
        }
        contents.set(data);
    }
</script>

<div class="page-wrapper">
    <!-- 헤더와 검색창은 기존과 동일해요 -->
    <div class="header-section">
        <div class="unified-search-container">
            <div class="search-options">
                <button
                    class:active={searchType === "name"}
                    on:click={() => (searchType = "name")}
                    >{$t("contentHub.searchByName")}</button
                >
                <button
                    class:active={searchType === "tags"}
                    on:click={() => (searchType = "tags")}
                    >{$t("contentHub.searchByTags")}</button
                >
            </div>
            <div class="search-input-wrapper">
                <input
                    type="text"
                    bind:value={query}
                    placeholder={searchType === "name"
                        ? $t("contentHub.searchNamePlaceholder")
                        : $t("contentHub.searchTagsPlaceholder")}
                    on:keydown={(e) => e.key === "Enter" && executeSearch()}
                />
                <button class="search-button" on:click={executeSearch}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </button>
            </div>
        </div>
    </div>

    <div class="hub-container">
        <div class="content">
            {#each $contents as content (content.id)}
                <div
                    class="tile"
                    on:click={() => {
                        switch (content.personaType) {
                            case "live":
                                goto(`/live`);
                                break;
                            case "3D":
                                if (isAuctioning(content.id)) {
                                    goto(`/auction?c=${content.id}`);
                                } else if (isLive(content.id)) {
                                    goto(`/live?c=${content.id}`);
                                } else {
                                    goto(`/character?c=${content.id}`);
                                }
                                break;
                            case "2D":
                                goto(`/2d?c=${content.id}`);
                                break;
                            case "text":
                                goto(`/chat`);
                                break;
                        }
                    }}
                >
                    <!-- 네모나고 커진 이미지! -->
                    <div class="image-container">
                        <img
                            src={`${PORTRAIT_URL}${content.owner_id[0]}/${content.id}.portrait`}
                            alt={content.name}
                            class="portrait-image"
                        />
                        {#if content.creator_name}
                            <span class="creator-tag"
                                >@{content.creator_name}</span
                            >
                        {/if}
                    </div>
                    <!-- 정보는 이미지 아래에 모아뒀어요 -->
                    <div class="tile-info">
                        <div class="title-line">
                            <strong>{content.name}</strong>
                            {#if isLive(content.id)}
                                <span class="live-badge">LIVE 🔴</span>
                            {/if}
                            {#if isAuctioning(content.id)}
                                <span class="auction-badge"
                                    >{$t("contentHub.auctionInProgress")}</span
                                >
                            {/if}
                        </div>

                        <div class="info-line">
                            <span class="like">
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="#ff79c6"
                                >
                                    <path
                                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                                    />
                                </svg>
                                {content.feedback.like}
                            </span>
                        </div>
                        <div class="tags-line">
                            {#if content.tags}
                                {#each content.tags.slice(0, 3) as tag}
                                    <span class="tag">{tag}</span>
                                {/each}

                                {#if content.tags.length > 3}
                                    <span class="tag-ellipsis">...</span>
                                {/if}
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>

<style>
    /* 페이지 레이아웃 관련 CSS (기존과 동일) */
    .page-wrapper {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background-color: #121212;
    }
    .header-section {
        flex-shrink: 0;
    }
    .hub-container {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
    }
    .hub-container > .content {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1.5rem; /* 타일 간격을 조금 더 넓혔어요 */
        padding: 1.5rem;
    }

    /* ★★★ 2. 타일과 이미지 스타일을 새롭게 바꿨어요 ★★★ */
    .tile {
        background: #1e1e1e;
        color: white;
        border-radius: 12px; /* 모서리를 좀 더 둥글게 */
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        cursor: pointer;
        transition:
            transform 0.2s ease-in-out,
            box-shadow 0.2s ease-in-out;
        border: 1px solid #2a2a2a;
        overflow: hidden; /* 이미지가 모서리를 넘어가지 않게! */

        /* flex 레이아웃을 세로 방향으로 변경 */
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
    }
    /* 새로 디자인된 네모난 이미지 스타일 */
    .portrait-image {
        width: 100%;
        height: auto;
        aspect-ratio: 1 / 1; /* 이미지를 1:1 정사각형 비율로 */
        object-fit: cover; /* 비율이 달라도 이미지가 꽉 차게 */

        display: block;
    }

    .creator-tag {
        display: inline-block;
        padding: 0.2rem 0.5rem;
        font-size: 0.7rem;
        font-weight: 500;
        border-radius: 6px;

        position: absolute; /* 부모(.image-container) 기준으로 위치 지정 */
        bottom: 0.1rem; /* 아래쪽에서 0.5rem 떨어짐 */
        right: 0.1rem; /* 오른쪽에서 0.5rem 떨어짐 */
        background-color: rgba(
            0,
            0,
            0,
            0.3
        ); /* 이미지 위에 잘 보이도록 반투명 배경 */
        color: #f0f0f015;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* 정보가 담기는 영역 스타일 */
    .tile-info {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
    }

    .live-badge,
    .auction-badge {
        font-size: 0.7rem;
        font-weight: bold;
        padding: 0.2rem 0.5rem;
        border-radius: 6px;
        color: white;
    }
    .live-badge {
        background: red;
    }
    .auction-badge {
        background: #4a90e2;
    }

    .title-line {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.2rem;
    }

    .info-line {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .like {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.9rem;
        color: #e0e0e0;
    }

    .tags-line {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    /* @제작자이름 태그(작은 네모 박스) 스타일 */
    .creator-tag {
        display: inline-block;
        padding: 0.1rem 0.3rem;
        font-size: 0.6rem;
        font-weight: 300;
        background-color: #3a3a3ab7; /* 다른 태그와 살짝 다른 배경색 */
        color: #e2e2e2;
        border-radius: 6px;
        border: 1px solid #4a4a4a;
    }

    .tag,
    .tag-ellipsis {
        background-color: #333;
        color: #e0e0e0;
        padding: 0.2rem 0.6rem;
        border-radius: 10px;
        font-size: 0.75rem;
        font-weight: 500;
    }

    /* 검색창 관련 CSS (기존과 동일) */
    .unified-search-container {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        /* 위쪽 패딩 값을 1.5rem으로 추가해서 아래로 내렸어요! */
        padding: 3.5rem 1rem 1.5rem 1rem;
    }
    .search-options {
        display: flex;
        flex-shrink: 0;
        gap: 0.5rem;
        background-color: #2a2a2a;
        padding: 0.25rem;
        border-radius: 8px;
    }
    .search-options button {
        padding: 0.4rem 0.8rem;
        font-size: 0.8rem;
        font-weight: 500;
        background-color: transparent;
        color: #aaa;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
        white-space: nowrap;
    }
    .search-options button.active {
        background-color: #4a4a4a;
        color: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .search-input-wrapper {
        position: relative;
        width: 100%;
        max-width: 400px;
    }
    .search-input-wrapper input {
        background-color: #2a2a2a;
        border: 1px solid #444;
        color: white;
        padding: 0.75rem 3rem 0.75rem 1rem;
        font-size: 1rem;
        border-radius: 8px;
        width: 100%;
        transition:
            border-color 0.2s,
            box-shadow 0.2s;
    }
    .search-input-wrapper input:focus {
        outline: none;
        border-color: #5a5a5a;
        box-shadow: 0 0 0 2px rgba(90, 90, 90, 0.5);
    }
    .search-input-wrapper input::placeholder {
        color: #888;
    }
    .search-button {
        position: absolute;
        right: 0.5rem;
        top: 50%;
        transform: translateY(-50%);
        padding: 0.5rem;
        background: none;
        border: none;
        color: #bbb;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: background-color 0.2s;
    }
    .search-button:hover {
        color: white;
        background-color: #333;
    }

    @media (max-width: 768px) {
        .hub-container > .content {
            grid-template-columns: repeat(3, 1fr);

            gap: 0.5rem;
            padding: 0.5rem;
        }

        .tile-info {
            padding: 0.5rem;
        }

        .title-line {
            font-size: 0.9rem;
        }
    }
</style>

<script lang="ts">
    // 스크립트 부분은 변경 없음 (기존 코드 그대로)
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
    <div class="header-section">
        <img src="/logo.png" alt="Logo" class="logo" />

        <div class="unified-search-container">
            <div class="search-options">
                <button
                    class:active={searchType === "name"}
                    on:click={() => (searchType = "name")}>이름</button
                >
                <button
                    class:active={searchType === "tags"}
                    on:click={() => (searchType = "tags")}>태그</button
                >
            </div>
            <div class="search-input-wrapper">
                <input
                    type="text"
                    bind:value={query}
                    placeholder={searchType === "name"
                        ? "캐릭터 이름으로 검색"
                        : "태그로 검색 (쉼표로 구분)"}
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
                    <div class="tile-content">
                        <img
                            src={`https://uohepkqmwbstbmnkoqju.supabase.co/storage/v1/object/public/portraits/${content.owner_id[0]}/${content.id}.portrait`}
                            alt="portrait"
                            class="portrait"
                        />
                        <div class="tile-text">
                            <div class="title-line">
                                <strong>{content.name}</strong>
                                {#if isLive(content.id)}
                                    <span class="live-badge">LIVE 🔴</span>
                                {/if}
                                {#if isAuctioning(content.id)}
                                    <span class="auction-badge">경매 중</span>
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
                </div>
            {/each}
        </div>
    </div>
</div>

<style>
    /* ▼▼▼ 2. Wrapper 와 Layout 관련 CSS 수정 ▼▼▼ */
    .page-wrapper {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background-color: #121212; /* 전체 배경색 */
    }

    .header-section {
        flex-shrink: 0; /* 헤더는 줄어들지 않도록 설정 */
    }

    .hub-container {
        flex: 1; /* 남은 공간을 모두 차지하도록 설정 */
        overflow-y: auto; /* 내용이 넘칠 경우 스크롤 생성 */
        min-height: 0; /* flex 자식요소가 부모를 넘치지 않게 하기 위한 핵심 속성 */
    }
    /* ▲▲▲ CSS 수정 끝 ▲▲▲ */

    .hub-container > .content {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
        padding: 1rem;
    }

    .tile {
        background: #1e1e1e;
        color: white;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        cursor: pointer;
        transition:
            transform 0.2s ease-in-out,
            box-shadow 0.2s ease-in-out;
        display: flex;
        align-items: center;
        border: 1px solid #2a2a2a;
    }

    .tile:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
    }

    .live-badge {
        background: red;
        color: white;
        font-size: 0.7rem;
        font-weight: bold;
        padding: 0.2rem 0.5rem;
        border-radius: 6px;
    }
    .auction-badge {
        background: #4a90e2;
        color: white;
        font-size: 0.7rem;
        font-weight: bold;
        padding: 0.2rem 0.5rem;
        border-radius: 6px;
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
        border: 2px solid #555;
    }

    .tile-text {
        display: flex;
        flex-direction: column;
        gap: 0.5rem; /* 텍스트 내부 요소들 간의 간격 */
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

    .tags-line {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .tag-ellipsis {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #333;
        color: #e0e0e0;
        padding: 0.2rem 0.6rem;
        border-radius: 10px;
        font-size: 0.75rem;
        font-weight: 500;
    }

    .like {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.9rem;
        color: #e0e0e0;
    }

    .like svg {
        fill: #ff79c6;
    }

    .tag {
        background-color: #333;
        color: #e0e0e0;
        padding: 0.2rem 0.6rem;
        border-radius: 10px;
        font-size: 0.75rem;
        font-weight: 500;
    }

    .logo {
        width: 120px;
        height: auto;
        display: block;
        margin: 1rem auto;
    }
    /* 개편된 검색 시스템 CSS */
    .unified-search-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 0 1rem 1.5rem 1rem;
    }

    .search-options {
        display: flex;
        gap: 0.5rem;
        background-color: #2a2a2a;
        padding: 0.25rem;
        border-radius: 8px;
    }

    .search-options button {
        padding: 0.4rem 1rem;
        font-size: 0.9rem;
        font-weight: 500;
        background-color: transparent;
        color: #aaa;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
    }

    .search-options button.active {
        background-color: #4a4a4a;
        color: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .search-input-wrapper {
        position: relative;
        width: 100%;
        max-width: 400px; /* 최대 너비 설정 */
    }

    .search-input-wrapper input {
        background-color: #2a2a2a;
        border: 1px solid #444;
        color: white;
        padding: 0.75rem 3rem 0.75rem 1rem; /* 오른쪽 패딩 확보 */
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
</style>

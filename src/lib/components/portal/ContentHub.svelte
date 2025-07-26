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
    import CharacterCard from "../card/CharacterCard.svelte";

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
                <!-- svelte-ignore a11y_consider_explicit_label -->
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
                <CharacterCard
                    {content}
                    {isLive}
                    {isAuctioning}
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
                                    goto(`/profile?c=${content.id}`);
                                }
                                break;
                            case "2D":
                                goto(`/profile?c=${content.id}`);
                                break;
                            case "text":
                                goto(`/chat`);
                                break;
                        }
                    }}
                />
            {/each}
        </div>
    </div>
</div>

<style>
    .page-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
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

    /* 검색창 관련 CSS (기존과 동일) */
    .unified-search-container {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
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
            /* 카드 내부가 아닌, 카드들을 담는 '그리드'에 대한 반응형 스타일은 여기 남아야 해! */
            grid-template-columns: repeat(3, 1fr);
            gap: 0.5rem;
            padding: 0.5rem;
        }
    }
</style>

<script lang="ts">
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

    // 검색 상태용 추가
    let tagQuery = "";
    let nameQuery = "";

    function delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    onMount(async () => {
        const data = await loadContent();
        contents.set(data);

        const live = await fetchLivePersonas();
        auctions = await fetchAuctionPersonas();

        // auction.endAt을 기준으로 끝나면 배열에서 제거
        // 타이머 사용

        auctions.forEach(async (auction) => {
            const now = new Date();
            await delay(new Date(auction.endAt).getTime() - now.getTime());
            auctions = auctions.filter(
                (a) => a.personaId !== auction.personaId,
            );
        });

        liveIds = [...live];
    });

    $: isLive = (id: string) => liveIds.includes(id);
    $: isAuctioning = (id: string) => {
        const auctioned = auctions.find((auction) => auction.personaId === id);
        if (!auctioned) return false;
        return !!auctioned;
    };

    // 태그 검색 함수
    async function searchByTags() {
        if (!tagQuery.trim()) {
            const data = await loadContent();
            contents.set(data);
            return;
        }

        const tags = tagQuery
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag !== "");
        const data = await loadContentWithTags(tags);
        contents.set(data);
    }

    // 이름 검색 함수
    async function searchByName() {
        if (!nameQuery.trim()) {
            const data = await loadContent();
            contents.set(data);
            return;
        }

        const data = await loadContentWithName(nameQuery);
        contents.set(data);
    }
</script>

<img src="/logo.png" alt="Logo" class="logo" />

<div class="search-section">
    <input
        type="text"
        bind:value={tagQuery}
        placeholder="태그 검색 (예: 태그1,태그2)"
    />
    <button on:click={searchByTags}>태그 검색</button>

    <input type="text" bind:value={nameQuery} placeholder="이름 검색" />
    <button on:click={searchByName}>이름 검색</button>
</div>

<div class="hub">
    {#each $contents as content}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
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
                            break;
                        }
                        if (!isLive(content.id)) {
                            goto(`/character?c=${content.id}`);
                        } else {
                            goto(`/live?c=${content.id}`);
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
                    <strong>
                        {content.name}
                        {#if isLive(content.id)}
                            <span class="live-badge">LIVE 🔴</span>
                        {/if}
                        <!-- 경매 중인 캐릭터 표시 -->
                        {#if isAuctioning(content.id)}
                            <span class="auction-badge">경매 중</span>
                        {/if}
                    </strong>
                    <div
                        style="display: flex; align-items: center; gap: 0.5rem;"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="size-5"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 0 0 1.28.53l3.58-3.579a.78.78 0 0 1 .527-.224 41.202 41.202 0 0 0 5.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                                clip-rule="evenodd"
                            />
                        </svg>
                        <p>{content.feedback.view}</p>
                    </div>

                    <div
                        style="display: flex; align-items: center; gap: 0.5rem;"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            class="size-6"
                        >
                            <path
                                d="M7.493 18.5c-.425 0-.82-.236-.975-.632A7.48 7.48 0 0 1 6 15.125c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75A.75.75 0 0 1 15 2a2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23h-.777ZM2.331 10.727a11.969 11.969 0 0 0-.831 4.398 12 12 0 0 0 .52 3.507C2.28 19.482 3.105 20 3.994 20H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 0 1-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227Z"
                            />
                        </svg>
                        <p>{content.feedback.like}</p>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            class="size-6"
                        >
                            <path
                                d="M15.73 5.5h1.035A7.465 7.465 0 0 1 18 9.625a7.465 7.465 0 0 1-1.235 4.125h-.148c-.806 0-1.534.446-2.031 1.08a9.04 9.04 0 0 1-2.861 2.4c-.723.384-1.35.956-1.653 1.715a4.499 4.499 0 0 0-.322 1.672v.633A.75.75 0 0 1 9 22a2.25 2.25 0 0 1-2.25-2.25c0-1.152.26-2.243.723-3.218.266-.558-.107-1.282-.725-1.282H3.622c-1.026 0-1.945-.694-2.054-1.715A12.137 12.137 0 0 1 1.5 12.25c0-2.848.992-5.464 2.649-7.521C4.537 4.247 5.136 4 5.754 4H9.77a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23ZM21.669 14.023c.536-1.362.831-2.845.831-4.398 0-1.22-.182-2.398-.52-3.507-.26-.85-1.084-1.368-1.973-1.368H19.1c-.445 0-.72.498-.523.898.591 1.2.924 2.55.924 3.977a8.958 8.958 0 0 1-1.302 4.666c-.245.403.028.959.5.959h1.053c.832 0 1.612-.453 1.918-1.227Z"
                            />
                        </svg>
                        <p>{content.feedback.dislike}</p>
                    </div>
                    <!-- <p>{content.tags.join(", ")}</p> -->
                </div>
            </div>
        </div>
    {/each}
</div>

<style>
    .hub {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
        display: flex;
        align-items: center;
    }

    .tile:hover {
        transform: scale(1.05);
    }

    .live-badge {
        background: red;
        color: white;
        font-size: 0.7rem;
        font-weight: bold;
        padding: 0.2rem 0.5rem;
        border-radius: 6px;
        margin-left: 0.5rem;
    }
    .auction-badge {
        background: rgb(238, 238, 238);
        color: rgb(0, 0, 0);
        font-size: 0.7rem;
        font-weight: bold;
        padding: 0.2rem 0.5rem;
        border-radius: 6px;
        margin-left: 0.5rem;
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
        border: 2px solid #444;
    }

    .tile-text {
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .tile-text strong {
        font-size: 1.1rem;
    }

    .logo {
        width: 120px;
        height: auto;
        display: block;
        margin: 1rem auto;
    }

    .search-section {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin: 1rem;
    }

    .search-section input {
        padding: 0.5rem;
        font-size: 1rem;
        width: 200px;
    }

    .search-section button {
        padding: 0.5rem 1rem;
        font-size: 1rem;
        background-color: #333;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .search-section button:hover {
        background-color: #555;
    }
</style>

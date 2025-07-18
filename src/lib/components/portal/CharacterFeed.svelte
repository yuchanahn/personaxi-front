<script lang="ts">
    // ▼▼▼ 기존 컴포넌트의 스크립트 로직을 거의 그대로 가져왔어요. ▼▼▼
    import { goto } from "$app/navigation";
    import {
        loadContent,
        loadContentWithName,
        loadContentWithTags,
    } from "$lib/api/content";
    import type { Persona } from "$lib/types";
    import { onMount } from "svelte";
    import { get, writable } from "svelte/store";
    import { fetchLivePersonas } from "$lib/services/live";
    import { fetchAuctionPersonas } from "$lib/services/auction";
    import type { AuctionPersona } from "$lib/services/auction";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { PORTRAIT_URL } from "$lib/constants";

    let contents = writable<Persona[]>([]);
    let liveIds: string[] = [];
    let auctions: AuctionPersona[] = [];

    // 데이터 로딩 (기존과 동일)
    onMount(async () => {
        const data = await loadContent();
        contents.set(data);

        const live = await fetchLivePersonas();
        auctions = await fetchAuctionPersonas();
        liveIds = [...live];
    });

    // 상태 체크 함수 (기존과 동일)
    $: isLive = (id: string) => liveIds.includes(id);
    $: isAuctioning = (id: string) => {
        return auctions.some((auction) => auction.personaId === id);
    };

    // 캐릭터 클릭 시 적절한 페이지로 이동시키는 함수
    function navigateToCharacter(content: Persona) {
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
    }
</script>

<div class="feed-container">
    {#each $contents as content (content.id)}
        <section
            class="reel"
            style="background-image: url({PORTRAIT_URL}{content
                .owner_id[0]}/{content.id}.portrait);"
        >
            <div class="overlay">
                <div class="info-box">
                    <div class="name-line">
                        <strong class="name">{content.name}</strong>
                        {#if isLive(content.id)}
                            <span class="badge live">LIVE</span>
                        {/if}
                        {#if isAuctioning(content.id)}
                            <span class="badge auction">AUCTION</span>
                        {/if}
                    </div>

                    <div class="tags-line">
                        {#if content.tags}
                            {#each content.tags.slice(0, 4) as tag}
                                <span class="tag">#{tag}</span>
                            {/each}
                        {/if}
                    </div>
                </div>

                <div class="action-sidebar">
                    <button
                        class="action-button"
                        on:click={() => navigateToCharacter(content)}
                    >
                        <Icon
                            icon="ph:chat-circle-dots-duotone"
                            width="32"
                            height="32"
                        />
                        <span class="action-label">{$t("feed.interact")}</span>
                    </button>
                    <button class="action-button">
                        <Icon icon="ph:heart-duotone" width="32" height="32" />
                        <span class="action-label">{content.feedback.like}</span
                        >
                    </button>
                </div>
            </div>
        </section>
    {/each}
</div>

<style>
    /* 전체 피드 컨테이너: 세로 스크롤 스냅을 적용해 틱톡처럼 보이게 하는 핵심 부분! */
    .feed-container {
        width: 100%;
        height: 100vh; /* 화면 전체 높이를 차지 */
        overflow-y: scroll; /* 세로 스크롤 활성화 */
        scroll-snap-type: y mandatory; /* Y축(세로)으로 스크롤이 딱딱 끊어지게 설정 */
        background-color: #121212;
        /* 모바일에서 스크롤바 숨기기 */
        -ms-overflow-style: none; /* IE and Edge */
        scrollbar-width: none; /* Firefox */
    }
    .feed-container::-webkit-scrollbar {
        display: none; /* Chrome, Safari, Opera*/
    }

    /* 개별 캐릭터를 보여주는 '릴' */
    .reel {
        width: 100%;
        height: 100vh; /* 화면 전체 높이 */
        scroll-snap-align: start; /* 스크롤 시 이 요소의 시작 부분에 맞춰 멈춤 */
        position: relative; /* 자식 요소인 오버레이를 위한 기준점 */
        display: flex;
        align-items: center;
        justify-content: center;

        /* 캐릭터 이미지를 배경으로 설정 */
        background-size: cover;
        background-position: center;
        color: white;
    }

    /* 정보가 표시되는 오버레이 */
    .overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        top: 0;
        display: flex;
        justify-content: space-between; /* 정보는 왼쪽, 액션 버튼은 오른쪽에 배치 */
        align-items: flex-end; /* 모든 요소를 하단에 정렬 */
        padding: 1rem 1rem 3rem 1rem; /* 하단 여백을 더 줘서 모바일 제스처와 겹치지 않게 함 */

        /* 텍스트가 잘 보이도록 배경에 어두운 그라데이션 추가 */
        background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.7) 0%,
            rgba(0, 0, 0, 0) 50%
        );
    }

    /* 이름, 태그 등 정보 영역 */
    .info-box {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8); /* 텍스트 가독성을 위한 그림자 */
    }

    .name-line {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .name {
        font-size: 1.8rem;
        font-weight: bold;
    }

    /* 뱃지 공통 스타일 */
    .badge {
        font-size: 0.75rem;
        font-weight: bold;
        padding: 0.2rem 0.5rem;
        border-radius: 6px;
        color: white;
    }
    .badge.live {
        background-color: #e91e63; /* 좀 더 톡톡 튀는 색으로 */
    }
    .badge.auction {
        background-color: #3f51b5;
    }

    .tags-line {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .tag {
        background-color: rgba(255, 255, 255, 0.2);
        padding: 0.25rem 0.6rem;
        border-radius: 12px;
        font-size: 0.85rem;
    }

    /* 오른쪽 액션 버튼 사이드바 */
    .action-sidebar {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem; /* 버튼 사이 간격 */
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
    }
    .action-button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
        padding: 0;
        transition: transform 0.2s ease;
    }
    .action-button:hover {
        transform: scale(1.1); /* 살짝 커지는 호버 효과 */
    }
    .action-label {
        font-size: 0.9rem;
        font-weight: 500;
    }
</style>

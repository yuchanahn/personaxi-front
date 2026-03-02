<script lang="ts">
    import { goto } from "$app/navigation";
    import Icon from "@iconify/svelte";
    import { onMount } from "svelte";

    export let banners: {
        id: string;
        title: string;
        subtitle: string;
        imageUrl: string;
        linkUrl: string;
        actionText?: string;
        bgColor?: string;
    }[] = [];

    let currentIndex = 0;
    let timer: ReturnType<typeof setInterval>;

    function nextBanner() {
        currentIndex = (currentIndex + 1) % banners.length;
    }

    function setBanner(index: number) {
        currentIndex = index;
    }

    onMount(() => {
        if (banners.length > 1) {
            timer = setInterval(nextBanner, 5000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    });

    function handleBannerClick(link: string) {
        if (link.startsWith("http")) {
            window.open(link, "_blank");
        } else {
            goto(link);
        }
    }
</script>

{#if banners.length > 0}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="hub-banner-container">
        <div
            class="banner-track"
            style="transform: translateX(-{currentIndex * 100}%);"
        >
            {#each banners as banner}
                <div
                    class="banner-slide"
                    on:click={() => handleBannerClick(banner.linkUrl)}
                >
                    <div class="banner-bg">
                        <img src={banner.imageUrl} alt={banner.title} />
                        <div
                            class="gradient-overlay"
                            style="background: {banner.bgColor ||
                                'linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 100%)'}"
                        ></div>
                    </div>
                    <div class="banner-content">
                        <h2 class="banner-title">{banner.title}</h2>
                        <p class="banner-subtitle">{banner.subtitle}</p>
                        {#if banner.actionText}
                            <button class="banner-action">
                                {banner.actionText}
                                <Icon icon="ph:arrow-right-bold" />
                            </button>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>

        {#if banners.length > 1}
            <div class="banner-indicators">
                {#each banners as _, i}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                        class="indicator {i === currentIndex ? 'active' : ''}"
                        on:click={() => setBanner(i)}
                    ></div>
                {/each}
            </div>
        {/if}
    </div>
{/if}

<style>
    .hub-banner-container {
        position: relative;
        width: 100%;
        height: 130px; /* Reduced for mobile */
        border-radius: 16px;
        overflow: hidden;
        margin-bottom: 24px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        cursor: pointer;
    }

    @media (min-width: 768px) {
        .hub-banner-container {
            height: 200px;
        }
    }

    .banner-track {
        display: flex;
        width: 100%;
        height: 100%;
        transition: transform 0.5s cubic-bezier(0.25, 1, 0.5, 1);
    }

    .banner-slide {
        flex: 0 0 100%;
        width: 100%;
        height: 100%;
        position: relative;
    }

    .banner-bg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    .banner-bg img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 25%; /* Frame the character's face perfectly */
    }

    .gradient-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
    }

    .banner-content {
        position: relative;
        z-index: 2;
        padding: 16px 20px; /* Thinner padding on mobile */
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        color: white;
    }

    @media (min-width: 768px) {
        .banner-content {
            padding: 24px 32px;
        }
    }

    .banner-title {
        font-size: 1.25rem;
        font-weight: 800;
        margin: 0 0 4px 0;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    }

    @media (min-width: 768px) {
        .banner-title {
            font-size: 2rem;
            margin: 0 0 8px 0;
        }
    }

    .banner-subtitle {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.9);
        margin: 0 0 12px 0;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        max-width: 90%;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    @media (min-width: 768px) {
        .banner-subtitle {
            font-size: 1rem;
            margin: 0 0 16px 0;
            max-width: 80%;
            -webkit-line-clamp: unset;
        }
    }

    .banner-action {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 6px 14px;
        border-radius: 16px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    @media (min-width: 768px) {
        .banner-action {
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
        }
    }

    .banner-action:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: translateY(-2px);
    }

    .banner-indicators {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 8px;
        z-index: 3;
    }

    .indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.4);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .indicator.active {
        background: white;
        transform: scale(1.2);
        width: 20px;
        border-radius: 4px;
    }
</style>

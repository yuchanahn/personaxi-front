<script lang="ts">
    import type { Persona, ImageMetadata } from "$lib/types";
    import { createEventDispatcher, onMount, onDestroy } from "svelte";
    import Icon from "@iconify/svelte";
    import { goto } from "$app/navigation";
    import AssetPreview from "$lib/components/AssetPreview.svelte";

    export let persona: Persona;
    export let isActive: boolean = false;

    const dispatch = createEventDispatcher();

    // -- Image Cycling --
    let currentImageIndex = 0;
    let images: ImageMetadata[] = [];
    let imageInterval: ReturnType<typeof setInterval>;

    $: {
        let imgs: ImageMetadata[] = [];
        // Portrait
        imgs.push({ url: persona.portrait_url, description: "portrait" });
        // Assets (already filtered/limited by backend, but safe to limit again)
        if (persona.image_metadatas) {
            imgs = [...imgs, ...persona.image_metadatas];
        }
        images = imgs;
    }

    function startImageCycle() {
        stopImageCycle();
        if (images.length > 1) {
            imageInterval = setInterval(() => {
                currentImageIndex = (currentImageIndex + 1) % images.length;
            }, 5000); // 5 seconds
        }
    }

    function stopImageCycle() {
        if (imageInterval) clearInterval(imageInterval);
    }

    // -- Typewriter Effect --
    let displayedText = "";
    let typewriterInterval: ReturnType<typeof setInterval>;
    let isTypingFinished = false;

    function startTypewriter() {
        if (!persona.one_liner) {
            displayedText = persona.greeting || "";
            return;
        }
        displayedText = "";
        isTypingFinished = false;
        let i = 0;
        const text = persona.one_liner;
        stopTypewriter();

        typewriterInterval = setInterval(() => {
            if (i < text.length) {
                displayedText += text.charAt(i);
                i++;
            } else {
                stopTypewriter();
                isTypingFinished = true;
            }
        }, 50); // Speed
    }

    function stopTypewriter() {
        if (typewriterInterval) clearInterval(typewriterInterval);
    }

    $: if (isActive) {
        startImageCycle();
        startTypewriter();
    } else {
        stopImageCycle();
        stopTypewriter();
        currentImageIndex = 0; // Reset image
        // Reset text? Maybe not, keeps it smooth if scrolling back
    }

    onDestroy(() => {
        stopImageCycle();
        stopTypewriter();
    });

    function handleCreatorClick(e: MouseEvent) {
        e.stopPropagation();
        if (persona.owner_id && persona.owner_id.length > 0) {
            // Usually first owner
            goto(`/creator?c=${persona.owner_id[0]}`);
        }
    }

    function handleChat(e: MouseEvent) {
        e.stopPropagation();
        goto(`/chat/${persona.id}`);
    }
</script>

<div class="feed-item" on:click={() => dispatch("click")}>
    <!-- Background Image -->
    <div class="image-layer">
        {#if images.length > 0}
            {#key currentImageIndex}
                <div class="fade-in">
                    <AssetPreview asset={images[currentImageIndex]} />
                </div>
            {/key}
        {/if}
        <div class="gradient-overlay"></div>
    </div>

    <!-- Info Overlay -->
    <div class="info-layer">
        <div class="header">
            <div class="creator-badge" on:click={handleCreatorClick}>
                <Icon icon="ph:user-circle-duotone" />
                <span>{persona.creator_name}</span>
            </div>

            <!-- Badges -->
            <div class="badges">
                {#if persona.personaType === "3D" || persona.tags?.includes("1001")}
                    <div class="badge vrm">
                        <Icon icon="ph:cube-transparent-duotone" /> VRM
                    </div>
                {/if}
                {#if persona.personaType === "2D" && persona.live2d_model_url}
                    <div class="badge live2d">
                        <Icon icon="ph:star-four-duotone" /> Live2D
                    </div>
                {/if}
            </div>
        </div>

        <div class="content-area">
            <h2 class="name">{persona.name}</h2>

            <div class="one-liner-container">
                <p class="one-liner">
                    {displayedText}
                    {#if isActive && !isTypingFinished && persona.one_liner}
                        <span class="cursor">|</span>
                    {/if}
                </p>
                {#if !persona.one_liner}
                    <p class="greeting-fallback">{persona.greeting}</p>
                {/if}
            </div>

            <div class="stats-row">
                <div class="stat">
                    <Icon icon="mdi:heart" />
                    {persona.likes_count}
                </div>
                <div class="stat">
                    <Icon icon="mdi:chat" />
                    {persona.chat_count}
                </div>
            </div>
        </div>

        <div class="actions-area">
            <button class="action-btn chat-btn" on:click={handleChat}>
                <Icon icon="ph:chat-circle-text-fill" width="24" />
                <span>Chat</span>
            </button>
            <button
                class="action-btn info-btn"
                on:click={() => goto(`/profile?c=${persona.id}`)}
            >
                <Icon icon="ph:info" width="24" />
            </button>
        </div>
    </div>
</div>

<style>
    .feed-item {
        position: relative;
        width: 100%;
        height: 100%; /* Parent should be h-screen or 100% of container */
        background-color: #000;
        overflow: hidden;
        scroll-snap-align: start;
        flex-shrink: 0;
    }

    .image-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
    }

    .fade-in {
        width: 100%;
        height: 100%;
        animation: fadeIn 0.5s ease-in-out;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    .gradient-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 60%;
        background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.95),
            rgba(0, 0, 0, 0)
        );
        z-index: 2;
        pointer-events: none;
    }

    .info-layer {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        padding: 24px 20px calc(110px + env(safe-area-inset-bottom)) 20px; /* Bottom padding for nav bar space approx */
        z-index: 10;
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: white;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    .creator-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 0.85rem;
        cursor: pointer;
        transition: background 0.2s;
    }
    .creator-badge:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    .badges {
        display: flex;
        gap: 6px;
    }
    .badge {
        font-size: 0.7rem;
        padding: 4px 8px;
        border-radius: 6px;
        font-weight: bold;
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .badge.vrm {
        background: #6366f1;
    }
    .badge.live2d {
        background: #ec4899;
    }

    .name {
        font-size: 2rem;
        font-weight: 800;
        line-height: 1.1;
        margin: 0;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    }

    .one-liner-container {
        min-height: 3rem; /* Reserve space */
    }

    .one-liner {
        font-size: 1.1rem;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.9);
        margin: 0;
        line-height: 1.4;
    }

    .greeting-fallback {
        font-size: 0.95rem;
        color: rgba(255, 255, 255, 0.7);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .cursor {
        animation: blink 1s step-end infinite;
    }
    @keyframes blink {
        50% {
            opacity: 0;
        }
    }

    .stats-row {
        display: flex;
        gap: 16px;
        margin-top: 8px;
    }
    .stat {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.8);
    }

    .actions-area {
        display: flex;
        gap: 12px;
        margin-top: 16px;
    }

    .action-btn {
        height: 44px;
        border-radius: 22px;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.1s;
    }
    .action-btn:active {
        transform: scale(0.95);
    }

    .chat-btn {
        flex: 1;
        background: white;
        color: black;
        font-size: 1rem;
    }

    .info-btn {
        width: 44px;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        backdrop-filter: blur(5px);
    }
</style>

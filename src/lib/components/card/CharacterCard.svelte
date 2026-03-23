<script lang="ts">
    import type { ImageMetadata, PersonaDTO } from "$lib/types";
    import { createEventDispatcher } from "svelte";
    import Icon from "@iconify/svelte";
    import { goto } from "$app/navigation";
    import { allCategories } from "$lib/constants";
    import { t } from "svelte-i18n";
    import AssetPreview from "$lib/components/AssetPreview.svelte";
    import { getOptimizedSupabaseImageUrl } from "$lib/utils/mediaTransform";

    export let content: PersonaDTO;

    const dispatch = createEventDispatcher();

    $: is3D = content.tags?.includes("1001");
    $: isLive2D = content.tags?.includes("1002");
    $: visibleTags =
        content.tags?.filter((tag) => {
            if (tag === "1001" || tag === "1002") {
                return false;
            }
            if (tag === "1003") {
                return false;
            }
            return true;
        }) ?? [];

    function goToCreatorPage(event: MouseEvent) {
        event.stopPropagation();
        if (content.owner_id) {
            goto(`/creator?c=${content.owner_id.findLast((id) => id)}`);
        }
    }

    function getTagLabel(tag: string) {
        return $t(
            `${allCategories.find((category) => category.id.toString() === tag)?.nameKey || "tags.untagged"}`,
        );
    }

    function formatCompactCount(value: number) {
        if (!Number.isFinite(value)) return "0";
        if (value < 1000) return `${value}`;

        const units = [
            { value: 1_000_000_000, suffix: "b" },
            { value: 1_000_000, suffix: "m" },
            { value: 1_000, suffix: "k" },
        ];

        for (const unit of units) {
            if (value >= unit.value) {
                const compact = Math.floor((value / unit.value) * 10) / 10;
                return `${compact.toString().replace(/\.0$/, "")}${unit.suffix}`;
            }
        }

        return `${value}`;
    }

    let meta: ImageMetadata = {
        url: "",
        description: "",
        type: "unknown",
    };

    $: if (content && content.id) {
        const optimizedStaticUrl = content.static_portrait_url
            ? getOptimizedSupabaseImageUrl(content.static_portrait_url, {
                  width: 480,
                  quality: 72,
              })
            : "";

        meta = {
            url: optimizedStaticUrl || content.portrait_url,
            static_url: optimizedStaticUrl || undefined,
            description: "",
            // Hub cards are thumbnail-only. Force image mode to avoid probing the
            // original portrait URL and keep video profiles on their static poster.
            type: "image",
        };
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="tile" on:click={() => dispatch("click")}>
    <div class="image-container">
        <div class="media-wrapper">
            <AssetPreview
                asset={meta}
                showVideoPosterFallback={true}
                enableVideoPlayback={false}
            />
        </div>

        <span class="chat-stat">
            <Icon icon="mdi:chat-outline" />
            <strong>{formatCompactCount(content.chat_count)}</strong>
        </span>

        {#if is3D || isLive2D}
            <div
                class:is-vrm={is3D}
                class:is-live2d={isLive2D}
                class="type-badge"
            >
                <Icon
                    icon={is3D
                        ? "ph:cube-transparent-duotone"
                        : "ph:star-four-duotone"}
                />
                <span>{is3D ? "VRM" : "Live2D"}</span>
            </div>
        {/if}

        <div class="tile-info">
            <div class="title-line">{content.name}</div>
            <div class="meta-line">
                {#if content.creator_name}
                    <button
                        type="button"
                        class="creator-link"
                        on:click={goToCreatorPage}
                    >
                        @{content.creator_name}
                    </button>
                {/if}
            </div>
            {#if visibleTags.length > 0}
                <div class="tags-line">
                    {#each visibleTags as tag}
                        <span class="tag-chip">{getTagLabel(tag)}</span>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .tile {
        background: var(--card);
        color: var(--foreground);
        border-radius: var(--radius-card);
        box-shadow: var(--media-card-shadow);
        cursor: pointer;
        transition:
            transform 0.2s ease-in-out,
            box-shadow 0.2s ease-in-out,
            border-color 0.2s ease-in-out;
        border: none;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        position: relative; /* Ensure stacking context */
    }

    .image-container {
        position: relative;
        width: 100%;
        aspect-ratio: 9 / 11; /* Slightly taller for portrait feel */
        overflow: hidden;
    }

    .media-wrapper {
        width: 100%;
        height: 100%;
        transition: transform 0.5s ease;
    }

    @media (hover: hover) and (pointer: fine) {
        .tile:hover {
            transform: translateY(-5px);
            box-shadow: var(--media-card-hover-shadow);
        }

        .tile:hover .media-wrapper {
            transform: scale(1.05); /* Subtle zoom effect */
        }
    }

    @media (hover: none), (pointer: coarse) {
        .tile {
            transition: none;
        }

        .media-wrapper {
            transition: none;
            transform: none !important;
        }
    }

    /* Merged info into overlay */
    .tile-info {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        padding: 2rem 0.8rem 0.8rem 0.8rem; /* Top padding for gradient transition */
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.9) 0%,
            rgba(0, 0, 0, 0.6) 50%,
            transparent 100%
        );
        z-index: 2;
        box-sizing: border-box;
    }

    .title-line {
        font-size: 1.1rem;
        font-weight: 800;
        color: white;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .meta-line {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        min-width: 0;
        margin-top: 0.2rem;
    }

    .creator-link {
        min-width: 0;
        padding: 0;
        border: 0;
        background: none;
        color: rgba(255, 255, 255, 0.82);
        font-size: 0.74rem;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
        transition: color 0.2s ease;
    }

    .creator-link:hover {
        color: white;
    }

    .chat-stat {
        position: absolute;
        top: 0.55rem;
        left: 0.55rem;
        z-index: 3;
        display: inline-flex;
        align-items: center;
        gap: 0.22rem;
        padding: 0.24rem 0.45rem;
        border-radius: 999px;
        background: rgba(10, 10, 12, 0.46);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.9);
        font-size: 0.66rem;
        font-weight: 600;
        line-height: 1;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    }

    .chat-stat :global(svg) {
        font-size: 0.78rem;
    }

    .chat-stat strong {
        font-size: 0.76rem;
        font-weight: 800;
        color: white;
    }

    .tags-line {
        display: flex;
        flex-wrap: nowrap;
        gap: 0.24rem;
        margin-top: 0.25rem;
        overflow: hidden;
        white-space: nowrap;
    }

    .tag-chip {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        max-width: 100%;
        padding: 0.28rem 0.58rem;
        border-radius: 999px;
        border: 1px solid var(--media-pill-border);
        background: var(--media-pill-bg);
        color: var(--media-pill-text);
        font-size: 0.7rem;
        font-weight: 600;
        line-height: 1;
        text-shadow: var(--media-pill-text-shadow);
        white-space: nowrap;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    }

    .type-badge {
        position: absolute;
        top: 0.55rem;
        right: 0.55rem;
        display: inline-flex;
        align-items: center;
        gap: 0.24rem;
        padding: 0.24rem 0.5rem;
        border-radius: 999px;
        font-size: 0.68rem;
        font-weight: 700;
        line-height: 1;
        color: white;
        z-index: 3;
        border: 1px solid rgba(255, 255, 255, 0.18);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    }

    .type-badge.is-vrm {
        background: linear-gradient(
            135deg,
            rgba(99, 102, 241, 0.92),
            rgba(139, 92, 246, 0.88)
        );
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.22);
    }

    .type-badge.is-live2d {
        background: linear-gradient(
            135deg,
            rgba(236, 72, 153, 0.92),
            rgba(244, 63, 94, 0.88)
        );
        box-shadow: 0 6px 16px rgba(236, 72, 153, 0.22);
    }

    .type-badge :global(svg) {
        font-size: 0.86rem;
    }

    @media (max-width: 600px) {
        .tile-info {
            padding: 1.5rem 0.6rem 0.6rem 0.6rem;
        }

        .title-line {
            font-size: 0.95rem;
        }

        .meta-line {
            gap: 0.35rem;
            margin-top: 0.16rem;
        }

        .creator-link {
            font-size: 0.68rem;
        }

        .chat-stat {
            top: 0.4rem;
            left: 0.4rem;
            gap: 0.18rem;
            padding: 0.2rem 0.38rem;
            font-size: 0.58rem;
        }

        .chat-stat strong {
            font-size: 0.64rem;
        }

        .tags-line {
            gap: 0.18rem;
            margin-top: 0.2rem;
        }

        .tag-chip {
            padding: 0.22rem 0.48rem;
            font-size: 0.64rem;
        }

        .type-badge {
            top: 0.4rem;
            right: 0.4rem;
            padding: 0.2rem 0.42rem;
            font-size: 0.62rem;
        }
    }
</style>

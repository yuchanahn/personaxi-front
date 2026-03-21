<script lang="ts">
    import "$lib/styles/custom-markdown.css";
    import "$lib/styles/chat2d-shared-block-defaults.css";
    import { t } from "svelte-i18n";
    import ChatRenderer from "$lib/components/chat/ChatRenderer.svelte";
    import VariableStatusPanel from "$lib/components/chat/VariableStatusPanel.svelte";
    import AssetPreview from "$lib/components/AssetPreview.svelte";
    import { parseChat2DMessages } from "$lib/chat2d/parser";
    import type { Chat2DBlock } from "$lib/chat2d/types";
    import type { Message } from "$lib/stores/messages";
    import type { ImageMetadata, Persona } from "$lib/types";
    import Icon from "@iconify/svelte";

    export let persona: Persona;
    export let userName: string = "User";

    let previewBlocks: Chat2DBlock[] = [];
    let sharedChatStyleCSS = "";

    function normalizeSharedChatStyleCSS(raw: string | undefined) {
        if (!raw) return "";
        return raw
            .replace(/<style\b[^>]*>/gi, "")
            .replace(/<\/style>/gi, "")
            .trim();
    }

    function containsPreviewHtml(content: string): boolean {
        return /<\/?[a-z][^>]*>/i.test(content);
    }

    function buildPreviewAsset(
        metadata?: ImageMetadata,
        fallbackUrl = "",
    ): ImageMetadata | null {
        if (!metadata) {
            return fallbackUrl
                ? {
                      url: fallbackUrl,
                      description: "scene image",
                      type: "image",
                  }
                : null;
        }

        if (metadata.is_secret) {
            if (!metadata.blur_url) {
                return null;
            }

            return {
                ...metadata,
                url: metadata.blur_url,
                type: metadata.type || "image",
            };
        }

        return {
            ...metadata,
            url: metadata.static_url || metadata.url || fallbackUrl,
        };
    }

    $: previewMessages = persona?.first_scene?.trim()
        ? ([{
              role: "assistant",
              content: persona.first_scene,
              done: true,
              key: "profile-first-scene-preview",
          }] satisfies Message[])
        : [];

    $: previewBlocks =
        persona?.first_scene?.trim() && previewMessages.length > 0
            ? parseChat2DMessages(
                  previewMessages,
                  {
                      persona,
                      userName,
                  },
                  {
                      showVariableStatus: true,
                      revealVariableStatus: true,
                      varSourceMessages: previewMessages,
                  },
              )
            : [];
    $: sharedChatStyleCSS = normalizeSharedChatStyleCSS(persona?.chat_style_css);
</script>

<div class="first-scene-chat-preview chat2d-surface chat-window">
    {#if sharedChatStyleCSS}
        <svelte:element this={"style"}>{sharedChatStyleCSS}</svelte:element>
    {/if}
    {#each previewBlocks as block (block.id)}
        {#if block.type === "narration"}
            {#if containsPreviewHtml(block.content)}
                <div class="preview-html-block">
                    {@html block.content}
                </div>
            {:else}
                <ChatRenderer
                    content={block.content}
                    wrapperClass="px-narration"
                />
            {/if}
        {:else if block.type === "dialogue"}
            <div class="message assistant preview-dialogue-wrap">
                <div class="speaker-name">{block.speaker}</div>
                <div class="dialogue-bubble preview-dialogue px-dialogue">
                    <ChatRenderer
                        content={block.content}
                        isMessage={true}
                        wrapperClass="px-dialogue__content"
                    />
                </div>
            </div>
        {:else if block.type === "image"}
            {@const previewAsset = buildPreviewAsset(
                block.metadata,
                block.url,
            )}
            {#if previewAsset}
                <div class="image-block preview-image-block">
                    <figure class="preview-image-card">
                        <AssetPreview
                            asset={previewAsset}
                            showVideoPosterFallback={true}
                            enableVideoPlayback={true}
                            useSimpleVideoLayout={previewAsset.type ===
                                "video"}
                        />
                    </figure>
                </div>
            {:else}
                <div class="preview-locked-image">
                    <Icon icon="ph:lock-key-duotone" width="20" />
                    <span>{$t("chat.secretImage.locked")}</span>
                </div>
            {/if}
        {:else if block.type === "markdown_image"}
            <div class="image-block preview-image-block">
                <figure class="preview-image-card">
                    <img src={block.url} alt={block.alt} loading="lazy" />
                </figure>
            </div>
        {:else if block.type === "vars_status"}
            <div class="vars-status-inline">
                <VariableStatusPanel
                    template={persona?.status_template || ""}
                    css={persona?.status_template_css || ""}
                    variables={block.variables}
                />
            </div>
        {:else if block.type === "code"}
            <pre class="preview-code"><code>{block.content}</code></pre>
        {:else if block.type === "user-interaction"}
            <div class="preview-system-badge">{block.content}</div>
        {/if}
    {/each}
</div>

<style>
    .first-scene-chat-preview {
        display: flex;
        flex-direction: column;
        gap: 0.95rem;
    }

    .preview-html-block {
        color: var(--foreground);
    }

    .preview-html-block :global(img),
    .preview-html-block :global(video),
    .preview-html-block :global(canvas) {
        display: block;
        max-width: 100%;
        height: auto;
        border-radius: 18px;
    }

    .preview-dialogue-wrap {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        align-items: flex-start;
    }

    .preview-dialogue {
        max-width: min(560px, 100%);
    }

    .preview-image-card {
        margin: 0;
        overflow: hidden;
        border-radius: 18px;
        border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
        background: color-mix(in srgb, var(--card) 92%, transparent);
    }

    .preview-image-card :global(.asset-preview-media),
    .preview-image-card :global(.video-container),
    .preview-image-card :global(.fallback) {
        width: 100%;
        height: 100%;
        min-height: 220px;
    }

    .preview-image-card :global(.asset-preview-media),
    .preview-image-card img {
        display: block;
        width: 100%;
        max-height: 520px;
        object-fit: contain;
        background: color-mix(in srgb, var(--background) 94%, var(--card));
    }

    .preview-locked-image {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        align-self: flex-start;
        padding: 0.9rem 1rem;
        border-radius: 16px;
        border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
        background: color-mix(in srgb, var(--card) 92%, transparent);
        color: var(--muted-foreground);
    }

    .preview-code {
        margin: 0;
        padding: 0.95rem 1rem;
        border-radius: 16px;
        background: var(--secondary);
        color: var(--foreground);
        overflow: auto;
        font-size: 0.84rem;
        line-height: 1.6;
    }

    .preview-system-badge {
        display: inline-flex;
        align-items: center;
        align-self: flex-start;
        padding: 0.45rem 0.75rem;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
        background: color-mix(in srgb, var(--card) 92%, transparent);
        color: var(--muted-foreground);
        font-size: 0.82rem;
        font-weight: 700;
    }

    .vars-status-inline {
        position: relative;
        z-index: 1;
    }

    @media (max-width: 720px) {
        .preview-image-card :global(.asset-preview-media),
        .preview-image-card img {
            max-height: 420px;
        }
    }
</style>

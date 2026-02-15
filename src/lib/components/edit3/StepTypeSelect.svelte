<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import type { Persona } from "$lib/types";

    export let persona: Persona;

    interface TypeCard {
        type: string;
        icon: string;
        label: string;
        desc: string;
        badge?: string;
    }

    const contentTypes: { value: string; label: string; icon: string }[] = [
        { value: "character", label: "캐릭터", icon: "ph:robot-duotone" },
        { value: "story", label: "스토리", icon: "ph:book-open-duotone" },
    ];

    $: characterTypes = getCharacterTypes(persona.contentType);

    function getCharacterTypes(contentType?: string): TypeCard[] {
        const types: TypeCard[] = [
            {
                type: "2D",
                icon: "ph:chat-circle-dots-duotone",
                label: "Chat",
                desc: "텍스트와 이미지 기반의 대화형 캐릭터. 가장 간편하게 시작할 수 있어요.",
            },
        ];

        if (contentType !== "story") {
            types.push(
                {
                    type: "2.5D",
                    icon: "ph:monitor-play-duotone",
                    label: "Live2D",
                    desc: "Live2D 모델로 표정과 모션이 살아있는 캐릭터를 만들어보세요.",
                    badge: "beta",
                },
                {
                    type: "3D",
                    icon: "ph:cube-duotone",
                    label: "3D (VRM)",
                    desc: "VRM 3D 모델을 사용하는 입체적인 캐릭터를 만들어보세요.",
                    badge: "beta",
                },
            );
        }

        return types;
    }

    function selectContentType(value: string) {
        persona.contentType = value as "character" | "story" | "";
        if (value === "story") {
            persona.personaType = "2D";
        }
    }

    function selectCharacterType(type: string) {
        persona.personaType = type;
    }
</script>

<div class="step-type">
    <!-- Content Type -->
    <section class="type-section">
        <h3 class="section-title">
            <Icon icon="ph:squares-four-duotone" width="22" />
            무엇을 만들까요?
        </h3>
        <div class="content-type-grid">
            {#each contentTypes as ct}
                <button
                    class="content-card"
                    class:active={persona.contentType === ct.value}
                    on:click={() => selectContentType(ct.value)}
                >
                    <Icon icon={ct.icon} width="28" />
                    <span>{ct.label}</span>
                </button>
            {/each}
        </div>
    </section>

    <!-- Character Type -->
    <section class="type-section">
        <h3 class="section-title">
            <Icon icon="ph:paint-brush-duotone" width="22" />
            캐릭터 타입 선택
        </h3>
        <div class="type-cards-grid">
            {#each characterTypes as card}
                <button
                    class="type-card"
                    class:active={persona.personaType === card.type}
                    on:click={() => selectCharacterType(card.type)}
                >
                    <div class="type-card-icon">
                        <Icon icon={card.icon} width="36" />
                    </div>
                    <div class="type-card-info">
                        <div class="type-card-label">
                            {card.label}
                            {#if card.badge}
                                <span class="badge">{card.badge}</span>
                            {/if}
                        </div>
                        <p class="type-card-desc">{card.desc}</p>
                    </div>
                    {#if persona.personaType === card.type}
                        <div class="check-icon">
                            <Icon icon="ph:check-circle-fill" width="24" />
                        </div>
                    {/if}
                </button>
            {/each}
        </div>
    </section>
</div>

<style>
    .step-type {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .type-section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .section-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--foreground);
        margin: 0;
    }

    /* ── Content Type Cards ── */
    .content-type-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
    }

    .content-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1.25rem 1rem;
        border-radius: 12px;
        border: 2px solid var(--border);
        background: var(--card);
        color: var(--muted-foreground);
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.95rem;
        font-weight: 600;
    }

    .content-card:hover {
        border-color: var(--primary);
        background: hsla(var(--primary-hsl, 0 0% 50%) / 0.05);
        transform: translateY(-2px);
    }

    .content-card.active {
        border-color: var(--primary);
        background: hsla(var(--primary-hsl, 0 0% 50%) / 0.1);
        color: var(--primary);
    }

    /* ── Character Type Cards ── */
    .type-cards-grid {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .type-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem 1.25rem;
        border-radius: 14px;
        border: 2px solid var(--border);
        background: var(--card);
        cursor: pointer;
        transition: all 0.25s ease;
        text-align: left;
        position: relative;
        width: 100%;
    }

    .type-card:hover {
        border-color: var(--primary);
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }

    .type-card.active {
        border-color: var(--primary);
        background: hsla(var(--primary-hsl, 0 0% 50%) / 0.08);
    }

    .type-card-icon {
        width: 56px;
        height: 56px;
        border-radius: 14px;
        background: var(--muted);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--muted-foreground);
        flex-shrink: 0;
        transition: all 0.2s;
    }

    .type-card.active .type-card-icon {
        background: var(--primary);
        color: var(--primary-foreground);
    }

    .type-card-info {
        flex: 1;
        min-width: 0;
    }

    .type-card-label {
        font-size: 1rem;
        font-weight: 700;
        color: var(--foreground);
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .badge {
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 0.15rem 0.5rem;
        border-radius: 6px;
        background: hsla(var(--primary-hsl, 0 0% 50%) / 0.15);
        color: var(--primary);
    }

    .type-card-desc {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        margin: 0.25rem 0 0;
        line-height: 1.4;
    }

    .check-icon {
        color: var(--primary);
        flex-shrink: 0;
    }

    @media (max-width: 400px) {
        .content-type-grid {
            grid-template-columns: 1fr;
        }
    }
</style>

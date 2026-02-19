<script lang="ts">
    import { onMount } from "svelte";
    import Icon from "@iconify/svelte";
    import { t } from "svelte-i18n";
    import { loreApi, type Lore } from "$lib/api/lore";
    import LoreModal from "./LoreModal.svelte";
    import LoreTestModal from "./LoreTestModal.svelte";

    export let personaId: string;
    export let pendingLinks: Set<string> = new Set();

    let myLores: Lore[] = [];
    let linkedLores: Set<string> = new Set();
    let loading = false;
    let showModal = false;
    let showTestModal = false;
    let selectedLoreId: string | null = null;

    $: if (personaId) {
        loadData();
    } else {
        // If no personaId (new character), use pendingLinks for display
        loadMyLoresOnly();
    }
    $: if (pendingLinks && !personaId) {
        linkedLores = new Set(pendingLinks);
    }

    onMount(() => {
        if (!personaId) loadMyLoresOnly();
    });

    async function loadMyLoresOnly() {
        loading = true;
        try {
            myLores = await loreApi.getMyLores();
            if (!personaId) {
                linkedLores = new Set(pendingLinks);
            }
        } catch (e) {
            console.error("Failed to load lorebooks", e);
        } finally {
            loading = false;
        }
    }

    async function loadData() {
        loading = true;
        try {
            const promises: Promise<any>[] = [loreApi.getMyLores()];
            if (personaId) {
                promises.push(loreApi.getPersonaLores(personaId));
            }

            const [lores, linked] = await Promise.all(promises);
            myLores = lores;
            linkedLores = new Set(linked.map((l: Lore) => l.id));
        } catch (e) {
            console.error("Failed to load lorebooks", e);
        } finally {
            loading = false;
        }
    }

    async function toggleLink(lore: Lore) {
        const isLinked = linkedLores.has(lore.id);

        if (!personaId) {
            // Update pending links locally
            if (isLinked) {
                pendingLinks.delete(lore.id);
                linkedLores.delete(lore.id);
            } else {
                pendingLinks.add(lore.id);
                linkedLores.add(lore.id);
            }
            pendingLinks = pendingLinks; // trigger reactivity
            linkedLores = linkedLores;
            return;
        }

        try {
            await loreApi.linkPersona(personaId, lore.id, isLinked);
            if (isLinked) {
                linkedLores.delete(lore.id);
            } else {
                linkedLores.add(lore.id);
            }
            linkedLores = linkedLores; // trigger reactivity
        } catch (e) {
            console.error("Failed to toggle link", e);
            alert("Failed to update link");
        }
    }

    function openEditor(loreId: string | null) {
        selectedLoreId = loreId;
        showModal = true;
    }

    function handleModalClose() {
        showModal = false;
        selectedLoreId = null;
        if (personaId) loadData();
        else loadMyLoresOnly();
    }
</script>

<div class="lore-linker">
    <div class="header">
        <span class="title">
            <Icon icon="ph:book-bookmark-duotone" width="18" />
            {$t("lorebook.title", { default: "Example Lorebooks" })}
        </span>
        <div class="header-actions">
            <button
                class="btn-new secondary"
                on:click={() => (showTestModal = true)}
                title="Test Context"
            >
                <Icon icon="ph:flask-duotone" />
            </button>
            <button class="btn-new" on:click={() => openEditor(null)}>
                <Icon icon="ph:plus-bold" />
                {$t("lorebook.createNew", { default: "Create New" })}
            </button>
        </div>
    </div>

    {#if loading}
        <div class="loading">Loading...</div>
    {:else if myLores.length === 0}
        <div class="empty">
            {$t("lorebook.noLorebooks", {
                default:
                    "No lorebooks found. Create one to add context to your character.",
            })}
        </div>
    {:else}
        <div class="list">
            {#each myLores as lore (lore.id)}
                <div class="lore-item" class:linked={linkedLores.has(lore.id)}>
                    <label class="checkbox-wrapper">
                        <input
                            type="checkbox"
                            checked={linkedLores.has(lore.id)}
                            on:change={() => toggleLink(lore)}
                        />
                        <span class="checkmark"></span>
                    </label>

                    <div class="info">
                        <div class="name">{lore.name}</div>
                        <div class="desc">
                            {lore.description ||
                                $t("lorebook.noDescription", {
                                    default: "No description",
                                })}
                        </div>
                    </div>

                    <div class="actions">
                        <button
                            class="btn-icon"
                            on:click={() => openEditor(lore.id)}
                            title="Edit"
                        >
                            <Icon icon="ph:pencil-simple-duotone" width="18" />
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    {#if showModal}
        <LoreModal loreId={selectedLoreId} on:close={handleModalClose} />
    {/if}

    {#if showTestModal}
        <LoreTestModal
            {personaId}
            activeLoreIds={Array.from(linkedLores)}
            on:close={() => (showTestModal = false)}
        />
    {/if}
</div>

<style>
    .lore-linker {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1rem;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .header-actions {
        display: flex;
        gap: 0.5rem;
    }

    .title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 700;
        font-size: 0.95rem;
        color: var(--foreground);
    }

    .btn-new {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.35rem 0.6rem;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 600;
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        cursor: pointer;
        transition: opacity 0.2s;
    }
    .btn-new.secondary {
        background: var(--secondary);
        color: var(--secondary-foreground);
    }
    .btn-new:hover {
        opacity: 0.9;
    }

    .list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 300px;
        overflow-y: auto;
    }

    .lore-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.6rem;
        border-radius: 8px;
        background: var(--muted);
        border: 1px solid transparent;
        transition: all 0.2s;
    }

    .lore-item.linked {
        background: hsla(var(--primary-hsl) / 0.1);
        border-color: hsla(var(--primary-hsl) / 0.3);
    }

    .info {
        flex: 1;
        min-width: 0;
    }

    .name {
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--foreground);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .desc {
        font-size: 0.75rem;
        color: var(--muted-foreground);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .actions {
        display: flex;
        gap: 0.25rem;
    }

    .btn-icon {
        background: transparent;
        border: none;
        color: var(--muted-foreground);
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .btn-icon:hover {
        background: var(--background);
        color: var(--foreground);
    }

    /* Checkbox Styles */
    .checkbox-wrapper {
        position: relative;
        display: inline-block;
        width: 18px;
        height: 18px;
        cursor: pointer;
    }
    .checkbox-wrapper input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .checkmark {
        position: absolute;
        top: 0;
        left: 0;
        height: 18px;
        width: 18px;
        background-color: var(--background);
        border: 1px solid var(--border);
        border-radius: 4px;
    }
    .checkbox-wrapper:hover input ~ .checkmark {
        border-color: var(--primary);
    }
    .checkbox-wrapper input:checked ~ .checkmark {
        background-color: var(--primary);
        border-color: var(--primary);
    }
    .checkmark:after {
        content: "";
        position: absolute;
        display: none;
    }
    .checkbox-wrapper input:checked ~ .checkmark:after {
        display: block;
    }
    .checkbox-wrapper .checkmark:after {
        left: 6px;
        top: 2px;
        width: 4px;
        height: 9px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
    }

    .empty,
    .loading {
        text-align: center;
        padding: 1rem;
        font-size: 0.85rem;
        color: var(--muted-foreground);
    }
</style>

<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import Icon from "@iconify/svelte";
    import { t } from "svelte-i18n";
    import { loreApi, type Lore, type LoreEntry } from "$lib/api/lore";
    import { toast } from "$lib/stores/toast";

    export let loreId: string | null = null;
    const dispatch = createEventDispatcher();

    let lore: Partial<Lore> = {
        name: "",
        description: "",
        visibility: "private",
    };
    let entries: LoreEntry[] = [];
    let loading = false;
    let selectedEntry: Partial<LoreEntry> | null = null;
    let isNewEntry = false;

    // Computed
    $: isNewLore = !loreId;

    onMount(async () => {
        if (loreId) {
            await loadLore();
        }
    });

    async function loadLore() {
        if (!loreId) return;
        loading = true;
        try {
            const data = await loreApi.getLore(loreId);
            lore = data.lore;
            entries = data.entries.sort(
                (a, b) => b.priority - a.priority || a.order - b.order,
            );
        } catch (e) {
            console.error(e);
            toast.error("Failed to load lorebook");
        } finally {
            loading = false;
        }
    }

    async function saveLoreMeta() {
        try {
            if (isNewLore) {
                await loreApi.createLore(lore);
                toast.success("Lorebook created");
                dispatch("close");
            } else {
                if (!loreId) return;
                await loreApi.updateLore(loreId, lore);
                toast.success("Lorebook updated");
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to save lorebook");
        }
    }

    // Entry Management
    function createEntry() {
        selectedEntry = {
            keywords: [],
            content: "",
            priority: 10,
            recursion: false,
            enabled: true,
            lore_id: loreId!,
        };
        isNewEntry = true;
    }

    function editEntry(entry: LoreEntry) {
        selectedEntry = { ...entry }; // clone
        isNewEntry = false;
    }

    async function saveEntry() {
        if (!selectedEntry || !loreId) return;
        try {
            selectedEntry.lore_id = loreId;
            await loreApi.upsertEntry(selectedEntry);
            toast.success(isNewEntry ? "Entry created" : "Entry updated");
            selectedEntry = null;
            await loadLore(); // reload entries
        } catch (e) {
            console.error(e);
            toast.error("Failed to save entry");
        }
    }

    async function deleteEntry(id: string) {
        if (!confirm("Delete this entry?")) return;
        if (!loreId) return;
        try {
            await loreApi.deleteEntry(id, loreId);
            toast.success("Entry deleted");
            if (selectedEntry?.id === id) selectedEntry = null;
            await loadLore();
        } catch (e) {
            console.error(e);
            toast.error("Failed to delete entry");
        }
    }

    // UI Helpers
    let keywordInput = "";
    function addKeyword() {
        if (!keywordInput.trim()) return;
        if (!selectedEntry) return;
        if (!selectedEntry.keywords) selectedEntry.keywords = [];
        if (!selectedEntry.keywords.includes(keywordInput.trim())) {
            selectedEntry.keywords = [
                ...selectedEntry.keywords,
                keywordInput.trim(),
            ];
        }
        keywordInput = "";
    }
    function removeKeyword(kw: string) {
        if (!selectedEntry || !selectedEntry.keywords) return;
        selectedEntry.keywords = selectedEntry.keywords.filter((k) => k !== kw);
    }
</script>

<div class="editor-layout">
    <!-- Left Sidebar: Meta & List -->
    <div class="sidebar">
        <!-- Meta Section -->
        <div class="meta-section">
            <input
                class="title-input"
                placeholder={$t("lorebook.name")}
                bind:value={lore.name}
                aria-label={$t("lorebook.name")}
            />
            <textarea
                class="desc-input"
                placeholder={$t("lorebook.descLabel")}
                bind:value={lore.description}
                rows="2"
                aria-label={$t("lorebook.descLabel")}
            ></textarea>

            <div class="actions">
                <button class="btn primary" on:click={saveLoreMeta}>
                    {isNewLore
                        ? $t("lorebook.create")
                        : $t("lorebook.saveMeta")}
                </button>
                {#if isNewLore}
                    <p class="hint">Save to start adding entries.</p>
                {/if}
            </div>
        </div>

        {#if !isNewLore}
            <div class="entries-header">
                <h3>{$t("lorebook.entries")} ({entries.length})</h3>
                <button
                    class="btn-sm"
                    on:click={createEntry}
                    aria-label={$t("lorebook.addEntry")}
                >
                    <Icon icon="ph:plus-bold" />
                </button>
            </div>
            <div class="entries-list">
                {#each entries as entry}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div
                        class="entry-item"
                        class:selected={selectedEntry?.id === entry.id}
                        on:click={() => editEntry(entry)}
                    >
                        <div class="entry-main">
                            <div class="keywords">
                                {#each entry.keywords.slice(0, 3) as kw}
                                    <span class="badge">{kw}</span>
                                {/each}
                                {#if entry.keywords.length > 3}
                                    <span class="badge"
                                        >+{entry.keywords.length - 3}</span
                                    >
                                {/if}
                                {#if entry.keywords.length === 0}
                                    <span class="badge empty">No keywords</span>
                                {/if}
                            </div>
                            <div class="preview">
                                {entry.content.slice(0, 50)}{entry.content
                                    .length > 50
                                    ? "..."
                                    : ""}
                            </div>
                        </div>
                        <div class="entry-meta">
                            <span class="prio">P:{entry.priority}</span>
                        </div>
                    </div>
                {/each}
                {#if entries.length === 0}
                    <div class="empty-list">No entries yet.</div>
                {/if}
            </div>
        {/if}
    </div>

    <!-- Right Panel: Entry Editor -->
    <div class="main-panel">
        {#if selectedEntry}
            <div class="entry-editor">
                <h3>
                    {isNewEntry
                        ? $t("lorebook.newEntry")
                        : $t("lorebook.editEntry")}
                </h3>

                <div class="field">
                    <label for="kw-input">{$t("lorebook.keywords")}</label>
                    <div class="keyword-input-row">
                        <input
                            id="kw-input"
                            bind:value={keywordInput}
                            placeholder="Add keyword..."
                            on:keydown={(e) =>
                                e.key === "Enter" && addKeyword()}
                        />
                        <button on:click={addKeyword} aria-label="Add Keyword"
                            ><Icon icon="ph:plus-bold" /></button
                        >
                    </div>
                    <div class="keyword-list">
                        {#each selectedEntry.keywords || [] as kw}
                            <span class="badge removable">
                                {kw}
                                <button
                                    on:click={() => removeKeyword(kw)}
                                    aria-label="Remove Keyword"
                                    ><Icon
                                        icon="ph:x-bold"
                                        width="12"
                                    /></button
                                >
                            </span>
                        {/each}
                    </div>
                </div>

                <div class="field">
                    <label for="content-input">{$t("lorebook.content")}</label>
                    <textarea
                        id="content-input"
                        bind:value={selectedEntry.content}
                        rows="10"
                        placeholder="Write the lore info here..."
                    ></textarea>
                    <div
                        class="char-count"
                        class:warn={(selectedEntry.content?.length || 0) > 500}
                    >
                        {selectedEntry.content?.length || 0} / 500
                    </div>
                </div>

                <div class="row">
                    <div class="field half">
                        <label for="prio-input">{$t("lorebook.priority")}</label
                        >
                        <input
                            id="prio-input"
                            type="number"
                            bind:value={selectedEntry.priority}
                        />
                    </div>
                    <div class="field half checkbox-field">
                        <label class="checkbox-label">
                            <input
                                type="checkbox"
                                bind:checked={selectedEntry.enabled}
                            />
                            {$t("lorebook.enabled")}
                        </label>
                        <label class="checkbox-label">
                            <input
                                type="checkbox"
                                bind:checked={selectedEntry.recursion}
                            />
                            {$t("lorebook.recursion")}
                        </label>
                    </div>
                </div>

                <div class="editor-actions">
                    {#if !isNewEntry && selectedEntry.id}
                        <button
                            class="btn destructive"
                            on:click={() =>
                                deleteEntry(selectedEntry?.id || "")}
                            >{$t("lorebook.deleteEntry")}</button
                        >
                    {/if}
                    <div class="spacer"></div>
                    <button
                        class="btn secondary"
                        on:click={() => (selectedEntry = null)}
                        >{$t("lorebook.cancel")}</button
                    >
                    <button class="btn primary" on:click={saveEntry}
                        >{$t("lorebook.saveEntry")}</button
                    >
                </div>
            </div>
        {:else}
            <div class="placeholder">
                {#if isNewLore}
                    <p>{$t("lorebook.createFirst")}</p>
                {:else}
                    <p>{$t("lorebook.selectEntry")}</p>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .editor-layout {
        display: flex;
        height: 100%;
        background: var(--background);
        color: var(--foreground);
    }

    .sidebar {
        width: 300px;
        border-right: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        background: var(--card);
    }

    .meta-section {
        padding: 1rem;
        border-bottom: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .title-input {
        font-size: 1.1rem;
        font-weight: bold;
        background: transparent;
        border: none;
        border-bottom: 1px solid transparent;
        color: var(--foreground);
        padding: 0.25rem;
    }
    .title-input:focus {
        outline: none;
        border-bottom-color: var(--primary);
    }

    .desc-input {
        font-size: 0.9rem;
        background: transparent;
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--muted-foreground);
        padding: 0.5rem;
        resize: none;
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 0.5rem;
    }

    .entries-header {
        padding: 0.75rem 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--muted);
    }
    .entries-header h3 {
        margin: 0;
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--muted-foreground);
    }

    .entries-list {
        flex: 1;
        overflow-y: auto;
        padding: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .entry-item {
        padding: 0.6rem;
        border-radius: 6px;
        background: var(--background);
        border: 1px solid var(--border);
        cursor: pointer;
        transition: all 0.2s;
    }
    .entry-item:hover {
        border-color: var(--primary);
    }
    .entry-item.selected {
        background: hsla(var(--primary-hsl) / 0.1);
        border-color: var(--primary);
    }

    .entry-main {
        margin-bottom: 0.25rem;
    }

    .keywords {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin-bottom: 0.25rem;
    }

    .badge {
        font-size: 0.7rem;
        padding: 0.1rem 0.3rem;
        background: var(--muted);
        border-radius: 4px;
        color: var(--foreground);
    }
    .badge.removable {
        padding-right: 0.1rem;
        display: inline-flex;
        align-items: center;
        gap: 0.1rem;
    }
    .badge.removable button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0 0.1rem;
        color: var(--muted-foreground);
    }

    .preview {
        font-size: 0.8rem;
        color: var(--muted-foreground);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .main-panel {
        flex: 1;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
    }

    .entry-editor {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .field label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--muted-foreground);
    }

    .keyword-input-row {
        display: flex;
        gap: 0.5rem;
    }
    .keyword-input-row input {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--input);
        color: var(--foreground);
    }
    .keyword-input-row button {
        padding: 0.5rem;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--secondary);
        cursor: pointer;
    }

    textarea {
        padding: 0.75rem;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--input);
        color: var(--foreground);
        font-family: inherit;
        resize: vertical;
    }

    .btn {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        border: 1px solid transparent;
    }
    .btn.primary {
        background: var(--primary);
        color: var(--primary-foreground);
    }
    .btn.secondary {
        background: var(--secondary);
        color: var(--secondary-foreground);
    }
    .btn.destructive {
        background: var(--destructive);
        color: var(--destructive-foreground);
    }
    .btn-sm {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        background: transparent;
        border: 1px solid var(--border);
        cursor: pointer;
    }

    .placeholder {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        color: var(--muted-foreground);
    }

    .editor-actions {
        display: flex;
        gap: 0.5rem;
        border-top: 1px solid var(--border);
        padding-top: 1rem;
        margin-top: 1rem;
    }
    .spacer {
        flex: 1;
    }

    .char-count {
        font-size: 0.75rem;
        text-align: right;
        color: var(--muted-foreground);
    }
    .char-count.warn {
        color: var(--destructive);
    }

    .row {
        display: flex;
        gap: 1rem;
    }
    .half {
        flex: 1;
    }
    .checkbox-field {
        justify-content: flex-end; /* align to bottom of label? */
        flex-direction: row;
        gap: 1rem;
        align-items: center;
        padding-top: 1.5rem; /* approximate align with input */
    }
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.9rem;
        cursor: pointer;
        color: var(--foreground);
        font-weight: normal;
    }
</style>

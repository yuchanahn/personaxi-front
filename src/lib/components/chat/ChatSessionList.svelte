<script lang="ts">
  import ChatSessionItem from "./ChatSessionItem.svelte";
  export let sessions = [] as { id: string; name: string }[];
  export let onSelect = (id: string) => {};
  export let onDelete = (id: string) => {};
</script>

<div class="chat-session-list">
  {#each sessions as session}
    <ChatSessionItem
      {session}
      onClick={() => onSelect(session.id)}
      onDelete={() => onDelete(session.id)}
    />
  {/each}
</div>

<style>
  .chat-session-list {
    display: flex;
    flex-direction: column;
    padding: 16px;

    overflow-y: auto;

    /* 스크롤바 스타일링 */
    scrollbar-width: thin;
    scrollbar-color: var(--color-accent) transparent;
  }

  .chat-session-list::-webkit-scrollbar {
    width: 8px;
  }

  .chat-session-list::-webkit-scrollbar-thumb {
    background-color: var(--color-accent);
    border-radius: 4px;
  }

  .chat-session-list::-webkit-scrollbar-track {
    background-color: transparent;
  }
</style>

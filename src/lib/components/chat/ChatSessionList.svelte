<script lang="ts">
  import ChatSessionItem from './ChatSessionItem.svelte';
  export let sessions = [] as { id: string; name: string }[];
  export let onSelect = (id: string) => {};
  export let onDelete = (id: string) => {};
</script>

<div class="chat-session-list">
  <br />
  <br />
  <br />
  {#each sessions as session}
    <ChatSessionItem
      {session}
      onClick={() => onSelect(session.id)}
      onDelete={() => onDelete(session.id)}
    />
  {/each}
</div>
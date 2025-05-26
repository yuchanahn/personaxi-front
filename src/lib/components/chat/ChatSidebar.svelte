<script lang="ts">
  import ChatSessionList from "./ChatSessionList.svelte";
  import {
    chatSessions,
  } from "$lib/stores/chatSessions";

  import { handleSelect, handleDelete } from "$lib/services/sessionManager";

</script>

<ChatSessionList
  sessions={$chatSessions}
  onSelect={handleSelect}
  onDelete={handleDelete}
/>

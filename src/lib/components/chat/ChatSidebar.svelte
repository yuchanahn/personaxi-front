<script lang="ts">
  import ChatSessionList from "./ChatSessionList.svelte";
  import { sortedChatSessions } from "$lib/stores/chatSessions";

  import { handleSelect } from "$lib/services/sessionManager";

  const handleDelete = () => {};
</script>

<ChatSessionList
  sessions={$sortedChatSessions}
  onSelect={handleSelect}
  onDelete={handleDelete}
/>

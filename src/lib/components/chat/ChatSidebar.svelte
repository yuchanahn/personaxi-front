<script lang="ts">
  import ChatSessionList from "./ChatSessionList.svelte";
  import { chatSessions } from "$lib/stores/chatSessions";

  import { handleSelect } from "$lib/services/sessionManager";

  const handleDelete = () => {};
</script>

<ChatSessionList
  sessions={$chatSessions}
  onSelect={handleSelect}
  onDelete={handleDelete}
/>

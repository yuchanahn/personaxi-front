<script lang="ts">
  import ChatSessionList from './ChatSessionList.svelte';
  import { chatSessions, currentSessionId } from '$lib/stores/chatSessions';
  import { messages } from '$lib/stores/messages';

  function handleSelect(id: string) {
    currentSessionId.set(id);

    if(id === '1')
    {
      messages.set([{ role: 'assistant', content: '질문을 입력하세요.' }]);
    }
  }

  function handleDelete(id: string) {
    console.log('Deleted session:', id);
  }
</script>

<ChatSessionList sessions={$chatSessions} onSelect={handleSelect} onDelete={handleDelete} />
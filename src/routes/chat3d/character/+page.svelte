<script lang="ts">
  import { page } from '$app/stores';
    import ChatLayout from '$lib/components/layout/ChatLayout.svelte';
  import { get } from 'svelte/store';

  let characterId: string;
  let user = null as any;

  $: characterId = get(page).url.searchParams.get('id') || 'default';
</script>


<ChatLayout {user} onSend={()=>{}} />
<h1>캐릭터: {characterId}</h1>
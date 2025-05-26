<script lang="ts">
  import VrmModelViewer from "$lib/components/chat3D/VrmModelViewer.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { loadChatHistory } from "$lib/api/chat";
  import type { Persona } from "$lib/types";
  import { loadPersona } from "$lib/api/edit_persona";

  let lastSessionId: string | null = null;
  let persona: Persona | null = null;
  // 초기 로드
  onMount(() => {
    const sessionId = $page.url.searchParams.get("c");
    lastSessionId = sessionId;
    if (sessionId) {
      persona = null;
      loadChatHistory(sessionId);
      loadPersona(sessionId).then((p) => (persona = p));
    }
  });

  // 쿼리 파라미터 변경 감지
  $: {
    const sessionId = $page.url.searchParams.get("c");
    if (sessionId !== lastSessionId) {
      lastSessionId = sessionId;
      if (sessionId) {
        persona = null;
        loadChatHistory(sessionId);
        loadPersona(sessionId).then((p) => (persona = p));
      }
    }
  }
</script>

<main>
  {#if persona}
    <VrmModelViewer {persona} />
  {/if}
</main>

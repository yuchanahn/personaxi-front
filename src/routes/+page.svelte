<script lang="ts">
  import { onMount } from 'svelte';
  import ChatLayout from '$lib/components/layout/ChatLayout.svelte';
  import { currentSessionId } from '$lib/stores/chatSessions';
  import { sendPromptStream, loadChatHistory } from '$lib/api/chat';
  import { getCurrentUser, loginWithAuthKey } from '$lib/api/auth';
  import { loadChatSessions } from '$lib/api/sessions';
  import { ViewContentHub } from '$lib/stores/flags';

  let user = null as any;

  onMount(async () => {
    const url = new URL(window.location.href);
    const authKey = url.searchParams.get("auth_key");
    if (authKey) {
      await loginWithAuthKey(authKey);
    }

    user = await getCurrentUser();
    await loadChatSessions();
    await loadChatHistory();
  });

  currentSessionId.subscribe((id) => {
    if (id && id !== "1") {
      loadChatHistory();
    }
    if (id === "2") {
      ViewContentHub.set(true);
    } else {
      ViewContentHub.set(false);
    }
  });
</script>

<main>
  <ChatLayout {user} onSend={sendPromptStream} />
</main>

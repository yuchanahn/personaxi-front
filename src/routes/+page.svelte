<script lang="ts">
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import VersionInfo from '$lib/VersionInfo.svelte';
	import ChatStyle from '$lib/ChatStyle.svelte';

	let user: { Name: string, Email: string } | null = null;
	let prompt = '';
	let isLoading = false;
	export let messages = writable<{ role: 'user' | 'ai'; content: string }[]>([]);
	let lastResponse = '';

	onMount(async () => {
		const url = new URL(window.location.href);
		const authKey = url.searchParams.get('auth_key');
		if (authKey) {
			const res = await fetch(`http://localhost:8080/api/auth/login?auth_key=${authKey}`, {
				credentials: 'include'
			});
			if (res.ok) window.location.href = 'https://yuchanahn.github.io/personaxi-front/';
		}
		try {
			const res = await fetch('http://localhost:8080/api/user/me', {
				credentials: 'include'
			});
			if (res.ok) user = await res.json();

			// 히스토리 불러오기
			const histRes = await fetch('http://localhost:8080/api/chat/history', {
				credentials: 'include'
			});
			if (histRes.ok) {
				const history = await histRes.json();
				messages.set(history.map((msg: any) => ({
					role: msg.role || (msg.UserID === user?.Email ? 'user' : 'ai'),
					content: msg.Message
				})));
			}
		} catch {}
	});

	const login = () => {
		window.location.href = 'http://localhost:8080/auth/google/login';
	};

	const sendPrompt = async () => {
		if (!prompt.trim()) return;
		const sending = prompt;
		prompt = '';
		isLoading = true;
		messages.update(m => [...m, { role: 'user', content: sending }]);
		try {
			const res = await fetch('http://localhost:8080/api/ChatLLM', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ prompt: sending })
			});
			const data = await res.json();
			lastResponse = data.response;
			messages.update(m => [...m, { role: 'ai', content: lastResponse }]);
		} catch (e) {
			console.error('❌ 오류:', e);
			lastResponse = '❌ 서버 오류 발생';
			messages.update(m => [...m, { role: 'ai', content: lastResponse }]);
		} finally {
			isLoading = false;
		}
	};
</script>

<main>
	<ChatStyle />
	{#if user}
		<div class="chat-window">
			{#each $messages as msg, i (i)}
				<div class="message {msg.role}">{msg.content}</div>
			{/each}
		</div>
		<textarea bind:value={prompt} rows="3" placeholder="메시지를 입력하세요..." />
		<button on:click={sendPrompt} disabled={isLoading}>
			{isLoading ? '생성 중...' : '보내기'}
		</button>
		<div id="last-response" data-value={lastResponse} style="display:none;" />
	{:else}
		<button on:click={login}>Google 로그인</button>
	{/if}
	<VersionInfo version="v0.2.4" />
</main>
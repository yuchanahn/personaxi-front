<script lang="ts">
	import { onMount } from 'svelte';
	import VersionInfo from '$lib/VersionInfo.svelte';

	let user: { Name: string, Email: string } | null = null;
	let prompt = '';
	let isLoading = false;
	let messages: { role: 'user' | 'ai'; content: string }[] = [];
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
		messages.push({ role: 'user', content: sending });
		try {
			const res = await fetch('http://localhost:8080/api/ChatLLM', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user?.Email ?? 'anonymous', prompt: sending })
			});
			const data = await res.json();
			lastResponse = data.response;
			messages.push({ role: 'ai', content: data.response });
		} catch (e) {
			console.error('❌ 오류:', e);
			lastResponse = '❌ 서버 오류 발생';
			messages.push({ role: 'ai', content: lastResponse });
		} finally {
			isLoading = false;
		}
	};
</script>

<style>
:global(body) {
	margin: 0;
	font-family: 'Segoe UI', sans-serif;
	background-color: #343541;
	color: #ffffff;
}

main {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 2rem;
	max-width: 720px;
	margin: 0 auto;
}

.chat-window {
	width: 100%;
	background: #444654;
	border-radius: 10px;
	padding: 1rem;
	overflow-y: auto;
	min-height: 60vh;
	margin-bottom: 1rem;
}

.message {
	display: flex;
	margin-bottom: 1rem;
	padding: 0.75rem;
	border-radius: 8px;
	white-space: pre-wrap;
}

.user {
	background: #2b8cff;
	align-self: flex-end;
	justify-content: flex-end;
}

.ai {
	background: #3e3f4b;
	align-self: flex-start;
	justify-content: flex-start;
}

textarea {
	width: 100%;
	resize: none;
	border: none;
	border-radius: 8px;
	padding: 1rem;
	font-size: 1rem;
	background: #40414f;
	color: #fff;
	margin-bottom: 0.5rem;
}

button {
	background-color: #19c37d;
	color: white;
	border: none;
	padding: 0.75rem 1.25rem;
	border-radius: 8px;
	cursor: pointer;
	font-weight: bold;
}
</style>

<main>
	{#if user}
		<div class="chat-window">
			{#each messages as msg, i (i)}
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

	<VersionInfo version="v0.2.3" />
</main>
<script lang="ts">
	import { onMount } from 'svelte';
	import VersionInfo from '$lib/VersionInfo.svelte';

	let user: { Name: string, Email: string } | null = null;
	let prompt = '';
	let isLoading = false;
	let messages: { role: 'user' | 'ai'; content: string }[] = [];

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
			console.log('LLM 응답:', data);
			messages.push({ role: 'ai', content: data.response });
		} catch (e) {
			console.error('❌ 오류:', e);
			messages.push({ role: 'ai', content: '❌ 서버 오류 발생' });
		} finally {
			isLoading = false;
		}
	};
</script>

<style>
/* 기존 스타일 생략 */
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
	{:else}
		<button on:click={login}>Google 로그인</button>
	{/if}

	<VersionInfo version="v0.2.3" />
</main>
<script lang="ts">
	import { onMount } from 'svelte';

	let user: { Name: string, Email: string } | null = null;
	let prompt = '';
	let isLoading = false;
	let messages: { role: 'user' | 'ai'; content: string }[] = [];

	onMount(async () => {
		const url = new URL(window.location.href);
		const authKey = url.searchParams.get('auth_key');

		if (authKey) {
			console.log('Auth key found:', authKey);
			const res = await fetch(`http://localhost:8080/api/auth/login?auth_key=${authKey}`, {
				credentials: 'include',
			});
			if (res.ok) {
				console.log('User logged in');
				window.location.href = 'https://yuchanahn.github.io/personaxi-front/';
			} else {
				console.error('Login failed');
			}
		}

		try {
			const res = await fetch('http://localhost:8080/api/user/me', {
				credentials: 'include',
			});
			if (res.ok) {
				user = await res.json();
				console.log('User data:', user);
			}
		} catch (e) {
			console.error('Not logged in');
		}
	});

	const login = async () => {
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
				body: JSON.stringify({
					user_id: user?.Email ?? 'anonymous',
					prompt: sending
				})
			});

			if (res.ok) {
				const data = await res.json();
				messages.push({ role: 'ai', content: data.response });
			} else {
				messages.push({ role: 'ai', content: '❌ 오류 발생: 응답을 받지 못했습니다.' });
			}
		} catch (e) {
			console.error(e);
			messages.push({ role: 'ai', content: '❌ 서버 오류 발생' });
		} finally {
			isLoading = false;
		}
	};
</script>

<style>
.chat-box {
	height: 70vh;
	overflow-y: auto;
	padding: 1rem;
	background-color: #f9f9f9;
	border-radius: 8px;
}
.bubble {
	padding: 0.75rem 1rem;
	margin-bottom: 1rem;
	max-width: 75%;
	border-radius: 16px;
}
.user {
	align-self: flex-end;
	background-color: #d1e7ff;
}
.ai {
	align-self: flex-start;
	background-color: #f0f0f0;
}
</style>

{#if user}
	<p>👋 안녕하세요, {user.Name} 님!</p>
	<div class="flex flex-col chat-box">
		{#each messages as msg (msg.content)}
			<div class="bubble {msg.role}">{msg.content}</div>
		{/each}
	</div>
	<div class="mt-4">
		<textarea
			bind:value={prompt}
			rows="3"
			class="w-full p-2 border rounded mb-2"
			placeholder="캐릭터에게 물어보세요..."
		></textarea>
		<button
			on:click={sendPrompt}
			class="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
			disabled={isLoading}
		>
			{isLoading ? '답변 생성 중...' : '보내기'}
		</button>
	</div>
{:else}
	<button on:click={login} class="bg-blue-500 text-white font-bold py-2 px-4 rounded">로그인</button>
{/if}
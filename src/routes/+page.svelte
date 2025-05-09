<script lang="ts">
	import { onMount } from 'svelte';

	let user: { Name: string, Email: string } | null = null;
	let prompt = '';
	let response = '';
	let isLoading = false;

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
		isLoading = true;
		response = '';

		try {
			const res = await fetch('http://localhost:8080/api/ChatLLM', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ 
					user_id: user?.Email ?? 'anonymous',
					prompt 
				}),
			});

			if (res.ok) {
				const data = await res.json();
				response = data.response;
			} else {
				response = '❌ 오류 발생: 응답을 받지 못했습니다.';
			}
		} catch (e) {
			console.error(e);
			response = '❌ 서버 오류: ' + (e instanceof Error ? e.message : '알 수 없는 오류');
		} finally {
			isLoading = false;
		}
	};
</script>

{#if user}
	<p>👋 안녕하세요, {user.Name} 님!</p>

	<div class="mt-4">
		<h2 class="text-lg font-semibold mb-2">🗨️ 캐릭터와 대화하기</h2>
		<textarea
			bind:value={prompt}
			rows="4"
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

		{#if response}
			<div class="mt-4 bg-gray-100 p-4 rounded whitespace-pre-wrap">
				<strong>💬 응답:</strong>
				<p>{response}</p>
			</div>
		{/if}
	</div>
{:else}
	<button
		on:click={login}
		class="bg-blue-500 text-white font-bold py-2 px-4 rounded"
	>로그인</button>
{/if}

<script lang="ts">
	import { onMount } from 'svelte';

	let user: { Name: string, Email: string } | null = null;

	onMount(async () => {
		const url = new URL(window.location.href);
		const authKey = url.searchParams.get('auth_key');

		if (authKey) {
			console.log('Auth key found:', authKey);
			// 로그인 시도
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
</script>

{#if user}
	<p>👋 안녕하세요, {user.Name} 님!</p>
{:else}
	<button
		on:click={login}
		class="bg-blue-500 text-white font-bold py-2 px-4 rounded"
	>로그인</button>
{/if}

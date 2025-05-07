<script lang="ts">
	import { onMount } from 'svelte';

	let user: { name: string, email: string } | null = null;


	onMount(async () => {
		try {
			const res = await fetch('http://localhost:8080/api/user/me', {
				credentials: 'include',
			});
			if (res.ok) {
				user = await res.json();
			}
		} catch (e) {
			console.error('Not logged in');
		}
	});

	const login = async () => {
  		const res = await fetch('http://localhost:8080/auth/google/login', { credentials: 'include' });
  		const { url } = await res.json();
  		window.location.href = url; // JS 기반 리디렉션
	};

</script>

{#if user}
	<p>👋 안녕하세요, {user.name} 님!</p>
{:else}
	<button
		on:click={login}
		class="bg-blue-500 text-white font-bold py-2 px-4 rounded"
	>로그인</button>
{/if}

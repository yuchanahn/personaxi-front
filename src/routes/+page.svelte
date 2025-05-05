<script lang="ts">
	import { onMount } from 'svelte';

	let user: { name: string, email: string } | null = null;

	onMount(async () => {
		try {
			const res = await fetch('/api/user/me');
			if (res.ok) {
				user = await res.json();
			}
		} catch (e) {
			console.error('Not logged in');
		}
	});
</script>

{#if user}
	<p>👋 안녕하세요, {user.name} 님!</p>
{:else}
	<a href="/login">
		<button>로그인</button>
	</a>
{/if}

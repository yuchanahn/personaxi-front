<script lang="ts">
	import { onMount } from "svelte";

	let user: { name: string; email: string } | null = null;

	onMount(async () => {
		try {
			const res = await fetch("http://localhost:8080/api/user/me", {
				credentials: "include",
			});
			if (res.ok) {
				user = await res.json();
			}
		} catch (e) {
			console.error("Not logged in");
		}
	});

	const login = async () => {
		try {
			const response = await fetch(
				"http://localhost:8080/auth/google/login",
				{
					method: "GET",
					credentials: "include", // 쿠키 포함
				},
			);
			if (response.redirected) {
				window.location.href = response.url; // 리다이렉트 처리
			}
		} catch (error) {
			console.error("Error:", error);
		}
	};
</script>

{#if user}
	<p>👋 안녕하세요, {user.name} 님!</p>
{:else}
	<button
		on:click={login}
		class="bg-blue-500 text-white font-bold py-2 px-4 rounded"
		>로그인</button
	>
{/if}

<script lang="ts">
	// 별도 JS 로직 없이, 버튼 클릭 시 백엔드로 리다이렉트
	function handleGoogleLogin() {
		window.location.href = 'https://localhost:8080/auth/google/login';
	}
</script>

<button on:click={handleGoogleLogin}>
	🟦 Google로 로그인하기
</button>

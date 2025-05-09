<script>
	export let version = 'v0.2.4';
</script>

<footer class="text-sm text-gray-400 mt-8">
	App Version: {version}
</footer>

<svelte:head>
	<meta name="app-version" content={version} />
</svelte:head>
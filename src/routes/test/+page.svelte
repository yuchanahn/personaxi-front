<script lang="ts">
    import Register from "$lib/components/login/Register.svelte";
    import ConsentModal from "$lib/components/modal/ConsentModal.svelte";
    import SajuTest from "$lib/components/saju/SajuTest.svelte";
    import SttComponent from "$lib/components/stt/SttComponent.svelte";
</script>

<!-- <ConsentModal isOpen={true} /> -->

<div class="page-container">
    <h1>Test Page</h1>
</div>
<div style="height: 64px; width: 64px; border: 1px solid black;">
    <!-- <SttComponent /> -->
</div>
<SajuTest />

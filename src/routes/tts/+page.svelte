<script>
    import ConsentModal from "$lib/components/modal/ConsentModal.svelte";
    import WelcomeModal from "$lib/components/modal/WelcomeModal.svelte";
    import { st_user } from "$lib/stores/user";
    import { locale } from "svelte-i18n";

    let welcomeModal = false;
    let consentModal = false;
</script>

<div class="user-info">
    {$st_user?.data.language || "none"}
</div>
<div class="user-info">
    {$locale}
</div>

<button
    on:click={() => {
        consentModal = true;
    }}>consentModal</button
>

<button
    on:click={() => {
        welcomeModal = true;
    }}>welcomeModal</button
>

<ConsentModal isOpen={consentModal} />
<WelcomeModal isOpen={welcomeModal} neuronAmount={200} />

<style>
    .user-info {
        color: red;

        font: 2em sans-serif;
        text-align: center;
    }
</style>

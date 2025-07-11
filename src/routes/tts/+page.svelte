<script>
    import ConsentModal from "$lib/components/modal/ConsentModal.svelte";
    import WelcomeModal from "$lib/components/modal/WelcomeModal.svelte";

    let welcomeModal = false;
    let consentModal = false;
</script>

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

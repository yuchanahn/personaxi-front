<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { settings } from "$lib/stores/settings";
    import { deleteUser } from "$lib/api/user";
    import { goto } from "$app/navigation";
    import { supabase } from "$lib/supabase";
    import { accessToken } from "$lib/stores/auth";
    import { toast } from "$lib/stores/toast";
    import { confirmStore } from "$lib/stores/confirm";

    export let isOpen: boolean = false;
    const dispatch = createEventDispatcher();

    function closeModal() {
        isOpen = false;
        dispatch("close");
    }

    async function handleDeleteAccount() {
        if (
            await confirmStore.ask(
                $t("settingPageModal.deleteAccountConfirm"),
                { type: "danger", confirmText: "Delete" },
            )
        ) {
            const success = await deleteUser();
            if (success) {
                await supabase.auth.signOut();
                accessToken.set(null);
                toast.success($t("settingPageModal.deleteAccountSuccess"));
                window.location.href = "/";
            } else {
                toast.error($t("settingPageModal.deleteAccountFail"));
            }
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (isOpen && event.key === "Escape") {
            closeModal();
        }
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);
    });
    onDestroy(() => {
        window.removeEventListener("keydown", handleKeydown);
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-backdrop" on:click|self={closeModal}>
        <div class="modal-content">
            <button class="close-button" on:click={closeModal}>&times;</button>
            <h2>
                {$t("settingPageModal.title")}
            </h2>
            <p class="description">
                {$t("settingPageModal.description")}
            </p>

            <div class="setting-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label>{$t("settingPageModal.language")}</label>
                <div class="button-group">
                    <button
                        class:active={$settings.language === "ko"}
                        on:click={() => ($settings.language = "ko")}
                    >
                        {$t("settingPageModal.korean")}
                    </button>
                    <button
                        class:active={$settings.language === "en"}
                        on:click={() => ($settings.language = "en")}
                    >
                        {$t("settingPageModal.english")}
                    </button>
                </div>
            </div>

            <div class="setting-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label>{$t("settingPageModal.theme")}</label>
                <div class="button-group">
                    <button
                        class:active={$settings.theme === "light"}
                        on:click={() => ($settings.theme = "light")}
                    >
                        <Icon icon="ph:sun-bold" />
                        {$t("settingPageModal.light")}
                    </button>
                    <button
                        class:active={$settings.theme === "dark"}
                        on:click={() => ($settings.theme = "dark")}
                    >
                        <Icon icon="ph:moon-bold" />
                        {$t("settingPageModal.dark")}
                    </button>
                </div>
            </div>
            <!-- Delete Account Section -->
            <div class="delete-account-section">
                <button class="delete-button" on:click={handleDeleteAccount}>
                    <Icon icon="ph:trash-bold" />
                    {$t("settingPageModal.deleteAccount")}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: hsl(from var(--dark) h s l / 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    }
    .modal-content {
        background-color: var(--popover);
        border-radius: 16px;
        padding: 2rem;
        width: 90%;
        max-width: 450px;
        box-shadow: var(--shadow-popover);
        position: relative;
        color: var(--popover-foreground);
        border: 1px solid var(--border);
    }
    .close-button {
        position: absolute;
        top: 10px;
        right: 15px;
        background: none;
        border: none;
        color: var(--muted-foreground);
        font-size: 2.5rem;
        cursor: pointer;
        line-height: 1;
        transition:
            color 0.2s,
            transform 0.2s;
    }
    .close-button:hover {
        color: var(--foreground);
        transform: rotate(90deg);
    }
    h2 {
        color: var(--foreground);
        font-size: 1.8em;
        margin-top: 0;
        margin-bottom: 0.5rem;
        text-align: center;
    }
    .description {
        font-size: 1rem;
        color: var(--muted-foreground);
        margin-bottom: 2rem;
        text-align: center;
    }
    .setting-group {
        margin-bottom: 1.5rem;
    }
    .setting-group label {
        display: block;
        font-weight: 600;
        font-size: 1rem;
        margin-bottom: 0.75rem;
        color: var(--foreground);
    }
    .button-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
        background-color: var(--muted);
        padding: 0.25rem;
        border-radius: var(--radius-button);
    }
    .button-group button {
        background: none;
        border: none;
        padding: 0.6rem 1rem;
        border-radius: 6px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        color: var(--muted-foreground);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
    }
    .button-group button.active {
        background-color: var(--background);
        color: var(--foreground);
        box-shadow: var(--shadow-mini);
    }

    .delete-account-section {
        margin-top: 3rem;
        display: flex;
        justify-content: center;
    }
    .delete-button {
        background: none;
        border: 1px solid var(--danger);
        color: var(--danger);
        padding: 0.6rem 1.2rem;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.2s ease;
    }
    .delete-button:hover {
        background-color: var(--danger);
        color: hsl(0, 0%, 100%);
    }
</style>

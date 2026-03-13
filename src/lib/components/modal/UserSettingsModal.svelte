<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { settings } from "$lib/stores/settings";
    import { deleteUser, updateBirthDate, updateSafetyFilter } from "$lib/api/user";
    import { goto } from "$app/navigation";
    import { supabase } from "$lib/supabase";
    import { accessToken } from "$lib/stores/auth";
    import { toast } from "$lib/stores/toast";
    import { confirmStore } from "$lib/stores/confirm";
    import { st_user } from "$lib/stores/user";

    export let isOpen: boolean = false;
    const dispatch = createEventDispatcher();
    let isSavingSafety = false;
    let isSavingBirthDate = false;
    let isOverseas = false;
    let isCheckingRegion = true;
    let overseasBirthDate = "";

    function normalizeDateInputValue(raw?: string) {
        const value = raw?.trim();
        if (!value) return "";
        if (/^\d{8}$/.test(value)) {
            return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
        }
        return value;
    }

    function getStoredBirthDate() {
        return normalizeDateInputValue($st_user?.data?.birthDate);
    }

    $: if (isOverseas && !isSavingBirthDate && $st_user?.data?.birthDate) {
        overseasBirthDate = normalizeDateInputValue($st_user.data.birthDate);
    }

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

    onMount(async () => {
        window.addEventListener("keydown", handleKeydown);
        try {
            const res = await fetch("https://ipapi.co/json/");
            const data = await res.json();
            isOverseas = data?.country_code !== "KR";
        } catch (error) {
            console.error("Failed to detect user region for safety toggle", error);
            isOverseas = false;
        } finally {
            isCheckingRegion = false;
        }
    });
    onDestroy(() => {
        window.removeEventListener("keydown", handleKeydown);
    });

    async function handleSafetyFilterChange(nextValue: boolean) {
        if (isSavingSafety || $settings.safetyFilterOn === nextValue) {
            return;
        }

        if (!nextValue && isOverseas) {
            const normalizedBirthDate = overseasBirthDate?.trim() || getStoredBirthDate();
            if (!normalizedBirthDate) {
                toast.error($t("settingPageModal.birthDateRequired"));
                return;
            }

            if (!getStoredBirthDate()) {
                isSavingBirthDate = true;
                try {
                    const birthResult = await updateBirthDate(normalizedBirthDate);
                    st_user.update((current) =>
                        current
                            ? {
                                  ...current,
                                  data: {
                                      ...current.data,
                                      birthDate: birthResult.birthDate,
                                      safetyFilterOn: birthResult.safetyFilterOn,
                                  },
                              }
                            : current,
                    );
                    settings.update((current) => ({
                        ...current,
                        safetyFilterOn: birthResult.safetyFilterOn,
                    }));

                    if (!birthResult.isAdult) {
                        toast.error($t("settingPageModal.adultAgeRequired"));
                        return;
                    }
                } catch (error) {
                    console.error("Failed to save overseas birth date", error);
                    toast.error(
                        error instanceof Error
                            ? error.message
                            : $t("settingPageModal.birthDateSaveFailed"),
                    );
                    return;
                } finally {
                    isSavingBirthDate = false;
                }
            }
        }

        if (!nextValue && !isOverseas && !$st_user?.data?.isVerified) {
            toast.error($t("settingPageModal.safetyVerificationRequired"));
            return;
        }

        isSavingSafety = true;
        try {
            const result = await updateSafetyFilter(nextValue);
            settings.update((current) => ({
                ...current,
                safetyFilterOn: result.safetyFilterOn,
            }));
            st_user.update((current) =>
                current
                    ? {
                          ...current,
                          data: {
                              ...current.data,
                              safetyFilterOn: result.safetyFilterOn,
                              isVerified:
                                  result.isVerified ??
                                  current.data?.isVerified,
                          },
                      }
                    : current,
            );
            toast.success($t("settingPageModal.safetyUpdated"));
        } catch (error) {
            console.error("Failed to update safety filter", error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : $t("settingPageModal.safetyUpdateFailed"),
            );
        } finally {
            isSavingSafety = false;
        }
    }
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
                <div class="button-group lang-group">
                    <button
                        class:active={$settings.language === "ko"}
                        on:click={() => ($settings.language = "ko")}
                    >
                        한국어
                    </button>
                    <button
                        class:active={$settings.language === "en"}
                        on:click={() => ($settings.language = "en")}
                    >
                        English
                    </button>
                    <button
                        class:active={$settings.language === "ja"}
                        on:click={() => ($settings.language = "ja")}
                    >
                        日本語
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

            <div class="setting-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label>
                    <Icon icon="ph:warning-circle-bold" />
                    {$t("tags.safetyFilter")}
                    {#if !isCheckingRegion && !isOverseas && !$st_user?.data?.isVerified}
                        <span class="status-badge disabled">
                            {$t("settingPageModal.verificationRequiredBadge")}
                        </span>
                    {/if}
                </label>
                <div class="filter-description">
                    {$t("settingPageModal.safetyDescription")}
                </div>
                {#if !isCheckingRegion && isOverseas}
                    <div class="birthdate-box">
                        <label for="overseas-birthdate">
                            {$t("settingPageModal.birthDateLabel")}
                        </label>
                        <div class="birthdate-description">
                            {$t("settingPageModal.birthDateDescription")}
                        </div>
                        <input
                            id="overseas-birthdate"
                            type="date"
                            bind:value={overseasBirthDate}
                            max={new Date().toISOString().slice(0, 10)}
                        />
                    </div>
                {/if}
                <div class="button-group">
                    <button
                        class:active={$settings.safetyFilterOn}
                        on:click={() => handleSafetyFilterChange(true)}
                        disabled={isSavingSafety || isSavingBirthDate}
                    >
                        <Icon icon="ph:shield-check-bold" />
                        Safe
                    </button>
                    <button
                        class:active={!$settings.safetyFilterOn}
                        class:danger-active={!$settings.safetyFilterOn}
                        on:click={() => handleSafetyFilterChange(false)}
                        disabled={isSavingSafety || isSavingBirthDate || (isCheckingRegion || (!isOverseas && !$st_user?.data?.isVerified))}
                    >
                        <Icon icon="ph:warning-bold" />
                        Allow
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
    .button-group.lang-group {
        grid-template-columns: 1fr 1fr 1fr;
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
    .button-group button.danger-active {
        color: var(--danger);
    }
    .button-group button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .filter-description {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        margin-bottom: 0.75rem;
        line-height: 1.4;
    }
    .birthdate-box {
        margin-bottom: 0.75rem;
        padding: 0.9rem;
        border: 1px solid var(--border);
        border-radius: 12px;
        background-color: var(--background);
    }
    .birthdate-box label {
        margin-bottom: 0.35rem;
        font-size: 0.95rem;
    }
    .birthdate-description {
        font-size: 0.82rem;
        color: var(--muted-foreground);
        margin-bottom: 0.65rem;
        line-height: 1.4;
    }
    .birthdate-box input {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 10px;
        background-color: var(--popover);
        color: var(--foreground);
        padding: 0.7rem 0.85rem;
    }
    .status-badge {
        font-size: 0.75rem;
        padding: 0.2rem 0.5rem;
        border-radius: 12px;
        margin-left: 0.5rem;
        vertical-align: middle;
        font-weight: 500;
    }
    .status-badge.checking {
        background-color: var(--muted);
        color: var(--muted-foreground);
    }
    .status-badge.disabled {
        background-color: hsl(from var(--danger) h s l / 0.1);
        color: var(--danger);
        border: 1px solid hsl(from var(--danger) h s l / 0.2);
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

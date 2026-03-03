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

    let isOverseas = false;
    let isCheckingIp = true;

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
            if (res.ok) {
                const data = await res.json();
                if (data.country_code !== "KR") {
                    isOverseas = true;
                }
            }
        } catch (e) {
            console.error("Failed to check IP", e);
        } finally {
            isCheckingIp = false;
        }
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
                    {$t("tags.r18")}
                    {#if isCheckingIp}
                        <span class="status-badge checking">IP Checking...</span
                        >
                    {:else if !isOverseas}
                        <span class="status-badge disabled">KR Restricted</span>
                    {/if}
                </label>
                <div class="filter-description">
                    {#if isCheckingIp}
                        접속 지역을 확인하는 중입니다... / Checking region...
                    {:else if !isOverseas}
                        청소년 보호를 위한 19세 확인 인증 절차 연동 준비 중으로,
                        임시 비활성화 취치되었습니다. (Disabled in KR region
                        temporarily)
                    {:else}
                        청소년 보호를 위해 혹시 모를 AI의 민감한 발화나 이미지
                        수위를 제한하는 기능입니다. (Youth protection filter for
                        sensitive contents)
                    {/if}
                </div>
                <div class="button-group">
                    <button
                        class:active={!$settings.safetyFilterEnabled}
                        on:click={() => {
                            if (isOverseas)
                                $settings.safetyFilterEnabled = false;
                        }}
                        disabled={!isOverseas || isCheckingIp}
                    >
                        <Icon icon="ph:shield-check-bold" />
                        Safe
                    </button>
                    <button
                        class:active={$settings.safetyFilterEnabled}
                        class:danger-active={$settings.safetyFilterEnabled}
                        on:click={() => {
                            if (isOverseas)
                                $settings.safetyFilterEnabled = true;
                        }}
                        disabled={!isOverseas || isCheckingIp}
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

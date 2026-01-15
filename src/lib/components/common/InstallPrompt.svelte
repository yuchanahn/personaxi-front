<script lang="ts">
    import { onMount } from "svelte";
    import Icon from "@iconify/svelte";
    import { fade, slide } from "svelte/transition";
    import { t } from "svelte-i18n";
    import { goto } from "$app/navigation";

    let showPrompt = false;
    let isMobile = false;
    let isStandalone = false;

    onMount(() => {
        // 1. Check if Mobile
        const ua = navigator.userAgent.toLowerCase();
        isMobile = /iphone|ipad|ipod|android/.test(ua);

        // 2. Check if Standalone (Already Installed)
        isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone === true;

        // 3. Check LocalStorage (Dismissed Timestamp?)
        const dismissedStr = localStorage.getItem(
            "install_prompt_dismissed_at",
        );
        let shouldShow = true;

        if (dismissedStr) {
            const dismissedAt = parseInt(dismissedStr, 10);
            const now = Date.now();
            const thirtyMinutes = 30 * 60 * 1000;

            // If 30 mins haven't passed yet, don't show
            if (now - dismissedAt < thirtyMinutes) {
                shouldShow = false;
            }
        }

        // Show only if Mobile, Not Installed, and (Not Dismissed OR Cooldown expired)
        if (isMobile && !isStandalone && shouldShow) {
            // Delay slightly for better UX
            setTimeout(() => {
                showPrompt = true;
            }, 2000);
        }
    });

    function dismiss() {
        showPrompt = false;
        // Save current timestamp
        localStorage.setItem(
            "install_prompt_dismissed_at",
            Date.now().toString(),
        );
    }

    function navigateToInstall() {
        goto("/install");
        // Optionally dismiss when they actually go to install?
        // Maybe better not to, in case they come back without installing.
    }
</script>

{#if showPrompt}
    <div class="install-prompt" transition:slide={{ axis: "y" }}>
        <div class="prompt-content" on:click={navigateToInstall}>
            <div class="icon-box">
                <Icon icon="material-symbols:download-rounded" width="24" />
            </div>
            <div class="text-group">
                <span class="title"
                    >{$t("install.promptTitle") || "앱으로 더 편하게!"}</span
                >
                <span class="desc"
                    >{$t("install.promptDesc") ||
                        "광고 없이 전체화면으로 즐기세요."}</span
                >
            </div>
        </div>
        <button class="close-btn" on:click|stopPropagation={dismiss}>
            <Icon icon="mdi:close" width="20" />
        </button>
    </div>
{/if}

<style>
    .install-prompt {
        position: fixed;
        bottom: 80px; /* Above Bottom Nav */
        left: 1rem;
        right: 1rem;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 0.75rem 1rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        cursor: pointer;
    }

    .prompt-content {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex: 1;
    }

    .icon-box {
        width: 40px;
        height: 40px;
        background: var(--primary);
        color: white;
        border-radius: 10px;
        display: grid;
        place-items: center;
    }

    .text-group {
        display: flex;
        flex-direction: column;
    }

    .title {
        font-weight: 700;
        font-size: 0.95rem;
        color: var(--foreground);
    }

    .desc {
        font-size: 0.8rem;
        color: var(--muted-foreground);
    }

    .close-btn {
        background: none;
        border: none;
        color: var(--muted-foreground);
        padding: 0.5rem;
        cursor: pointer;
        display: grid;
        place-items: center;
    }
</style>

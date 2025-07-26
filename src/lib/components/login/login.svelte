<script lang="ts">
    import { API_BASE_URL } from "$lib/constants";
    import { t } from "svelte-i18n";

    type LoginOption = {
        name: string;
        icon: string;
        handler: () => void;
    };

    const loginOptions: LoginOption[] = [
        {
            name: "Google",
            icon: "/icons/google.svg",
            handler: () => {
                window.location.href = `${API_BASE_URL}/auth/google/login`;
            },
        },
        {
            name: "GitHub",
            icon: "/icons/github.svg",
            handler: () => {
                alert($t("login.githubSoon"));
            },
        },
        {
            name: "Email",
            icon: "/icons/email.svg",
            handler: () => {
                alert($t("login.emailSoon"));
            },
        },
    ];
</script>

<div class="login-page-wrapper">
    <div class="login-container">
        <div class="login-header">
            <img
                src="/logo.png"
                alt={$t("login.serviceLogoAlt")}
                class="logo"
            />
            <h1 class="title">{$t("login.welcomeBack")}</h1>
            <p class="subtitle">{$t("login.slogan")}</p>
        </div>
        <div class="button-group">
            {#each loginOptions as option}
                <button class="login-button" on:click={option.handler}>
                    <img
                        class="login-icon"
                        src={option.icon}
                        alt="{option.name} icon"
                    />
                    <span
                        >{$t("login.loginWith", {
                            values: { provider: option.name },
                        })}</span
                    >
                </button>
            {/each}
        </div>

        <div class="legal-links">
            <a href="/terms">{$t("login.terms")}</a>
            <span>·</span>
            <a href="/privacy">{$t("login.privacy")}</a>
        </div>
    </div>
</div>

<style>
    .login-page-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background-color: var(--color-bg-page);
        transition: background-color 0.3s ease;
    }

    .login-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        max-width: 380px;
        width: 100%;
        margin: 2rem;
        padding: 2.5rem;
        background-color: var(--color-bg-container);
        border: 1px solid var(--color-border);
        border-radius: 16px;
        box-shadow: 0 4px 12px var(--shadow-color);
        transition:
            background-color 0.3s ease,
            border-color 0.3s ease;
    }

    .login-header {
        text-align: center;
        margin-bottom: 1rem;
    }
    .logo {
        width: 60px;
        height: 60px;
        margin-bottom: 1rem;
    }
    .title {
        font-size: 1.8rem;
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0;
    }
    .subtitle {
        font-size: 1rem;
        color: var(--color-text-secondary);
        margin-top: 0.5rem;
    }

    .button-group {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .login-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.75rem 1rem;
        font-size: 1rem;
        font-weight: 500;
        color: var(--color-text-primary);
        background-color: var(--color-bg-container);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .login-button:hover {
        background-color: var(--color-button-hover);
    }

    .login-icon {
        width: 20px;
        height: 20px;
    }

    .legal-links {
        text-align: center;
        font-size: 0.8rem;
        color: var(--color-text-secondary);
    }
    .legal-links a {
        color: var(--color-text-secondary);
        text-decoration: none;
    }
    .legal-links a:hover {
        text-decoration: underline;
    }
    .legal-links span {
        margin: 0 0.5rem;
    }
</style>

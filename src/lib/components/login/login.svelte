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
            <img src="/logo.png" alt="서비스 로고" class="logo" />
            <h1 class="title">다시 만나서 반가워요!</h1>
            <p class="subtitle">로그인하고 모든 서비스를 이용해보세요.</p>
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
        background-color: var(--color-bg-page); /* 변수 사용 */
        transition: background-color 0.3s ease; /* 부드러운 전환 효과 */
    }

    .login-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        max-width: 380px;
        width: 100%;
        margin: 2rem;
        padding: 2.5rem;
        background-color: var(--color-bg-container); /* 변수 사용 */
        border: 1px solid var(--color-border); /* 변수 사용 */
        border-radius: 16px;
        box-shadow: 0 4px 12px var(--shadow-color); /* 변수 사용 */
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
        color: var(--color-text-primary); /* 변수 사용 */
        margin: 0;
    }
    .subtitle {
        font-size: 1rem;
        color: var(--color-text-secondary); /* 변수 사용 */
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
        color: var(--color-text-primary); /* 변수 사용 */
        background-color: var(--color-bg-container); /* 변수 사용 */
        border: 1px solid var(--color-border); /* 변수 사용 */
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .login-button:hover {
        background-color: var(--color-button-hover); /* 변수 사용 */
    }

    .login-icon {
        width: 20px;
        height: 20px;
    }

    .legal-links {
        text-align: center;
        font-size: 0.8rem;
        color: var(--color-text-secondary); /* 변수 사용 */
    }
    .legal-links a {
        color: var(--color-text-secondary); /* 변수 사용 */
        text-decoration: none;
    }
    .legal-links a:hover {
        text-decoration: underline;
    }
    .legal-links span {
        margin: 0 0.5rem;
    }
</style>

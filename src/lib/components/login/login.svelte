<script lang="ts">
    import { API_BASE_URL } from "$lib/constants";
    import { t } from "svelte-i18n";
    // 예: 로그인 옵션 정의
    type LoginOption = {
        name: string;
        icon: string; // 아이콘 URL or 클래스명
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

<div class="login-container">
    {#each loginOptions as option}
        <button class="login-button" on:click={option.handler}>
            <img
                class="login-icon"
                src={option.icon}
                alt={option.name + " icon"}
            />
            <span>{$t("login.loginWith", { values: { provider: option.name } })}</span>
        </button>
    {/each}
</div>

<style>
    .login-container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-width: 300px;
        margin: 2rem auto;
        padding: 1rem;
        border: 1px solid #ccc;
        border-radius: 12px;
    }

    .login-button {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .login-button:hover {
        background-color: #e2e2e2;
    }

    .login-icon {
        width: 20px;
        height: 20px;
    }
</style>

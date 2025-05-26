<script lang="ts">
    import { API_BASE_URL } from "$lib/constants";
    // 예: 로그인 옵션 정의
    type LoginOption = {
        name: string;
        icon: string; // 아이콘 URL or 클래스명
        handler: () => void;
    };

    const loginOptions: LoginOption[] = [
        {
            name: "Google",
            icon: "./icons/google.svg",
            handler: () => {
                window.location.href = `${API_BASE_URL}/auth/google/login`;
            },
        },
        {
            name: "GitHub",
            icon: "./icons/github.svg",
            handler: () => {
                window.location.href = "/api/auth/github";
            },
        },
        {
            name: "Email",
            icon: "./icons/email.svg",
            handler: () => {
                alert("이메일 로그인은 아직 준비 중입니다.");
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
            <span>{option.name}로 로그인</span>
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
        background-color: #fafafa;
    }

    .login-button {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        background-color: #f5f5f5;
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

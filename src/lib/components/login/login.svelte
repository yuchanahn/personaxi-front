<script lang="ts">
    import { goto } from "$app/navigation";
    import { t } from "svelte-i18n";
    import { supabase } from "$lib/supabase";
    import Icon from "@iconify/svelte";
    import { toast } from "$lib/stores/toast";

    let mode: "options" | "email" | "register" = "options";

    let email = "";
    let password = "";

    const toOptions = () => (mode = "options");
    const toEmailForm = () => (mode = "email");

    let errorMessage: string = "";

    const loginWithEmail = async () => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // 로그인 성공 시 에러 메시지 초기화 및 이동 (onAuthStateChange가 처리하겠지만 명시적으로 이동)
            errorMessage = "";
            goto("/hub");
        } catch (e) {
            if (e instanceof Error) {
                errorMessage = e.message;
            } else {
                errorMessage = "로그인에 실패했습니다. 다시 시도해 주세요.";
            }
        }
    };

    const onSignup = () => {
        goto("/signup");
    };

    type LoginOption = {
        name: string;
        icon: string;
        handler: () => void;
    };

    const loginOptions: LoginOption[] = [
        {
            name: "Google",
            icon: "/icons/google.svg",
            handler: async () => {
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                        redirectTo: `${window.location.origin}/hub`,
                    },
                });
                if (error) toast.error(error.message);
            },
        },
        {
            name: "Kakao",
            icon: "ri:kakao-talk-fill",
            handler: async () => {
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: "kakao",
                    options: {
                        redirectTo: `${window.location.origin}/hub`,
                    },
                });
                if (error) toast.error(error.message);
            },
        },
        {
            name: "Email",
            icon: "/icons/email.svg",
            handler: toEmailForm,
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

        <!-- Provider 선택 화면 -->
        {#if mode === "options"}
            <div class="button-group">
                {#each loginOptions as option}
                    <button class="login-button" on:click={option.handler}>
                        {#if option.icon.startsWith("/")}
                            <img
                                class="login-icon"
                                src={option.icon}
                                alt={`${option.name} icon`}
                            />
                        {:else}
                            <Icon icon={option.icon} width="24" height="24" />
                        {/if}
                        <span>
                            {$t("login.loginWith", {
                                values: { provider: option.name },
                            })}
                        </span>
                    </button>
                {/each}
            </div>

            <div class="legal-links">
                <a href="/terms">{$t("login.terms")}</a>
                <span>·</span>
                <a href="/privacy">{$t("login.privacy")}</a>
            </div>
        {:else}
            <form class="email-form" on:submit|preventDefault={loginWithEmail}>
                {#if errorMessage}
                    <div class="error-message">{errorMessage}</div>
                {/if}
                <div class="form-group">
                    <label for="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        bind:value={email}
                        required
                        placeholder="you@example.com"
                    />
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        bind:value={password}
                        required
                        placeholder=""
                    />
                </div>
                <button class="submit-button" type="submit"
                    >{$t("login.signIn")}</button
                >
            </form>

            <div class="alt-actions">
                <button class="link-button" on:click={onSignup}
                    >{$t("login.signUp")}</button
                >
                <span>·</span>
                <button class="link-button" on:click={toOptions}
                    >{$t("common.back")}</button
                >
            </div>
        {/if}
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

    /* HEADER */
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

    /* PROVIDER BUTTONS */
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

    .email-form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .form-group label {
        font-size: 0.85rem;
        color: var(--color-text-secondary);
    }
    .form-group input {
        padding: 0.65rem 0.85rem;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background-color: var(--input, #fff);
        font-size: 0.95rem;
        color: var(--foreground-alt);
    }

    .form-group input:-webkit-autofill,
    .form-group input:-webkit-autofill:hover,
    .form-group input:-webkit-autofill:focus,
    .form-group input:-webkit-autofill:active {
        box-shadow: 0 0 0px 1000px var(--input, #fff) inset !important;
        -webkit-box-shadow: 0 0 0px 1000px var(--input, #fff) inset !important;

        -webkit-text-fill-color: var(--foreground-alt) !important;
        color: var(--foreground-alt) !important;

        transition:
            background-color 5000s ease-in-out 0s,
            color 5000s ease-in-out 0s;
    }

    .form-group input::placeholder {
        color: var(--foreground-alt, #93a1b2);
        opacity: 1;
    }

    .form-group input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 2px var(--ring);
    }

    .submit-button {
        margin-top: 0.5rem;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 1rem;
        color: var(--primary-foreground);
        background-color: var(--primary);
        cursor: pointer;
        transition: background-color 0.2s;
        border: none;
    }
    .submit-button:hover {
        background-color: hsl(260 75% 52%);
    }

    .alt-actions {
        margin-top: 1.5rem;
        text-align: center;
        font-size: 0.85rem;
        color: var(--color-text-secondary);
    }
    .link-button {
        background: none;
        border: none;
        color: var(--primary);
        cursor: pointer;
        padding: 0;
        font: inherit;
    }
    .link-button:hover {
        text-decoration: underline;
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

    .error-message {
        color: var(--color-error, #f44336);
        background-color: var(--color-error-bg, #ffebee);
        border: 1px solid var(--color-error, #f44336);
        padding: 0.75rem 1rem;
        border-radius: 8px;
        font-size: 0.9rem;
        text-align: center;
        margin-bottom: 1rem; /* 폼과 분리 */
    }
</style>

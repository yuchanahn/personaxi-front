<script lang="ts">
    import { onMount } from "svelte";
    import { supabase } from "$lib/supabase";
    import { goto } from "$app/navigation";
    import { toast } from "$lib/stores/toast";
    import Icon from "@iconify/svelte";

    let password = "";
    let confirmPassword = "";
    let isLoading = false;
    let errorMessage = "";
    let sessionValid = false;

    onMount(() => {
        // 해시(#)로 전달된 토큰을 Supabase가 자동으로 처리하여 세션을 복구합니다.
        const checkSession = async () => {
            const {
                data: { session },
                error,
            } = await supabase.auth.getSession();

            if (error || !session) {
                errorMessage = "Invalid or expired password reset link.";
                toast.error(errorMessage);
                setTimeout(() => goto("/login"), 3000);
            } else {
                sessionValid = true;
            }
        };

        checkSession();

        // Auth 상태 변경 감지 (세션 복구 확인용)
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY") {
                sessionValid = true;
            }
        });

        return () => subscription.unsubscribe();
    });

    const handleUpdatePassword = async () => {
        if (password !== confirmPassword) {
            errorMessage = "Passwords do not match.";
            return;
        }
        if (password.length < 6) {
            errorMessage = "Password must be at least 6 characters.";
            return;
        }

        isLoading = true;
        errorMessage = "";

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) throw error;

            toast.success("Password updated successfully!");
            goto("/hub");
        } catch (e) {
            if (e instanceof Error) {
                errorMessage = e.message;
            } else {
                errorMessage = "Failed to update password.";
            }
        } finally {
            isLoading = false;
        }
    };
</script>

<div class="page-wrapper">
    <div class="container">
        <h1 class="title">Update Password</h1>

        {#if !sessionValid && errorMessage}
            <div class="error-state">
                <Icon
                    icon="mdi:alert-circle"
                    width="48"
                    height="48"
                    color="var(--color-error)"
                />
                <p>{errorMessage}</p>
                <p class="sub-text">Redirecting to login...</p>
            </div>
        {:else if sessionValid}
            <form on:submit|preventDefault={handleUpdatePassword} class="form">
                {#if errorMessage}
                    <div class="error-message">{errorMessage}</div>
                {/if}

                <div class="form-group">
                    <label for="new-password">New Password</label>
                    <input
                        id="new-password"
                        type="password"
                        bind:value={password}
                        required
                        placeholder="Enter new password"
                        minlength="6"
                    />
                </div>

                <div class="form-group">
                    <label for="confirm-password">Confirm Password</label>
                    <input
                        id="confirm-password"
                        type="password"
                        bind:value={confirmPassword}
                        required
                        placeholder="Confirm new password"
                        minlength="6"
                    />
                </div>

                <button
                    class="submit-button"
                    type="submit"
                    disabled={isLoading}
                >
                    {isLoading ? "Updating..." : "Update Password"}
                </button>
            </form>
        {:else}
            <div class="loading">
                <Icon icon="svg-spinners:ring-resize" width="32" height="32" />
                <p>Verifying link...</p>
            </div>
        {/if}
    </div>
</div>

<style>
    .page-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 1rem;
        background-color: var(--color-bg-page);
    }

    .container {
        width: 100%;
        max-width: 400px;
        padding: 2rem;
        background-color: var(--color-bg-container);
        border: 1px solid var(--color-border);
        border-radius: 16px;
        box-shadow: 0 4px 12px var(--shadow-color);
    }

    .title {
        font-size: 1.5rem;
        font-weight: 700;
        text-align: center;
        margin-bottom: 2rem;
        color: var(--color-text-primary);
    }

    .form {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .form-group label {
        font-size: 0.9rem;
        color: var(--color-text-secondary);
        font-weight: 500;
    }

    .form-group input {
        padding: 0.75rem;
        border-radius: 8px;
        border: 1px solid var(--color-border);
        background-color: var(--input);
        color: var(--foreground);
        font-size: 1rem;
    }

    .submit-button {
        padding: 0.875rem;
        border-radius: 8px;
        border: none;
        background-color: var(--primary);
        color: white;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: opacity 0.2s;
        margin-top: 1rem;
    }

    .submit-button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .error-message {
        color: var(--color-error);
        background-color: var(--color-error-bg);
        padding: 0.75rem;
        border-radius: 8px;
        font-size: 0.9rem;
        text-align: center;
    }

    .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 1rem;
        color: var(--color-text-primary);
    }

    .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        color: var(--color-text-secondary);
        padding: 2rem 0;
    }

    .sub-text {
        font-size: 0.9rem;
        color: var(--color-text-secondary);
    }
</style>

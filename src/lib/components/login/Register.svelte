<script lang="ts">
    import { goto } from "$app/navigation";
    import { fade, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { tick } from "svelte";
    import Icon from "@iconify/svelte";
    import { t } from "svelte-i18n";
    import { API_BASE_URL } from "$lib/constants";

    const OtherIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"></path><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>`;

    // --- 상태 관리 ---
    type Step =
        | "email"
        | "username"
        | "password"
        | "gender"
        | "submitting"
        | "success";
    let currentStep: Step = "email";

    const formData = { email: "", password: "", username: "", gender: "" };
    let currentInputValue = "";
    let passwordConfirm = "";
    let error = "";
    let isLoading = false;

    function focusOnMount(node: HTMLInputElement) {
        node.focus();
    }

    // --- 타이핑 효과 ---
    function typewriter(node: HTMLElement, options?: { speed?: number }) {
        const { speed = 40 } = options || {}; // 옵션이 없으면 기본 속도 40을 사용해!
        const text = node.textContent || "";
        node.textContent = "";

        let i = 0;
        const interval = setInterval(() => {
            if (i < text.length) {
                node.textContent += text[i];
                i++;
            } else {
                clearInterval(interval);
            }
        }, speed);

        return {
            destroy() {
                clearInterval(interval);
            },
        };
    }

    // --- 각 단계의 제목 ---
    const prompts = {
        email: $t("register.prompt.email"),
        username: $t("register.prompt.username"),
        password: $t("register.prompt.password"),
        gender: $t("register.prompt.gender"),
    };

    // --- 다음 단계로 넘어가는 함수 (가장 큰 수정!) ---
    async function handleNext() {
        error = "";
        switch (currentStep) {
            case "email":
                if (!currentInputValue) {
                    error = $t("register.error.emailRequired");
                    return;
                }
                if (!/^\S+@\S+\.\S+$/.test(currentInputValue)) {
                    error = $t("register.error.emailInvalid");
                    return;
                }
                formData.email = currentInputValue;
                currentStep = "username";
                break;
            case "username":
                if (!currentInputValue) {
                    error = $t("register.error.usernameRequired");
                    return;
                }
                formData.username = currentInputValue;
                currentStep = "password";
                break;
            case "password":
                if (currentInputValue.length < 8) {
                    error = $t("register.error.passwordLength");
                    return;
                }
                if (currentInputValue !== passwordConfirm) {
                    error = $t("register.error.passwordMismatch");
                    return;
                }
                formData.password = currentInputValue;
                currentStep = "gender";
                break;
        }
        currentInputValue = "";
        passwordConfirm = "";
        await tick();
        const inputElement = document.querySelector(
            ".step-input",
        ) as HTMLInputElement;
        if (inputElement) inputElement.focus();
    }

    async function selectGender(selectedGender: string) {
        formData.gender = selectedGender;
        currentStep = "submitting";
        await handleSubmit();
    }

    async function handleSubmit() {
        isLoading = true;
        error = "";
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const result = await response.json();
            if (!response.ok) {
                error = result.error || $t("register.error.generic");
                currentStep = "email";
            } else {
                currentStep = "success";
            }
        } catch (e) {
            error = $t("register.error.network");
            currentStep = "email";
        } finally {
            isLoading = false;
        }
    }
</script>

<!-- 전체 레이아웃 구조를 수정해서 PC/모바일 모두 중앙 정렬되도록 했어 -->
<div class="page-wrapper">
    <div class="flow-container">
        <a href="/" class="logo-link">
            <img
                src="/logo.png"
                alt={$t("login.serviceLogoAlt")}
                class="logo"
            />
        </a>

        <main class="flow-content">
            {#if currentStep === "success"}
                <div
                    class="content-box"
                    in:fly={{ y: 20, duration: 400, easing: cubicOut }}
                >
                    <h1 class="prompt-title">
                        🎉 {$t("register.success.title")}
                    </h1>
                    <p class="prompt-subtitle">
                        {$t("register.success.message", {
                            values: { email: formData.email },
                        })}
                    </p>
                    <button
                        class="final-button"
                        on:click={() => goto("/login")}
                    >
                        {$t("register.success.backToLogin")}
                    </button>
                </div>
            {:else if currentStep === "submitting"}
                <div class="content-box" in:fade>
                    <div class="spinner"></div>
                    <p class="prompt-subtitle">
                        {$t("register.button.loading")}
                    </p>
                </div>
            {:else}
                <div class="content-box">
                    <!-- 각 단계별 컨텐츠가 여기에 표시돼 -->
                    {#key currentStep}
                        <div
                            in:fly={{ y: 30, duration: 400, easing: cubicOut }}
                            out:fade={{ duration: 150 }}
                        >
                            <h1 class="prompt-title" use:typewriter>
                                {prompts[currentStep]}
                            </h1>

                            {#if currentStep === "password"}
                                <input
                                    class="step-input"
                                    type="password"
                                    bind:value={currentInputValue}
                                    placeholder={$t(
                                        "register.placeholder.password",
                                    )}
                                    use:focusOnMount
                                />
                                <input
                                    class="step-input"
                                    type="password"
                                    bind:value={passwordConfirm}
                                    placeholder={$t(
                                        "register.placeholder.passwordConfirm",
                                    )}
                                    on:keydown={(e) =>
                                        e.key === "Enter" && handleNext()}
                                />
                            {:else if currentStep !== "gender"}
                                <input
                                    class="step-input"
                                    type={currentStep === "email"
                                        ? "email"
                                        : "text"}
                                    bind:value={currentInputValue}
                                    placeholder={$t(
                                        `register.placeholder.${currentStep}`,
                                    )}
                                    use:focusOnMount
                                    on:keydown={(e) =>
                                        e.key === "Enter" && handleNext()}
                                />
                            {/if}

                            {#if currentStep === "gender"}
                                <div class="gender-selection">
                                    <button
                                        class="gender-button"
                                        on:click={() => selectGender("male")}
                                        title={$t("register.gender.male")}
                                    >
                                        <Icon
                                            icon="mdi:gender-male"
                                            width="48"
                                            height="48"
                                        />
                                    </button>
                                    <button
                                        class="gender-button"
                                        on:click={() => selectGender("female")}
                                        title={$t("register.gender.female")}
                                    >
                                        <Icon
                                            icon="mdi:gender-female"
                                            width="48"
                                            height="48"
                                        />
                                    </button>
                                    <button
                                        class="gender-button"
                                        on:click={() => selectGender("other")}
                                        title={$t("register.gender.other")}
                                        >{@html OtherIcon}</button
                                    >
                                </div>
                            {:else}
                                <!-- 엔터 키 대신 누를 수 있는 '다음' 버튼을 추가했어! -->
                                <!-- svelte-ignore a11y_consider_explicit_label -->
                                <button
                                    class="next-button"
                                    on:click={handleNext}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        ><path d="M5 12h14"></path><path
                                            d="m12 5 7 7-7 7"
                                        ></path></svg
                                    >
                                </button>
                            {/if}
                        </div>
                    {/key}
                </div>
            {/if}
        </main>

        <!-- 에러 메시지와 하단 링크 -->
        <footer class="flow-footer">
            {#if error}
                <div class="error-message" in:fade>{error}</div>
            {/if}
            <div class="extra-links">
                <span>{$t("register.alreadyHaveAccount")}</span>
                <a href="/login">{$t("register.goToLogin")}</a>
            </div>
        </footer>
    </div>
</div>

<style>
    .page-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background-color: var(--background);
        padding: 1rem;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    }

    .flow-container {
        width: 100%;
        max-width: 550px;
        height: 70vh;
        max-height: 600px;
        display: flex;
        flex-direction: column;
        position: relative;
    }

    .logo-link {
        position: absolute;
        top: 0;
        left: 0;
    }

    .logo {
        width: 48px;
        height: 48px;
    }

    .flow-content {
        flex-grow: 1;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .content-box {
        width: 100%;
    }

    .prompt-title {
        font-size: clamp(1.75rem, 5vw, 2.5rem);
        font-weight: 600;
        color: var(--color-text-primary);
        margin-bottom: 3rem;
        min-height: 70px;
        line-height: 1.3;
    }

    .prompt-subtitle {
        font-size: 1.1rem;
        color: var(--color-text-secondary);
        margin-bottom: 2rem;
    }

    /* 진짜 투명하고 세련된 입력창 스타일이야! */
    .step-input {
        background: transparent;
        border: none;
        width: 100%;
        font-size: clamp(1.5rem, 4vw, 2rem);
        color: var(--color-text-primary);
        padding: 0.5rem 0;
        margin-bottom: 1.5rem;
        caret-color: var(--color-primary);
        transition: color 0.3s;
    }

    .step-input:focus {
        outline: none;
        border-color: var(--color-primary);

        box-shadow: none;
        --tw-ring-shadow: 0 0 #0000;
        color: var(--color-primary);
    }

    .next-button {
        display: block;
        margin-top: 2rem;
        background: var(--color-primary);
        color: var(--primary);
        border: none;
        border-radius: 50%;
        width: 56px;
        height: 56px;
        cursor: pointer;
        transition: transform 0.2s;
    }
    .next-button:hover {
        transform: scale(1.1);
    }

    .gender-selection {
        display: flex;
        justify-content: center;
        gap: 1.5rem;
        margin-top: 2rem;
    }

    .gender-button {
        background: transparent;
        border: 2px solid var(--color-border);
        border-radius: 50%;
        width: 80px;
        height: 80px;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        color: var(--color-text-secondary);
        transition: all 0.2s ease-in-out;
    }

    .gender-button:hover {
        transform: translateY(-5px);
        border-color: var(--color-primary);
        color: var(--color-primary);
    }

    .final-button {
        padding: 0.8rem 2rem;
        font-size: 1.1rem;
        font-weight: 600;
        color: #fff;
        background-color: var(--color-primary);
        border: none;
        border-radius: 8px;
        cursor: pointer;
    }

    .spinner {
        border: 4px solid var(--color-border);
        border-top: 4px solid var(--color-primary);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    .flow-footer {
        padding-top: 1rem;
        min-height: 80px; /* 에러 메시지 유무에 따른 레이아웃 흔들림 방지 */
        text-align: center;
    }

    .error-message {
        color: #ef4444;
        margin-bottom: 1rem;
    }

    .extra-links {
        font-size: 0.9rem;
        color: var(--color-text-secondary);
    }
    .extra-links a {
        color: var(--color-primary);
        text-decoration: none;
        font-weight: 500;
    }
</style>

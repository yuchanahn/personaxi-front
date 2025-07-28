<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { api } from "$lib/api";
    import Icon from "@iconify/svelte";

    type Status = "verifying" | "success" | "error";

    let status: Status = "verifying";
    let errorMessage = "유효하지 않은 접근입니다.";

    onMount(async () => {
        const token = $page.url.searchParams.get("token");

        if (!token) {
            status = "error";
            return;
        }

        try {
            const response = await api.get2(`/api/auth/email?t=${token}`);

            if (response.ok) {
                status = "success";
                setTimeout(() => {
                    goto("/login?verified=true");
                }, 3000);
            } else {
                const errorData = await response.json();
                errorMessage =
                    errorData.error || "알 수 없는 오류가 발생했습니다.";
                status = "error";
            }
        } catch (err) {
            errorMessage = "인증 서버에 연결할 수 없습니다.";
            status = "error";
        }
    });
</script>

<div class="container">
    {#if status === "verifying"}
        <div class="card">
            <Icon icon="line-md:loading-twotone-loop" class="icon verifying" />
            <h1>계정을 활성화하는 중입니다...</h1>
            <p>잠시만 기다려주세요.</p>
        </div>
    {/if}

    {#if status === "success"}
        <div class="card">
            <Icon icon="line-md:confirm-circle" class="icon success" />
            <h1>인증이 완료되었습니다!</h1>
            <p>잠시 후 로그인 페이지로 이동합니다.</p>
        </div>
    {/if}

    {#if status === "error"}
        <div class="card">
            <Icon icon="line-md:close-circle" class="icon error" />
            <h1>인증 실패</h1>
            <p>{errorMessage}</p>
            <a href="/login" class="button">로그인 페이지로 돌아가기</a>
        </div>
    {/if}
</div>

<style>
    .container {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background-color: var(--background);
        text-align: center;
    }
    .card {
        padding: 3rem 4rem;
        border-radius: var(--radius-card);
        background-color: var(--card);
        border: 1px solid var(--border-card);
        box-shadow: var(--shadow-card);
    }
    .icon {
        font-size: 4rem;
        margin-bottom: 1.5rem;
    }
    .icon.verifying {
        color: var(--primary);
    }
    .icon.success {
        color: #22c55e; /* 초록색 */
    }
    .icon.error {
        color: var(--destructive);
    }
    h1 {
        font-size: 1.75rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
        color: var(--foreground);
    }
    p {
        color: var(--muted-foreground);
        margin-bottom: 2rem;
    }
    .button {
        display: inline-block;
        padding: 0.75rem 1.5rem;
        background-color: var(--primary);
        color: var(--primary-foreground);
        border-radius: var(--radius-button);
        text-decoration: none;
        font-weight: 600;
    }
</style>

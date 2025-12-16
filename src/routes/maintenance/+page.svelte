<script lang="ts">
    import { onMount } from "svelte";
    import Icon from "@iconify/svelte";
    import { api } from "$lib/api";

    let isChecking = false;

    // "서버 부활" 체크 로직
    // /health 엔드포인트가 200 OK를 반환하면 메인으로 복귀
    async function checkServerHealth() {
        if (isChecking) return;
        isChecking = true;
        try {
            // api.get2는 fetch wrapper (credentials include)
            // health check는 보통 인증 불필요할 수 있으나, router.go를 보니 rate limit만 걸려있음.
            // But api.ts logic might redirect on 503 errors?
            // Wait, we are implementing the redirect logic in api.ts NEXT.
            // We need to make sure THIS call doesn't loop redirect.
            // We will use native fetch here to bypass the interceptor we are about to add.
            const res = await fetch("/health");
            if (res.ok) {
                // 부활 성공!
                window.location.href = "/hub";
            }
        } catch (e) {
            // console.log("Still down...");
        } finally {
            isChecking = false;
        }
    }

    onMount(() => {
        // 5초마다 생존 확인
        const interval = setInterval(checkServerHealth, 5000);
        checkServerHealth(); // 즉시 1회 실행

        return () => clearInterval(interval);
    });
</script>

<div class="maintenance-container">
    <div class="content">
        <div class="icon-wrapper">
            <Icon icon="ph:warning-circle-duotone" width="80" height="80" />
        </div>
        <h1>System Maintenance</h1>
        <p class="message">
            현재 서버 점검 중입니다.<br />
            잠시 후 자동으로 정상화됩니다.
        </p>

        <div class="status-indicator">
            <div class="spinner"></div>
            <span>Reconnecting...</span>
        </div>
    </div>
</div>

<style>
    .maintenance-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        width: 100vw;
        background-color: var(--background);
        color: var(--foreground);
        z-index: 9999;
        position: fixed;
        top: 0;
        left: 0;
    }

    .content {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 1.5rem;
        padding: 2rem;
        max-width: 400px;
        animation: fadeIn 0.5s ease-out;
    }

    .icon-wrapper {
        color: var(--primary);
        filter: drop-shadow(0 0 10px rgba(var(--primary-rgb), 0.3));
    }

    h1 {
        font-size: 1.8rem;
        font-weight: 700;
        margin: 0;
        letter-spacing: -0.02em;
    }

    .message {
        font-size: 1rem;
        color: var(--muted-foreground);
        line-height: 1.6;
        margin: 0;
    }

    .status-indicator {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background: var(--muted);
        border-radius: 20px;
        font-size: 0.85rem;
        color: var(--muted-foreground);
    }

    .spinner {
        width: 12px;
        height: 12px;
        border: 2px solid var(--muted-foreground);
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>

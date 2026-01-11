<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { fade, slide } from "svelte/transition";
    import { onMount } from "svelte";

    let activeTab = "ios";
    let isDesktop = false;
    let currentUrl = "";

    // PWA 관련 변수
    let deferredPrompt: any = null;
    let showInstallButton = false;

    $: qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUrl)}`;

    function setTab(tab: string) {
        activeTab = tab;
    }

    // PWA 설치 트리거 함수
    async function triggerInstall() {
        if (!deferredPrompt) return;

        // 브라우저 설치 프롬프트 실행
        deferredPrompt.prompt();

        // 사용자의 응답 대기
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === "accepted") {
            console.log("User accepted the install prompt");
            showInstallButton = false; // 설치 수락시 버튼 숨김
        }

        deferredPrompt = null;
    }

    onMount(() => {
        currentUrl = window.location.href;
        const ua = navigator.userAgent.toLowerCase();

        // 1. OS 감지
        if (/iphone|ipad|ipod/.test(ua)) {
            activeTab = "ios";
        } else if (/android/.test(ua)) {
            activeTab = "android";
        } else {
            isDesktop = true;
        }

        // 2. PWA 설치 이벤트 리스너 (안드로이드/데스크톱 크롬)
        window.addEventListener("beforeinstallprompt", (e) => {
            // 기본 미니 인포바가 바로 뜨지 않게 막음
            e.preventDefault();
            // 이벤트를 저장해둠 (나중에 버튼 클릭시 트리거)
            deferredPrompt = e;
            // 설치 버튼 활성화
            showInstallButton = true;

            // 설치 가능 상태면 탭을 안드로이드(또는 현재 탭)로 유지하며 강조
            if (!isDesktop && activeTab !== "android") {
                // 상황에 따라 탭을 전환하거나 유지
            }
        });

        // 이미 설치된 앱인지 확인 (선택 사항)
        window.addEventListener("appinstalled", () => {
            showInstallButton = false;
            deferredPrompt = null;
            console.log("PWA was installed");
        });
    });
</script>

<div class="install-page">
    <div class="content-wrapper">
        <h1>{$t("install.title")}</h1>

        {#if isDesktop}
            <div class="qr-section" transition:slide>
                <div class="qr-card">
                    <img src={qrCodeUrl} alt="Scan to install" class="qr-img" />
                    <div class="qr-text">
                        <h3>모바일로 바로 연결하기</h3>
                        <p>카메라로 QR을 스캔하여<br />앱을 설치하세요.</p>
                    </div>
                </div>
                <div class="section-divider">
                    <span>OR</span>
                </div>
            </div>
        {/if}

        <div class="notice-box">
            <Icon
                icon="mdi:information-outline"
                width="24"
                class="notice-icon"
            />
            <p>{@html $t("install.notice")}</p>
        </div>

        <p class="description">{$t("install.description")}</p>

        <div class="tabs">
            <button
                class="tab"
                class:active={activeTab === "ios"}
                on:click={() => setTab("ios")}
            >
                <Icon icon="mdi:apple" width="24" />
                {$t("install.ios")}
            </button>
            <button
                class="tab"
                class:active={activeTab === "android"}
                on:click={() => setTab("android")}
            >
                <Icon icon="mdi:android" width="24" />
                {$t("install.android")}
            </button>
        </div>

        <div class="guide-container">
            {#if activeTab === "ios"}
                <div class="guide-step" transition:fade={{ duration: 200 }}>
                    <div class="step-num">1</div>
                    <div class="step-content">
                        <div class="step-icon">
                            <Icon icon="mdi:share-variant" width="32" />
                        </div>
                        <p>{@html $t("install.iosSteps.1")}</p>
                    </div>
                </div>
                <div class="guide-step" transition:fade={{ duration: 200 }}>
                    <div class="step-num">2</div>
                    <div class="step-content">
                        <div class="step-icon">
                            <Icon icon="mdi:plus-box-outline" width="32" />
                        </div>
                        <p>{@html $t("install.iosSteps.2")}</p>
                    </div>
                </div>
                <div class="guide-step" transition:fade={{ duration: 200 }}>
                    <div class="step-num">3</div>
                    <div class="step-content">
                        <div class="step-text-only">Add / 추가</div>
                        <p>{@html $t("install.iosSteps.3")}</p>
                    </div>
                </div>
            {:else}
                {#if showInstallButton}
                    <div class="pwa-install-area" transition:slide>
                        <button class="install-btn" on:click={triggerInstall}>
                            <Icon icon="mdi:download" width="24" />
                            <span>앱 간편 설치하기</span>
                        </button>
                        <div class="text-divider">혹은 수동으로 설치</div>
                    </div>
                {/if}

                <div class="guide-step" transition:fade={{ duration: 200 }}>
                    <div class="step-num">1</div>
                    <div class="step-content">
                        <div class="step-icon">
                            <Icon icon="mdi:dots-vertical" width="32" />
                        </div>
                        <p>{@html $t("install.androidSteps.1")}</p>
                    </div>
                </div>
                <div class="guide-step" transition:fade={{ duration: 200 }}>
                    <div class="step-num">2</div>
                    <div class="step-content">
                        <div class="step-icon">
                            <Icon icon="mdi:download-box-outline" width="32" />
                        </div>
                        <p>{@html $t("install.androidSteps.2")}</p>
                    </div>
                </div>
                <div class="guide-step" transition:fade={{ duration: 200 }}>
                    <div class="step-num">3</div>
                    <div class="step-content">
                        <div class="step-text-only">Install / 설치</div>
                        <p>{@html $t("install.androidSteps.3")}</p>
                    </div>
                </div>
            {/if}
        </div>

        <div class="benefit-box">
            <Icon icon="mdi:rocket-launch" width="20" />
            <span>{$t("install.benefit")}</span>
        </div>
    </div>
</div>

<style>
    /* 기존 스타일 유지 */
    .install-page {
        min-height: 100vh;
        background-color: var(--background);
        color: var(--foreground);
        display: flex;
        justify-content: center;
        padding: 2rem 1rem;
        box-sizing: border-box;
    }

    .content-wrapper {
        max-width: 600px;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2rem;
    }

    h1 {
        font-size: 2rem;
        font-weight: 800;
        margin: 0;
        text-align: center;
        background: var(--primary-gradient);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .description {
        text-align: center;
        color: var(--muted-foreground);
        line-height: 1.6;
        margin: 0;
    }

    /* QR Section */
    .qr-section {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
    }

    .qr-card {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        background: var(--card);
        padding: 1.5rem;
        border-radius: var(--radius-card);
        border: 1px solid var(--border);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }

    .qr-img {
        width: 100px;
        height: 100px;
        border-radius: 8px;
        background: white;
        padding: 4px;
    }

    .qr-text h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--foreground);
    }

    .qr-text p {
        margin: 0;
        font-size: 0.9rem;
        color: var(--muted-foreground);
        line-height: 1.4;
    }

    .section-divider {
        display: flex;
        align-items: center;
        width: 100%;
        color: var(--border);
        font-weight: 600;
        font-size: 0.8rem;
    }
    .section-divider::before,
    .section-divider::after {
        content: "";
        flex: 1;
        height: 1px;
        background: var(--border);
    }
    .section-divider span {
        padding: 0 1rem;
        color: var(--muted-foreground);
    }

    /* Notice Box */
    .notice-box {
        display: flex;
        gap: 0.8rem;
        align-items: center;
        background: var(--secondary);
        border: 1px solid var(--border);
        padding: 1rem 1.25rem;
        border-radius: var(--radius-card);
        font-size: 0.9rem;
        line-height: 1.5;
        color: var(--foreground);
        max-width: 100%;
        text-align: left;
    }

    :global(.notice-icon) {
        color: var(--primary);
        flex-shrink: 0;
    }

    /* Tabs */
    .tabs {
        display: flex;
        gap: 1rem;
        background: var(--secondary);
        padding: 0.5rem;
        border-radius: 999px;
    }

    .tab {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        border-radius: 999px;
        border: none;
        background: none;
        color: var(--muted-foreground);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .tab.active {
        background: var(--card);
        color: var(--foreground);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    /* Guide Container */
    .guide-container {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        background: var(--card);
        padding: 2rem;
        border-radius: var(--radius-card);
        border: 1px solid var(--border-card);
    }

    /* PWA Install Button Area */
    .pwa-install-area {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
        margin-bottom: 1rem;
    }

    .install-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        width: 100%;
        padding: 1rem;
        background: var(--primary);
        color: white; /* 혹은 var(--primary-foreground) */
        border: none;
        border-radius: var(--radius-card);
        font-size: 1rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition:
            transform 0.2s,
            box-shadow 0.2s;
    }

    .install-btn:active {
        transform: scale(0.98);
    }

    .text-divider {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        position: relative;
        width: 100%;
        text-align: center;
    }
    .text-divider::before {
        content: "";
        position: absolute;
        top: 50%;
        left: 0;
        width: 100%;
        height: 1px;
        background: var(--border);
        z-index: 0;
    }
    .text-divider::after {
        /* 텍스트 뒤 배경을 덮어서 선 가리기 */
        content: "혹은 수동으로 설치";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--card);
        padding: 0 1rem;
        z-index: 1;
        color: var(--muted-foreground);
    }

    /* Guide Steps */
    .guide-step {
        display: flex;
        gap: 1.5rem;
        align-items: flex-start;
    }

    .step-num {
        width: 2rem;
        height: 2rem;
        flex-shrink: 0;
        background: var(--secondary);
        color: var(--foreground);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 0.9rem;
    }

    .step-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .step-icon {
        width: fit-content;
        padding: 0.5rem;
        background: var(--background);
        border-radius: 0.5rem;
        border: 1px solid var(--border);
        color: var(--primary);
    }

    .step-text-only {
        font-weight: 700;
        color: var(--primary);
        font-size: 1.1rem;
    }

    .step-content p {
        margin: 0;
        color: var(--foreground);
        line-height: 1.5;
    }

    .benefit-box {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem 1.5rem;
        background: var(--card);
        border: 1px solid var(--primary);
        color: var(--primary);
        border-radius: var(--radius-card);
        font-weight: 600;
        font-size: 0.9rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    @media (max-width: 480px) {
        .guide-container {
            padding: 1.5rem;
        }
        .tab {
            padding: 0.6rem 1rem;
            font-size: 0.9rem;
        }
        .qr-section {
            display: none;
        }
    }
</style>

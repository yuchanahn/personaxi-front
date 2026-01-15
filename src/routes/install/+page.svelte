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

    // 반응형 QR 코드 URL
    $: qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUrl)}`;

    function setTab(tab: string) {
        activeTab = tab;
    }

    async function triggerInstall() {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
            showInstallButton = false;
        }
        deferredPrompt = null;
    }

    onMount(() => {
        currentUrl = window.location.href;
        const ua = navigator.userAgent.toLowerCase();

        // OS 감지 로직
        if (/iphone|ipad|ipod/.test(ua)) {
            activeTab = "ios";
        } else if (/android/.test(ua)) {
            activeTab = "android";
        } else {
            isDesktop = true;
        }

        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            deferredPrompt = e;
            showInstallButton = true;
            // 안드로이드 감지 시 탭 전환 (데스크탑이 아닐 때만)
            if (!isDesktop && activeTab !== "android") {
                // activeTab = "android"; // 원하면 자동 전환
            }
        });

        window.addEventListener("appinstalled", () => {
            showInstallButton = false;
            deferredPrompt = null;
        });
    });
</script>

<div class="install-page">
    <div class="content-wrapper">
        <div class="header-section">
            <h1>{$t("install.title") || "앱 설치하기"}</h1>
            <p class="description">
                {$t("install.description") ||
                    "홈 화면에 추가하여 앱처럼 사용하세요."}
            </p>
        </div>

        {#if isDesktop}
            <div class="qr-section" transition:slide>
                <div class="qr-card">
                    <img src={qrCodeUrl} alt="Scan to install" class="qr-img" />
                    <div class="qr-text">
                        <h3>모바일로 접속하기</h3>
                        <p>카메라로 QR을 스캔하세요.</p>
                    </div>
                </div>
            </div>
        {:else}
            <div class="tabs">
                <button
                    class="tab"
                    class:active={activeTab === "ios"}
                    on:click={() => setTab("ios")}
                >
                    <Icon icon="fa6-brands:apple" width="20" />
                    <span>iOS</span>
                </button>
                <button
                    class="tab"
                    class:active={activeTab === "android"}
                    on:click={() => setTab("android")}
                >
                    <Icon icon="fa6-brands:android" width="20" />
                    <span>Android</span>
                </button>
            </div>

            <div class="guide-container">
                {#if activeTab === "ios"}
                    <div class="guide-ios" transition:fade={{ duration: 200 }}>
                        <div class="step-row">
                            <span class="step-num">1</span>
                            <div class="step-detail">
                                <p>
                                    브라우저 하단(또는 상단)의 <br /><strong
                                        >공유 버튼</strong
                                    >을 누르세요.
                                </p>
                                <div class="mock-icon-box">
                                    <Icon
                                        icon="ion:share-outline"
                                        width="28"
                                        class="ios-blue"
                                    />
                                </div>
                            </div>
                        </div>

                        <div class="arrow-divider">
                            <Icon
                                icon="mdi:chevron-down"
                                width="24"
                                color="var(--muted-foreground)"
                            />
                        </div>

                        <div class="step-row">
                            <span class="step-num">2</span>
                            <div class="step-detail">
                                <p>
                                    메뉴에서 <strong>'홈 화면에 추가'</strong>를
                                    <br />찾아서 선택하세요.
                                </p>
                                <div class="safari-menu-item">
                                    <div class="menu-row">
                                        <span>홈 화면에 추가</span>
                                        <Icon
                                            icon="fluent:add-square-24-regular"
                                            width="24"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="arrow-divider">
                            <Icon
                                icon="mdi:chevron-down"
                                width="24"
                                color="var(--muted-foreground)"
                            />
                        </div>

                        <div class="step-row">
                            <span class="step-num">3</span>
                            <div class="step-detail">
                                <p>
                                    우측 상단의 <strong>'추가'</strong> 버튼을 누르면
                                    설치가 완료됩니다.
                                </p>
                            </div>
                        </div>
                    </div>
                {:else}
                    <div
                        class="guide-android"
                        transition:fade={{ duration: 200 }}
                    >
                        {#if showInstallButton}
                            <div class="install-action" transition:slide>
                                <button
                                    class="install-btn"
                                    on:click={triggerInstall}
                                >
                                    <Icon icon="mdi:google-play" width="24" />
                                    <span>앱 설치하기 (클릭)</span>
                                </button>
                                <p class="sub-text">
                                    위 버튼을 누르면 바로 설치됩니다.
                                </p>
                            </div>
                        {:else}
                            <div class="manual-android">
                                <div class="step-row">
                                    <span class="step-num">1</span>
                                    <div class="step-detail">
                                        <p>
                                            브라우저 메뉴 버튼 <Icon
                                                icon="mdi:dots-vertical"
                                                inline
                                                width="18"
                                            /> 을 누르세요.
                                        </p>
                                    </div>
                                </div>
                                <div class="step-row">
                                    <span class="step-num">2</span>
                                    <div class="step-detail">
                                        <p>
                                            <strong>'앱 설치'</strong> 또는
                                            <strong>'홈 화면에 추가'</strong>를
                                            선택하세요.
                                        </p>
                                        <div class="android-menu-item">
                                            <Icon
                                                icon="mdi:cellphone-arrow-down"
                                                width="24"
                                            />
                                            <span>앱 설치</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}

        <div class="notice-box">
            <Icon
                icon="mdi:information-outline"
                class="notice-icon"
                width="20"
            />
            <span
                >앱 스토어 방문 없이 무료로 설치되며, <br />자동 업데이트를
                지원합니다.</span
            >
        </div>
    </div>
</div>

<style>
    /* 색상 변수 (프로젝트 테마에 맞게 조정 필요) */
    :root {
        --ios-blue: #007aff;
        --bg-safari-item: #f2f2f7; /* 다크모드 대응 필요 */
    }

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
        max-width: 500px;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2rem;
    }

    h1 {
        margin: 0 0 0.5rem 0;
        text-align: center;
        font-size: 1.8rem;
    }
    .description {
        margin: 0;
        text-align: center;
        color: var(--muted-foreground);
    }

    /* Tabs */
    .tabs {
        display: flex;
        background: var(--secondary);
        padding: 4px;
        border-radius: 12px;
        width: 100%;
        max-width: 320px;
    }
    .tab {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px;
        border: none;
        background: none;
        border-radius: 8px;
        font-weight: 600;
        color: var(--muted-foreground);
        cursor: pointer;
        transition: all 0.2s;
    }
    .tab.active {
        background: var(--card);
        color: var(--foreground);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    /* Guide Common */
    .guide-container {
        width: 100%;
        background: var(--card);
        border-radius: 24px;
        padding: 2rem;
        border: 1px solid var(--border);
        box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1);
    }

    .step-row {
        display: flex;
        gap: 1rem;
        align-items: flex-start;
    }
    .step-num {
        background: var(--primary);
        color: white; /* var(--primary-foreground) */
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        font-weight: bold;
        flex-shrink: 0;
        margin-top: 2px;
    }
    .step-detail {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
    }
    .step-detail p {
        margin: 0;
        line-height: 1.5;
        font-size: 0.95rem;
    }
    .step-detail strong {
        color: var(--primary);
    }

    .arrow-divider {
        display: flex;
        justify-content: center;
        padding: 1rem 0;
        opacity: 0.5;
    }

    /* iOS Specific Styles */
    :global(.ios-blue) {
        color: #007aff; /* Safari Default Blue */
    }
    .mock-icon-box {
        display: flex;
        justify-content: center;
        padding: 1rem;
        background: var(--secondary);
        border-radius: 12px;
    }

    /* Safari Menu Simulation */
    .safari-menu-item {
        background: var(--secondary); /* 사파리 메뉴 배경색 느낌 */
        border-radius: 12px;
        padding: 0 1rem;
    }
    .menu-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        font-size: 1rem;
        font-weight: 500;
    }

    /* Android Install Button */
    .install-action {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem 0;
    }
    .install-btn {
        width: 100%;
        padding: 1rem;
        border-radius: 12px;
        border: none;
        background: var(--primary);
        color: white;
        font-weight: bold;
        font-size: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .sub-text {
        font-size: 0.8rem;
        color: var(--muted-foreground);
    }

    /* Android Manual Menu */
    .android-menu-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: var(--secondary);
        padding: 1rem;
        border-radius: 8px;
    }

    /* QR / Notice */
    .qr-card {
        text-align: center;
        background: white;
        padding: 1.5rem;
        border-radius: 16px;
        color: black;
    }
    .notice-box {
        display: flex;
        gap: 10px;
        font-size: 0.85rem;
        color: var(--muted-foreground);
        background: var(--secondary);
        padding: 1rem;
        border-radius: 12px;
        line-height: 1.4;
    }
    :global(.notice-icon) {
        flex-shrink: 0;
        margin-top: 2px;
    }
</style>

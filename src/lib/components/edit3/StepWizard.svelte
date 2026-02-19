<script lang="ts">
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";
    import { createEventDispatcher } from "svelte";
    import { fly } from "svelte/transition";

    export let currentStep: number = 0;
    export let totalSteps: number = 5;
    export let stepLabels: string[] = [];
    export let canProceed: boolean = true;
    export let isSaving: boolean = false;

    const dispatch = createEventDispatcher();

    let direction = 1; // 1 = forward, -1 = backward

    const stepIcons = [
        "ph:cube-duotone",
        "ph:user-circle-duotone",
        "ph:image-duotone",
        "ph:brain-duotone",
        "ph:check-circle-duotone",
    ];

    function goToStep(step: number) {
        if (step < 0 || step >= totalSteps) return;
        if (step > currentStep && !canProceed) {
            dispatch("validationFail");
            return;
        }
        direction = step > currentStep ? 1 : -1;
        dispatch("stepChange", { step, direction });
    }

    function next() {
        goToStep(currentStep + 1);
    }

    function prev() {
        goToStep(currentStep - 1);
    }

    function handleSave() {
        dispatch("save");
    }
</script>

<div class="wizard-wrapper">
    <!-- Progress Bar -->
    <div class="progress-header">
        <div class="steps-indicator">
            {#each Array(totalSteps) as _, i}
                <button
                    class="step-dot"
                    class:active={i === currentStep}
                    class:completed={i < currentStep}
                    class:clickable={i <= currentStep}
                    on:click={() => {
                        if (i <= currentStep) goToStep(i);
                    }}
                    aria-label="Step {i + 1}"
                >
                    {#if i < currentStep}
                        <Icon icon="ph:check-bold" width="14" />
                    {:else}
                        <span class="step-number">{i + 1}</span>
                    {/if}
                </button>
                {#if i < totalSteps - 1}
                    <div class="step-line" class:filled={i < currentStep}></div>
                {/if}
            {/each}
        </div>
        <p class="step-label">
            <Icon icon={stepIcons[currentStep]} width="18" />
            {stepLabels[currentStep] || `Step ${currentStep + 1}`}
        </p>
    </div>

    <!-- Content Area with Desktop Side Arrows -->
    <div class="step-content-wrapper">
        <!-- Desktop Left Arrow -->
        {#if currentStep > 0}
            <button
                class="side-arrow side-arrow-left"
                on:click={prev}
                aria-label="Previous step"
            >
                <Icon icon="ph:caret-left-bold" width="24" />
            </button>
        {:else}
            <div class="side-arrow-placeholder"></div>
        {/if}

        <div class="panels-container">
            <!-- Left Panel (current step) -->
            <div class="step-panel panel-left">
                <div class="panel-header">
                    <span class="panel-step-badge">{currentStep + 1}</span>
                    <span class="panel-step-title"
                        >{stepLabels[currentStep] ||
                            `Step ${currentStep + 1}`}</span
                    >
                </div>
                <div class="panel-body">
                    {#key currentStep}
                        <div
                            class="step-inner"
                            in:fly={{
                                x: direction * 40,
                                duration: 200,
                                delay: 30,
                            }}
                            out:fly={{ x: direction * -40, duration: 120 }}
                        >
                            <slot />
                        </div>
                    {/key}

                    <!-- Save button inside panel on last step (desktop) -->
                    {#if currentStep === totalSteps - 1}
                        <div class="inline-save">
                            <button
                                class="nav-btn save"
                                on:click={handleSave}
                                disabled={isSaving || !canProceed}
                            >
                                {#if isSaving}
                                    <Icon
                                        icon="ph:spinner"
                                        width="18"
                                        class="spin"
                                    />
                                    <span
                                        >{$t("editPage.saveButtonLoading", {
                                            default: "저장 중...",
                                        })}</span
                                    >
                                {:else}
                                    <Icon
                                        icon="ph:floppy-disk-bold"
                                        width="18"
                                    />
                                    <span
                                        >{$t("editPage.saveButton", {
                                            default: "저장",
                                        })}</span
                                    >
                                {/if}
                            </button>
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Right Panel (next step, desktop only) -->
            {#if currentStep < totalSteps - 1}
                <div class="step-panel panel-right">
                    <div class="panel-header">
                        <span class="panel-step-badge">{currentStep + 2}</span>
                        <span class="panel-step-title"
                            >{stepLabels[currentStep + 1] ||
                                `Step ${currentStep + 2}`}</span
                        >
                    </div>
                    <div class="panel-body">
                        {#key currentStep}
                            <div
                                class="step-inner"
                                in:fly={{ x: 40, duration: 200, delay: 80 }}
                                out:fly={{ x: -40, duration: 120 }}
                            >
                                <slot name="next" />
                            </div>
                        {/key}
                    </div>
                </div>
            {/if}
        </div>

        <!-- Desktop Right Arrow -->
        {#if currentStep < totalSteps - 1}
            <button
                class="side-arrow side-arrow-right"
                on:click={next}
                disabled={!canProceed}
                aria-label="Next step"
            >
                <Icon icon="ph:caret-right-bold" width="24" />
            </button>
        {:else}
            <div class="side-arrow-placeholder"></div>
        {/if}
    </div>

    <!-- Bottom Navigation (Mobile only) -->
    <div class="nav-footer">
        {#if currentStep > 0}
            <button class="nav-btn secondary" on:click={prev}>
                <Icon icon="ph:arrow-left-bold" width="18" />
                <span>{$t("common.prev", { default: "이전" })}</span>
            </button>
        {:else}
            <div></div>
        {/if}

        {#if currentStep < totalSteps - 1}
            <button
                class="nav-btn primary"
                on:click={next}
                disabled={!canProceed}
            >
                <span>{$t("common.next", { default: "다음" })}</span>
                <Icon icon="ph:arrow-right-bold" width="18" />
            </button>
        {:else}
            <button
                class="nav-btn save"
                on:click={handleSave}
                disabled={isSaving || !canProceed}
            >
                {#if isSaving}
                    <Icon icon="ph:spinner" width="18" class="spin" />
                    <span
                        >{$t("editPage.saveButtonLoading", {
                            default: "저장 중...",
                        })}</span
                    >
                {:else}
                    <Icon icon="ph:floppy-disk-bold" width="18" />
                    <span>{$t("editPage.saveButton", { default: "저장" })}</span
                    >
                {/if}
            </button>
        {/if}
    </div>
</div>

<style>
    .wizard-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        background: var(--background);
    }

    /* ── Progress Header ── */
    .progress-header {
        flex-shrink: 0;
        padding: 1.25rem 1.5rem 1rem;
        border-bottom: 1px solid var(--border);
        background: var(--card);
    }

    .steps-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0;
        margin-bottom: 0.75rem;
    }

    .step-dot {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 2px solid var(--border);
        background: var(--muted);
        color: var(--muted-foreground);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: default;
        transition: all 0.3s ease;
        padding: 0;
        flex-shrink: 0;
    }

    .step-dot.clickable {
        cursor: pointer;
    }

    .step-dot.active {
        border-color: var(--primary);
        background: var(--primary);
        color: var(--primary-foreground);
        box-shadow: 0 0 0 4px hsla(var(--primary-hsl, 0 0% 50%) / 0.2);
        transform: scale(1.1);
    }

    .step-dot.completed {
        border-color: var(--primary);
        background: var(--primary);
        color: var(--primary-foreground);
    }

    .step-line {
        flex: 1;
        height: 2px;
        background: var(--border);
        max-width: 48px;
        transition: background 0.3s ease;
    }

    .step-line.filled {
        background: var(--primary);
    }

    .step-label {
        text-align: center;
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--foreground);
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
    }

    /* ── Content Wrapper ── */
    .step-content-wrapper {
        flex: 1;
        display: flex;
        align-items: stretch;
        min-height: 0;
        position: relative;
    }

    .panels-container {
        flex: 1;
        display: flex;
        min-height: 0;
        overflow: hidden;
    }

    .step-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .panel-header {
        display: none; /* shown on desktop only */
    }

    .panel-body {
        flex: 1;
        padding: 1.5rem;
    }

    .inline-save {
        display: none; /* shown on desktop only */
    }

    .panel-right {
        display: none; /* Hidden on mobile */
    }

    .side-arrow,
    .side-arrow-placeholder {
        display: none;
    }

    /* ── Bottom Navigation (mobile) ── */
    .nav-footer {
        flex-shrink: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border);
        background: var(--card);
        gap: 1rem;
    }

    .nav-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        border-radius: 12px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        min-height: 48px;
    }

    .nav-btn.secondary {
        background: var(--muted);
        color: var(--foreground);
        border: 1px solid var(--border);
    }
    .nav-btn.secondary:hover {
        background: var(--secondary);
        transform: translateY(-1px);
    }

    .nav-btn.primary {
        background: var(--primary-gradient);
        color: var(--primary-foreground);
        background-size: 200% 200%;
        animation: gradient-animation 3s ease infinite;
    }
    .nav-btn.primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .nav-btn.save {
        background: var(--primary-gradient);
        color: var(--primary-foreground);
        background-size: 200% 200%;
        animation: gradient-animation 3s ease infinite;
        flex: 1;
        justify-content: center;
    }

    .nav-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
    }

    /* ── Desktop Layout (769px+) ── */
    @media (min-width: 769px) {
        .panel-header {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            padding: 0.75rem 1.5rem;
            border-bottom: 1px solid var(--border);
            background: var(--card);
            flex-shrink: 0;
        }

        .panel-step-badge {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--primary);
            color: var(--primary-foreground);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 700;
            flex-shrink: 0;
        }

        .panel-step-title {
            font-size: 0.88rem;
            font-weight: 600;
            color: var(--foreground);
        }

        .panel-right {
            display: flex;
            border-left: 1px solid var(--border);
            pointer-events: none;
            opacity: 0.5;
            user-select: none;
            overflow: hidden;
            mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
            -webkit-mask-image: linear-gradient(
                to bottom,
                black 60%,
                transparent 100%
            );
        }

        .panel-body {
            padding: 1.5rem 2rem;
        }

        .side-arrow,
        .side-arrow-placeholder {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            flex-shrink: 0;
            background: transparent;
            border: none;
            color: var(--muted-foreground);
            cursor: pointer;
            transition: all 0.2s ease;
            z-index: 10;
        }
        .side-arrow-placeholder {
            cursor: default;
        }
        .side-arrow:hover:not(:disabled) {
            color: var(--primary);
            background: hsla(var(--primary-hsl, 0 0% 50%) / 0.08);
        }
        .side-arrow:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }

        .nav-footer {
            display: none;
        }

        .inline-save {
            display: flex;
            justify-content: center;
            padding: 2rem 0 1rem;
        }
        .inline-save .nav-btn.save {
            max-width: 320px;
            flex: none;
            padding: 0.85rem 2.5rem;
            border-radius: 14px;
        }

        .step-line {
            max-width: 80px;
        }
    }

    /* ── Mobile Layout ── */
    @media (max-width: 768px) {
        .panel-body {
            padding: 1rem;
        }
        .progress-header {
            padding: 1rem 1rem 0.75rem;
        }
        .step-panel {
            padding-bottom: calc(140px + env(safe-area-inset-bottom));
        }
        .nav-footer {
            position: fixed;
            bottom: calc(70px + env(safe-area-inset-bottom));
            left: 0;
            right: 0;
            z-index: 10001;
            padding: 0.75rem 1rem;
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
        }
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
    :global(.spin) {
        animation: spin 1s linear infinite;
    }
</style>

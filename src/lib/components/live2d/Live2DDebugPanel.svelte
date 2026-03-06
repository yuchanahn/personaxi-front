<script lang="ts">
    export let debugInfo: any;
    export let autonomy: any = null;
    export let motionDefinitions: Record<string, any[]> | null = null;

    export let resetToDefault: () => void;
    export let playGesture: (gesture: string) => void;
    export let playMotionTemporarilyEnabled: (group: string, index?: number) => any;

    export let onExpressionSelect: (expr: string) => void;
    export let onSetManualParam: () => void;
    export let onSetEmotion: (emotion: string) => void;
</script>

<div class="debug-panel">
    <h3>🎭 Live2D Debug</h3>

    <div class="controls-row">
        <button class="stop-btn reset-btn" on:click={resetToDefault}
            >🔄 Reset Model</button
        >
    </div>

    <div class="info-item">
        <strong>Model:</strong>
        <span class="break-all">{debugInfo.modelUrl.split("/").pop()}</span>
    </div>

    <div class="info-item">
        <strong>Emotion Input:</strong>
        <span class="highlight">{debugInfo.currentEmotion}</span>
    </div>

    <div class="info-item">
        <strong>Expression:</strong>
        <span class="highlight">{debugInfo.currentExpression}</span>
    </div>

    <div class="info-item">
        <strong>Last Motion:</strong>
        <span class="highlight">{debugInfo.lastMotion}</span>
    </div>

    <div class="debug-control-group">
        <div class="slider-row">
            <label for="autonomySensitivity">
                <span>Sensitivity</span>
                <span>{autonomy?.sensitivity.toFixed(1)}x</span>
            </label>
            <input
                id="autonomySensitivity"
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={autonomy?.sensitivity || 1.0}
                on:input={(e) =>
                    autonomy?.setSensitivity(parseFloat(e.currentTarget.value))}
            />
        </div>

        <div class="gesture-grid">
            <button class="gesture-btn" on:click={() => playGesture("NOD")}
                >Nod</button
            >
            <button class="gesture-btn" on:click={() => playGesture("SHAKE")}
                >Shake</button
            >
            <button class="gesture-btn" on:click={() => playGesture("TILT")}
                >Tilt</button
            >
            <button class="gesture-btn" on:click={() => playGesture("FIDGET")}
                >Fidget</button
            >

            <button class="gesture-btn" on:click={() => playGesture("SIGH")}
                >Sigh</button
            >
            <button
                class="gesture-btn"
                on:click={() => playGesture("LOOK_DOWN")}>Look Down</button
            >
            <button
                class="gesture-btn"
                on:click={() => playGesture("CLOSE_EYES")}>Close Eyes</button
            >
            <button class="gesture-btn" on:click={() => playGesture("WINK")}
                >Wink</button
            >

            <button
                class="gesture-btn"
                on:click={() => playGesture("PUFF_CHEEKS")}>Puff</button
            >
            <button
                class="gesture-btn"
                on:click={() => playGesture("STICK_TONGUE")}>Tongue</button
            >
            <button
                class="gesture-btn"
                on:click={() => playGesture("SQUINT")}>Squint</button
            >

            <button
                class="gesture-btn"
                on:click={() => playGesture("ROLL_EYES")}>Roll</button
            >
            <button
                class="gesture-btn"
                on:click={() => playGesture("LOOK_UP_THINK")}>Think</button
            >

            <button class="gesture-btn" on:click={() => playGesture("FLINCH")}
                >Flinch</button
            >
            <button class="gesture-btn" on:click={() => playGesture("PANT")}
                >Pant</button
            >
        </div>
    </div>

    <div class="info-section">
        <strong
            >Expressions ({debugInfo.availableExpressions
                ? debugInfo.availableExpressions.length
                : 0}) :</strong
        >
        <div class="scroll-list">
            {#each debugInfo.availableExpressions as expr}
                <button
                    class="list-item clickable"
                    on:click={() => onExpressionSelect(expr)}
                >
                    {expr}
                </button>
            {/each}
        </div>
    </div>

    <div class="info-section">
        <label
            style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px; color: #fab;"
        >
            <input
                type="checkbox"
                on:change={(e) => {
                    if (autonomy) {
                        if (e.currentTarget.checked) autonomy.start();
                        else autonomy.stop();
                    }
                }}
                checked={true}
            />
            Enable Autonomy (Uncheck to test manually)
        </label>

        <strong>🔧 Manual Parameter Test:</strong>
        <div style="display: flex; gap: 5px; margin-top: 5px;">
            <input
                type="text"
                placeholder="Param ID (e.g. ParamEyeLOpen)"
                style="flex: 2; padding: 4px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff; font-size: 12px;"
                bind:value={debugInfo.manualParamId}
            />
            <input
                type="number"
                placeholder="Val"
                step="0.1"
                style="flex: 1; padding: 4px; border-radius: 4px; border: 1px solid #444; background: #222; color: #fff; font-size: 12px;"
                bind:value={debugInfo.manualParamValue}
            />
            <button
                style="padding: 4px 8px; border-radius: 4px; background: #4caf50; color: white; border: none; cursor: pointer; font-size: 12px;"
                on:click={onSetManualParam}
            >
                Set
            </button>
        </div>
    </div>

    <div class="info-section">
        <strong>Autonomy Emotions:</strong>
        <div
            class="presets-row"
            style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px;"
        >
            {#each ["CALM", "ELATED", "GENTLE", "STERN", "DEPRESSED", "TENSE", "ASTONISHED", "SLEEP"] as emotion}
                <button
                    class="list-item clickable"
                    style="flex: 1; text-align: center; border: 1px solid #00AAFF; border-radius: 4px; font-size: 11px;"
                    on:click={() => onSetEmotion(emotion)}
                >
                    {emotion}
                </button>
            {/each}
        </div>
    </div>

    <div class="info-section">
        <strong>Motion Groups:</strong>
        <div class="scroll-list">
            {#each debugInfo.availableMotionGroups as group}
                <div class="group-container">
                    <button
                        class="group-header clickable"
                        title="Play Random {group} Motion"
                        on:click={() => {
                            playMotionTemporarilyEnabled(group);
                            debugInfo.lastMotion = `${group} (Group Trigger)`;
                        }}
                    >
                        <span class="group-name">{group}</span>
                        <span class="play-icon">▶</span>
                    </button>

                    {#if motionDefinitions && motionDefinitions[group]}
                        {#each motionDefinitions[group] ?? [] as def, i}
                            <button
                                class="list-item sub-item clickable"
                                on:click={() => {
                                    playMotionTemporarilyEnabled(group, i);
                                    debugInfo.lastMotion = `${group} (${i}): ${def.File}`;
                                }}
                            >
                                <span class="motion-index">[{i}]</span>
                                <span class="motion-name"
                                    >{def.File
                                        ? def.File.split("/").pop()
                                        : "Unknown"}</span
                                >
                            </button>
                        {/each}
                    {/if}
                </div>
            {/each}
        </div>
    </div>

    {#if debugInfo.fileMotions && debugInfo.fileMotions.length > 0}
        <div class="info-section">
            <strong>📂 Found Files ({debugInfo.fileMotions.length}):</strong>
            <div class="scroll-list">
                {#each debugInfo.fileMotions as file, i}
                    <button
                        class="list-item clickable"
                        on:click={() => {
                            playMotionTemporarilyEnabled("__debug__", i);
                            debugInfo.lastMotion = file;
                        }}
                    >
                        {file}
                    </button>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .debug-panel {
        position: fixed;
        bottom: 130px;
        right: 20px;
        width: 320px;
        max-height: 80%;
        background: rgba(0, 0, 0, 0.95);
        color: #0f0;
        padding: 15px;
        border-radius: 8px;
        border: 2px solid #0f0;
        font-family: "Courier New", monospace;
        font-size: 11px;
        z-index: 99999 !important;
        overflow-y: auto;
        pointer-events: auto !important;
        box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
        touch-action: pan-y;
    }

    .debug-panel h3 {
        margin: 0 0 10px 0;
        color: #0f0;
        border-bottom: 1px solid #0f0;
        padding-bottom: 5px;
        font-size: 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .debug-control-group {
        border-top: 1px solid #0f0;
        margin-top: 10px;
        padding-top: 10px;
    }

    .slider-row {
        display: flex;
        flex-direction: column;
        margin-bottom: 10px;
    }

    .slider-row label {
        display: flex;
        justify-content: space-between;
        margin-bottom: 2px;
        color: #0ff;
    }

    .slider-row input {
        width: 100%;
        cursor: pointer;
    }

    .gesture-grid {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
    }

    .gesture-btn {
        background: rgba(0, 255, 0, 0.1);
        border: 1px solid #0f0;
        color: #0f0;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
        flex: 1;
        min-width: 50px;
        text-align: center;
    }

    .gesture-btn:hover {
        background: rgba(0, 255, 0, 0.3);
        color: #fff;
    }

    .info-item {
        margin-bottom: 8px;
        line-height: 1.4;
    }

    .info-item strong {
        color: #0ff;
    }

    .highlight {
        color: #ff0;
        font-weight: bold;
    }

    .break-all {
        word-break: break-all;
        color: #ccc;
    }

    .info-section {
        margin-top: 12px;
        border-top: 1px solid #333;
        padding-top: 8px;
    }

    .info-section strong {
        color: #0ff;
    }

    .scroll-list {
        max-height: 200px;
        overflow-y: auto;
        background: rgba(0, 255, 0, 0.05);
        padding: 5px;
        margin-top: 5px;
        border-radius: 4px;
        border: 1px solid #333;
        pointer-events: auto;
    }

    .list-item {
        display: block;
        width: 100%;
        text-align: left;
        background: none;
        border: none;
        padding: 3px 5px;
        border-bottom: 1px solid rgba(0, 255, 0, 0.1);
        color: #0f0;
        font-family: inherit;
        font-size: inherit;
        cursor: default;
    }

    .list-item.clickable {
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .list-item.clickable:hover {
        background-color: rgba(0, 255, 0, 0.2);
        color: #fff;
    }

    .list-item:last-child {
        border-bottom: none;
    }

    .scroll-list::-webkit-scrollbar {
        width: 8px;
    }

    .scroll-list::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.3);
    }

    .scroll-list::-webkit-scrollbar-thumb {
        background: rgba(0, 255, 0, 0.5);
        border-radius: 4px;
    }

    .group-container {
        margin-bottom: 5px;
        border-bottom: 1px dashed rgba(0, 255, 0, 0.3);
    }

    .group-header {
        font-weight: bold;
        color: #0ff;
        padding: 4px 8px;
        background: rgba(0, 255, 0, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: none;
        width: 100%;
        text-align: left;
        cursor: pointer;
        transition: background 0.2s;
    }

    .group-header:hover {
        background: rgba(0, 255, 0, 0.3);
        color: #fff;
    }

    .play-icon {
        font-size: 0.8em;
        opacity: 0.7;
    }

    .list-item.sub-item {
        padding-left: 15px;
        font-size: 0.9em;
        display: flex;
        gap: 5px;
    }

    .motion-index {
        color: #aaa;
        min-width: 20px;
    }

    .motion-name {
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .controls-row {
        margin-bottom: 10px;
        display: flex;
        justify-content: center;
        gap: 10px;
    }

    .stop-btn {
        background: rgba(255, 0, 0, 0.2);
        border: 1px solid #f00;
        color: #f00;
        padding: 5px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
        flex: 1;
    }

    .reset-btn {
        background: rgba(0, 255, 255, 0.2);
        border: 1px solid #0ff;
        color: #0ff;
    }

    .reset-btn:hover {
        background: rgba(0, 255, 255, 0.4);
        color: #fff;
    }
</style>

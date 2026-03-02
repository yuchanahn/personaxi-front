<script lang="ts">
    import { onMount, tick } from "svelte";
    import { Chart } from "@astrodraw/astrochart";
    import { toast } from "$lib/stores/toast";
    import { toastError } from "$lib/utils/errorMapper";

    let year: number = 2000;
    let month: number = 8;
    let day: number = 2;
    let hour: number = 9;
    let minute: number = 15;
    let latitude: number = 37.5665;
    let longitude: number = 126.978; // default: Seoul

    let chartContainer: HTMLDivElement;
    let radixChart: any = null;
    let isLoading: boolean = false;
    let hasResult: boolean = false;
    let horoscopeData: any = null;

    async function handleSubmit() {
        if (!chartContainer) return;
        isLoading = true;
        hasResult = false;

        try {
            // Dynamic import to handle CommonJS package issues with Svelte/Vite
            const pkg = await import(
                "circular-natal-horoscope-js/dist/index.js"
            );
            const { Origin, Horoscope } = pkg.default || pkg;

            // Note: circular-natal-horoscope-js expects month to be 0-based
            const origin = new Origin({
                year: year,
                month: month - 1,
                date: day,
                hour: hour,
                minute: minute,
                latitude: latitude,
                longitude: longitude,
            });

            const horoscope = new Horoscope({
                origin: origin,
                houseSystem: "placidus",
                zodiac: "tropical",
                aspectPoints: ["bodies", "points", "angles"],
                aspectWithPoints: ["bodies", "points", "angles"],
                aspectTypes: ["major", "minor"],
                customOrbs: {},
                language: "en",
            });

            horoscopeData = horoscope;

            // Type cast horoscope to any to access undocumented properties like Points
            const h: any = horoscope;

            const planetsData = {
                Sun: [
                    h.CelestialBodies.sun.ChartPosition.Ecliptic.DecimalDegrees,
                ],
                Moon: [
                    h.CelestialBodies.moon.ChartPosition.Ecliptic
                        .DecimalDegrees,
                ],
                Mercury: [
                    h.CelestialBodies.mercury.ChartPosition.Ecliptic
                        .DecimalDegrees,
                ],
                Venus: [
                    h.CelestialBodies.venus.ChartPosition.Ecliptic
                        .DecimalDegrees,
                ],
                Mars: [
                    h.CelestialBodies.mars.ChartPosition.Ecliptic
                        .DecimalDegrees,
                ],
                Jupiter: [
                    h.CelestialBodies.jupiter.ChartPosition.Ecliptic
                        .DecimalDegrees,
                ],
                Saturn: [
                    h.CelestialBodies.saturn.ChartPosition.Ecliptic
                        .DecimalDegrees,
                ],
                Uranus: [
                    h.CelestialBodies.uranus.ChartPosition.Ecliptic
                        .DecimalDegrees,
                ],
                Neptune: [
                    h.CelestialBodies.neptune.ChartPosition.Ecliptic
                        .DecimalDegrees,
                ],
                Pluto: [
                    h.CelestialBodies.pluto.ChartPosition.Ecliptic
                        .DecimalDegrees,
                ],
                Chiron: [
                    h.CelestialBodies.chiron.ChartPosition.Ecliptic
                        .DecimalDegrees,
                ],
                Sirius: [
                    h.CelestialBodies.sirius?.ChartPosition?.Ecliptic
                        ?.DecimalDegrees || 0,
                ],
                NorthNode: [
                    h.Points?.northnode?.ChartPosition?.Ecliptic
                        ?.DecimalDegrees || 0,
                ],
                SouthNode: [
                    h.Points?.southnode?.ChartPosition?.Ecliptic
                        ?.DecimalDegrees || 0,
                ],
            };

            const cuspsData = horoscope.Houses.map(
                (h: any) =>
                    h.ChartPosition.StartPosition.Ecliptic.DecimalDegrees,
            );

            const astroData = {
                planets: planetsData,
                cusps: cuspsData,
            };

            chartContainer.innerHTML = ""; // Clear existing chart
            hasResult = true;
            await tick(); // ensure container is rendered

            const size = Math.min(chartContainer.clientWidth || 600, 600);
            const chart = new Chart(chartContainer.id, size, size);
            radixChart = chart.radix(astroData);
        } catch (error) {
            console.error("차트 계산 중 오류 발생:", error);
            toastError("calculationError");
        } finally {
            isLoading = false;
        }
    }

    async function copyToClipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(
                "프롬프트가 클립보드에 복사되었습니다. (Ctrl+V로 붙여넣으세요)",
            );
        } catch (err) {
            console.error("클립보드 복사 실패:", err);
            toastError("클립보드 복사에 실패했습니다.");
        }
    }

    function generateLLMPrompt() {
        if (!horoscopeData) {
            toastError("차트 데이터가 없습니다.");
            return;
        }

        const h: any = horoscopeData;
        let prompt = `사용자의 서양 점성술 (Natal Chart) 정보입니다.\n\n`;
        prompt += `[입력 정보]\n- 생년월일시: ${year}년 ${month}월 ${day}일 ${hour}시 ${minute}분\n`;
        prompt += `- 위치: 위도 ${latitude}, 경도 ${longitude}\n\n`;

        prompt += `[주요 앵글 (Angles)]\n`;
        prompt += `- Ascendant (어센던트): ${h.Angles.ascendant.Sign.label} (${h.Angles.ascendant.ChartPosition.Ecliptic.DecimalDegrees.toFixed(2)}°)\n`;
        prompt += `- Midheaven (Mc): ${h.Angles.midheaven.Sign.label} (${h.Angles.midheaven.ChartPosition.Ecliptic.DecimalDegrees.toFixed(2)}°)\n\n`;

        prompt += `[행성 위치 (Planets)]\n`;
        const bodies = [
            "sun",
            "moon",
            "mercury",
            "venus",
            "mars",
            "jupiter",
            "saturn",
            "uranus",
            "neptune",
            "pluto",
            "chiron",
        ];
        for (const b of bodies) {
            const key = Object.keys(h.CelestialBodies).find(
                (k) => k.toLowerCase() === b,
            );
            if (key && h.CelestialBodies[key]) {
                const body = h.CelestialBodies[key];
                prompt += `- ${body.label}: ${body.Sign.label} (${body.ChartPosition.Ecliptic.DecimalDegrees.toFixed(2)}°)\n`;
            }
        }

        prompt += `\n[하우스 (Houses)]\n`;
        h.Houses.forEach((house: any) => {
            prompt += `- House ${house.id}: ${house.Sign.label} (${house.ChartPosition.StartPosition.Ecliptic.DecimalDegrees.toFixed(2)}°)\n`;
        });

        prompt += `\n이 데이터를 바탕으로 사용자의 주요 성향, 재물운, 연애운 등을 점성술 관점에서 심층적으로 해석해주세요.`;

        console.log("=== 점성술(Astro) LLM 프롬프트 ===\n", prompt);
        copyToClipboard(prompt);
    }
</script>

<main>
    <h2>서양 점성술 (Natal Chart)</h2>
    <form on:submit|preventDefault={handleSubmit}>
        <div class="form-grid">
            <div class="input-group">
                <label for="year">출생년</label>
                <input type="number" id="year" bind:value={year} required />
            </div>
            <div class="input-group">
                <label for="month">출생월</label>
                <input
                    type="number"
                    id="month"
                    bind:value={month}
                    min="1"
                    max="12"
                    required
                />
            </div>
            <div class="input-group">
                <label for="day">출생일</label>
                <input
                    type="number"
                    id="day"
                    bind:value={day}
                    min="1"
                    max="31"
                    required
                />
            </div>
            <div class="input-group">
                <label for="hour">출생시</label>
                <input
                    type="number"
                    id="hour"
                    bind:value={hour}
                    min="0"
                    max="23"
                    required
                />
            </div>
            <div class="input-group">
                <label for="minute">출생분</label>
                <input
                    type="number"
                    id="minute"
                    bind:value={minute}
                    min="0"
                    max="59"
                    required
                />
            </div>
            <div class="input-group location-group">
                <div>
                    <label for="lat">위도 (Latitude)</label>
                    <input
                        type="number"
                        step="0.0001"
                        id="lat"
                        bind:value={latitude}
                        required
                    />
                </div>
                <div>
                    <label for="lng">경도 (Longitude)</label>
                    <input
                        type="number"
                        step="0.0001"
                        id="lng"
                        bind:value={longitude}
                        required
                    />
                </div>
            </div>
        </div>
        <button type="submit" disabled={isLoading}>
            {isLoading ? "차트 그리는 중..." : "차트 보기"}
        </button>
    </form>

    <div class="result-container" class:visible={hasResult}>
        <div
            id="astrochart-container"
            class="chart-wrapper"
            bind:this={chartContainer}
        ></div>

        {#if horoscopeData}
            <div class="info-grid">
                <div>
                    <strong>Ascendant(상승점):</strong>
                    {horoscopeData.Angles.ascendant.Sign.label} ({horoscopeData.Angles.ascendant.ChartPosition.Ecliptic.DecimalDegrees.toFixed(
                        1,
                    )}°)
                </div>
                <div>
                    <strong>Sun(태양):</strong>
                    {horoscopeData.CelestialBodies.sun.Sign.label}
                </div>
                <div>
                    <strong>Moon(달):</strong>
                    {horoscopeData.CelestialBodies.moon.Sign.label}
                </div>
                <div>
                    <strong>Midheaven(천정점):</strong>
                    {horoscopeData.Angles.midheaven.Sign.label}
                </div>
            </div>

            <button class="prompt-btn" on:click={generateLLMPrompt}>
                📋 LLM 프롬프트 복사하기
            </button>
        {/if}
    </div>
</main>

<style>
    :root {
        --primary-color: #007bff;
        --primary-hover: #0056b3;
        --border-color: #e0e0e0;
        --bg-light: #f9f9f9;
        --text-dark: #333;
        --text-light: #555;
        --text-white: #ffffff;
        --border-radius: 8px;
    }

    main {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
        max-width: 800px;
        margin: 2rem auto;
        padding: 2rem;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    h2 {
        text-align: center;
        color: var(--text-dark);
        margin-top: 0;
        margin-bottom: 1.5rem;
    }

    .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .location-group {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
        color: var(--text-light);
        font-size: 0.9rem;
    }

    input[type="number"] {
        width: 100%;
        padding: 0.75rem;
        font-size: 1rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-sizing: border-box;
    }

    button {
        width: 100%;
        padding: 0.85rem;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--text-white);
        background-color: var(--primary-color);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    button:hover {
        background-color: var(--primary-hover);
    }

    button:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }

    .result-container {
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 2px solid var(--border-color);
        display: none;
        flex-direction: column;
        align-items: center;
    }

    .result-container.visible {
        display: flex;
    }

    .chart-wrapper {
        width: 100%;
        max-width: 600px;
        height: 600px; /* SVG container aspect ratio */
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        width: 100%;
        max-width: 500px;
        background: var(--bg-light);
        padding: 1.5rem;
        border-radius: var(--border-radius);
        border: 1px solid var(--border-color);
        margin-bottom: 1.5rem;
    }

    .info-grid div {
        font-size: 1rem;
        color: var(--text-dark);
    }

    .prompt-btn {
        width: 100%;
        max-width: 500px;
        padding: 0.85rem;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--text-white);
        background-color: #28a745; /* green to distinguish */
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .prompt-btn:hover {
        background-color: #218838;
    }

    @media (max-width: 600px) {
        .form-grid {
            grid-template-columns: 1fr 1fr;
        }
        .info-grid {
            grid-template-columns: 1fr;
        }
        .chart-wrapper {
            height: clamp(300px, 90vw, 600px);
        }
    }
</style>

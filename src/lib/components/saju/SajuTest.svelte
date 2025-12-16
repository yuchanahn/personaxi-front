<script lang="ts">
    import { onMount } from "svelte";
    import {
        calculateFourPillars,
        calculateDaeunSu,
        calculateAllSajuElements,
        type FourPillars,
        type SajuElements,
        type Pillar, // Pillar 타입 import 추가
        type Gan,
        generateSajuAnalysisPrompt, // Gan 타입 import 추가
    } from "./SajuTest"; // 사용 중이신 파일 경로 (예: ./saju)
    import { toast } from "$lib/stores/toast";

    // --- 상태 변수 ---
    let year: number = 2000;
    let month: number = 8;
    let day: number = 2;
    let hour: number = 9;
    let minute: number = 15;
    let gender: "남" | "여" = "남";

    let pillars: FourPillars | null = null;
    let elements: SajuElements | null = null;
    let isLoading: boolean = false;
    let displaySolarTime: Date | null = null;

    const SIBSIN_MATRIX: {
        [mySymbol: string]: { [otherSymbol: string]: string };
    } = {
        목: { 목: "비겁", 화: "식상", 토: "재성", 금: "관성", 수: "인성" },
        화: { 화: "비겁", 토: "식상", 금: "재성", 수: "관성", 목: "인성" },
        토: { 토: "비겁", 금: "식상", 수: "재성", 목: "관성", 화: "인성" },
        금: { 금: "비겁", 수: "식상", 목: "재성", 화: "관성", 토: "인성" },
        수: { 수: "비겁", 목: "식상", 화: "재성", 금: "인성", 토: "관성" },
    };
    const UNSEONG_MAP: { [ganName: string]: { [jiName: string]: string } } = {
        갑: {
            해: "장생",
            자: "목욕",
            축: "관대",
            인: "건록",
            묘: "제왕",
            진: "쇠",
            사: "병",
            오: "사",
            미: "묘",
            신: "절",
            유: "태",
            술: "양",
        },
        을: {
            오: "장생",
            사: "목욕",
            진: "관대",
            묘: "건록",
            인: "제왕",
            축: "쇠",
            자: "병",
            해: "사",
            술: "묘",
            유: "절",
            신: "태",
            미: "양",
        },
        병: {
            인: "장생",
            묘: "목욕",
            진: "관대",
            사: "건록",
            오: "제왕",
            미: "쇠",
            신: "병",
            유: "사",
            술: "묘",
            해: "절",
            자: "태",
            축: "양",
        },
        정: {
            유: "장생",
            신: "목욕",
            미: "관대",
            오: "건록",
            사: "제왕",
            진: "쇠",
            묘: "병",
            인: "사",
            축: "묘",
            자: "절",
            해: "태",
            술: "양",
        },
        무: {
            인: "장생",
            묘: "목욕",
            진: "관대",
            사: "건록",
            오: "제왕",
            미: "쇠",
            신: "병",
            유: "사",
            술: "묘",
            해: "절",
            자: "태",
            축: "양",
        },
        기: {
            유: "장생",
            신: "목욕",
            미: "관대",
            오: "건록",
            사: "제왕",
            진: "쇠",
            묘: "병",
            인: "사",
            축: "묘",
            자: "절",
            해: "태",
            술: "양",
        },
        경: {
            사: "장생",
            오: "목욕",
            미: "관대",
            신: "건록",
            유: "제왕",
            술: "쇠",
            해: "병",
            자: "사",
            축: "묘",
            인: "절",
            묘: "태",
            진: "양",
        },
        신: {
            자: "장생",
            해: "목욕",
            술: "관대",
            유: "건록",
            신: "제왕",
            미: "쇠",
            오: "병",
            사: "사",
            진: "묘",
            묘: "절",
            인: "태",
            축: "양",
        },
        임: {
            신: "장생",
            유: "목욕",
            술: "관대",
            해: "건록",
            자: "제왕",
            축: "쇠",
            인: "병",
            묘: "사",
            진: "묘",
            사: "절",
            오: "태",
            미: "양",
        },
        계: {
            묘: "장생",
            인: "목욕",
            축: "관대",
            자: "건록",
            해: "제왕",
            술: "쇠",
            유: "병",
            신: "사",
            미: "묘",
            오: "절",
            사: "태",
            진: "양",
        },
    };

    function getSibsinName(
        me: Gan,
        other: Gan | { symbol: string; sign: string },
    ): string {
        const base = SIBSIN_MATRIX[me.symbol][other.symbol];
        const sameSign = me.sign === other.sign;
        switch (base) {
            case "비겁":
                return sameSign ? "비견" : "겁재";
            case "식상":
                return sameSign ? "식신" : "상관";
            case "재성":
                return sameSign ? "편재" : "정재";
            case "관성":
                return sameSign ? "편관" : "정관";
            case "인성":
                return sameSign ? "편인" : "정인";
            default:
                return "-";
        }
    }

    function getGeobeopUnseong(pillar: Pillar): string {
        return UNSEONG_MAP[pillar.sky.name]?.[pillar.ground.name] || "-";
    }

    // --- 로직 ---
    async function handleSubmit() {
        try {
            pillars = null;
            elements = null;

            const BirthDate = new Date(year, month - 1, day);
            const standardTime = new Date(year, month - 1, day, hour, minute);
            displaySolarTime = new Date(standardTime.getTime() - 30 * 60000);

            const calculatedPillars = calculateFourPillars(
                BirthDate,
                hour,
                minute,
            );
            pillars = calculatedPillars;

            const daeunSu = calculateDaeunSu(BirthDate, hour, minute, gender);
            elements = calculateAllSajuElements(
                calculatedPillars,
                gender,
                daeunSu,
            );
        } catch (error) {
            console.error("사주 계산 중 오류 발생:", error);
            toast.error("계산 중 오류가 발생했습니다. 입력값을 확인해주세요.");
        }
    }

    async function generatePrompt() {
        try {
            const birthDate = new Date(year, month - 1, day);
            let llmPrompt = generateSajuAnalysisPrompt(
                birthDate,
                hour,
                minute,
                gender,
            );

            console.log(llmPrompt);
        } catch (error) {
            console.error("프롬프트 생성 중 오류:", error);
        }
    }

    // --- 헬퍼 ---
    function formatJijanggan(arr: string[]) {
        return arr.length > 0 ? arr.join(", ") : "-";
    }
    function formatHapChung(arr: string[]) {
        return arr.length > 0 ? arr.join(", ") : "해당 없음";
    }
    function formatSolarTime(date: Date | null) {
        if (!date) return "";
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours()}시 ${date.getMinutes()}분`;
    }

    const colorMap: { [key: string]: string } = {
        green: "var(--color-mok)",
        red: "var(--color-hwa)",
        yellow: "var(--color-to)",
        white: "var(--color-geum)", // 흰색 배경에 흰색 글씨 방지
        black: "var(--color-su)",
    };
</script>

<main>
    <h2>사주 팔자 계산기</h2>
    <button on:click={generatePrompt} disabled={isLoading}>
        LLM 프롬프트 생성 (콘솔 확인)
    </button>
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
            <div class="input-group gender-group">
                <label>성별</label>
                <div>
                    <label>
                        <input type="radio" bind:group={gender} value="남" />
                        남성
                    </label>
                    <label>
                        <input type="radio" bind:group={gender} value="여" />
                        여성
                    </label>
                </div>
            </div>
        </div>
        <button type="submit" disabled={isLoading}>
            {isLoading ? "절기 데이터 로딩 중..." : "결과 보기"}
        </button>
    </form>

    {#if pillars && elements}
        <div class="result">
            <div class="info-box">
                <strong>사주정보</strong>
                <p>
                    생일: {year}년 {month}월 {day}일 ({gender})
                </p>
                <p>
                    생시: {hour}시 {minute}분 (보정시간: {formatSolarTime(
                        displaySolarTime,
                    )})
                </p>
            </div>

            <table class="pillar-table">
                <thead>
                    <tr>
                        <th>시주(時)</th>
                        <th>일주(日)</th>
                        <th>월주(月)</th>
                        <th>년주(年)</th>
                        <th>구분</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>{elements.sibsin.time.sky}</td>
                        <td class="ilgan">일간(나)</td>
                        <td>{elements.sibsin.month.sky}</td>
                        <td>{elements.sibsin.year.sky}</td>
                        <td class="label">십신</td>
                    </tr>
                    <tr>
                        <td>
                            <span
                                class="hanja"
                                style="background-color: {colorMap[
                                    pillars.time.sky.color
                                ]}"
                            >
                                {pillars.time.sky.code}
                            </span>
                        </td>
                        <td>
                            <span
                                class="hanja ilgan"
                                style="background-color: {colorMap[
                                    pillars.day.sky.color
                                ]}"
                            >
                                {pillars.day.sky.code}
                            </span>
                        </td>
                        <td>
                            <span
                                class="hanja"
                                style="background-color: {colorMap[
                                    pillars.month.sky.color
                                ]}"
                            >
                                {pillars.month.sky.code}
                            </span>
                        </td>
                        <td>
                            <span
                                class="hanja"
                                style="background-color: {colorMap[
                                    pillars.year.sky.color
                                ]}"
                            >
                                {pillars.year.sky.code}
                            </span>
                        </td>
                        <td class="label">천간</td>
                    </tr>
                    <tr>
                        <td>
                            <span
                                class="hanja"
                                style="background-color: {colorMap[
                                    pillars.time.ground.color
                                ]}"
                            >
                                {pillars.time.ground.code}
                            </span>
                        </td>
                        <td>
                            <span
                                class="hanja"
                                style="background-color: {colorMap[
                                    pillars.day.ground.color
                                ]}"
                            >
                                {pillars.day.ground.code}
                            </span>
                        </td>
                        <td>
                            <span
                                class="hanja"
                                style="background-color: {colorMap[
                                    pillars.month.ground.color
                                ]}"
                            >
                                {pillars.month.ground.code}
                            </span>
                        </td>
                        <td>
                            <span
                                class="hanja"
                                style="background-color: {colorMap[
                                    pillars.year.ground.color
                                ]}"
                            >
                                {pillars.year.ground.code}
                            </span>
                        </td>
                        <td class="label">지지</td>
                    </tr>
                    <tr>
                        <td>{elements.sibsin.time.ground}</td>
                        <td>{elements.sibsin.day.ground}</td>
                        <td>{elements.sibsin.month.ground}</td>
                        <td>{elements.sibsin.year.ground}</td>
                        <td class="label">십신</td>
                    </tr>
                    <tr class="jijanggan">
                        <td
                            >{formatJijanggan(
                                elements.sibsin.time.jijanggan,
                            )}</td
                        >
                        <td>{formatJijanggan(elements.sibsin.day.jijanggan)}</td
                        >
                        <td
                            >{formatJijanggan(
                                elements.sibsin.month.jijanggan,
                            )}</td
                        >
                        <td
                            >{formatJijanggan(
                                elements.sibsin.year.jijanggan,
                            )}</td
                        >
                        <td class="label">지장간</td>
                    </tr>
                    <tr>
                        <td>{elements.unseong.time}</td>
                        <td>{elements.unseong.day}</td>
                        <td>{elements.unseong.month}</td>
                        <td>{elements.unseong.year}</td>
                        <td class="label">12운성(봉)</td>
                    </tr>
                    <tr>
                        <td>{getGeobeopUnseong(pillars.time)}</td>
                        <td>{getGeobeopUnseong(pillars.day)}</td>
                        <td>{getGeobeopUnseong(pillars.month)}</td>
                        <td>{getGeobeopUnseong(pillars.year)}</td>
                        <td class="label">12운성(거)</td>
                    </tr>
                </tbody>
            </table>
            <small class="table-caption">
                * 12운성(봉): 일간 기준 / 12운성(거): 기둥의 천간 기준
            </small>

            <div class="element-grid">
                <div>
                    <strong>일간(日干)</strong>{pillars.day.sky.name} ({pillars
                        .day.sky.symbol}, {pillars.day.sky.sign})
                </div>
                <div>
                    <strong>신강/신약</strong>{elements.strength.result} (점수: {elements
                        .strength.score})
                </div>
                <div>
                    <strong>득령(得令)</strong>{elements.strength.deukRyeong
                        ? "O"
                        : "X"}
                </div>
                <div>
                    <strong>득지(得地)</strong>{elements.strength.deukJi
                        ? "O"
                        : "X"}
                </div>
                <div>
                    <strong>득세(得勢)</strong>{elements.strength.deukSe
                        ? "O"
                        : "X"}
                </div>
                <div>
                    <strong>신살(神殺)</strong>{formatHapChung(
                        elements.sinsal.list,
                    )}
                </div>
            </div>

            <div class="element-grid-full">
                <div>
                    <strong>천간합</strong>{formatHapChung(
                        elements.hapChung.ganHap,
                    )}
                </div>
                <div>
                    <strong>지지 육합</strong>{formatHapChung(
                        elements.hapChung.jiHap,
                    )}
                </div>
                <div>
                    <strong>지지 삼합</strong>{formatHapChung(
                        elements.hapChung.jiSamhap,
                    )}
                </div>
                <div>
                    <strong>지지 방합</strong>{formatHapChung(
                        elements.hapChung.jiBanghap,
                    )}
                </div>
                <div>
                    <strong>지지 충</strong>{formatHapChung(
                        elements.hapChung.jiChung,
                    )}
                </div>
                <div>
                    <strong>지지 형</strong>{formatHapChung(
                        elements.hapChung.jiHyeong,
                    )}
                </div>
                <div>
                    <strong>지지 파/해</strong>{formatHapChung([
                        ...elements.hapChung.jiPa,
                        ...elements.hapChung.jiHae,
                    ])}
                </div>
            </div>

            <h4>오행의 의미</h4>
            <table class="ohaeng-table">
                <thead>
                    <tr>
                        <th>오행</th>
                        <th>십신 (예)</th>
                        <th>오장육부</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="color-mok">목(木)</td>
                        <td>식상 (재능, 업무)</td>
                        <td>간장, 담낭</td>
                    </tr>
                    <tr>
                        <td class="color-hwa">화(火)</td>
                        <td>재성 (재물, 아내)</td>
                        <td>심장, 소장</td>
                    </tr>
                    <tr>
                        <td class="color-to">토(土)</td>
                        <td>관성 (관직, 자녀)</td>
                        <td>비장, 위장</td>
                    </tr>
                    <tr>
                        <td class="color-geum">금(金)</td>
                        <td>인성 (학문, 모친)</td>
                        <td>폐장, 대장</td>
                    </tr>
                    <tr>
                        <td class="color-su">수(水)</td>
                        <td>비겁 (정신력, 형제)</td>
                        <td>신장, 방광</td>
                    </tr>
                </tbody>
            </table>

            <h4>10년 대운 (大運)</h4>
            <div class="element-grid-full daeun-header">
                <strong>대운수: {elements.daeun.su}</strong> (매 {elements.daeun
                    .su}세, {elements.daeun.su + 10}세... 마다 시작)
                <strong>방향: {elements.daeun.direction}</strong>
            </div>
            <ol class="daeun-list">
                {#each elements.daeun.cycles as cycle}
                    <li>
                        <span>{cycle.age}세</span>
                        <strong
                            class="hanja-small"
                            style="background-color: {colorMap[
                                cycle.pillar.sky.color
                            ]}"
                        >
                            {cycle.pillar.sky.code}
                        </strong>
                        <strong
                            class="hanja-small"
                            style="background-color: {colorMap[
                                cycle.pillar.ground.color
                            ]}"
                        >
                            {cycle.pillar.ground.code}
                        </strong>
                        <small>
                            {getSibsinName(pillars.day.sky, cycle.pillar.sky)}
                            / {getSibsinName(
                                pillars.day.sky,
                                cycle.pillar.ground,
                            )}
                        </small>
                        <small class="unseong">
                            {UNSEONG_MAP[pillars.day.sky.name]?.[
                                cycle.pillar.ground.name
                            ] || "-"} (봉)
                        </small>
                    </li>
                {/each}
            </ol>
        </div>
    {/if}
</main>

<style>
    :root {
        /* 오행 색상 정의 */
        --color-mok: #10b981; /* green-500 */
        --color-hwa: #ef4444; /* red-500 */
        --color-to: #f59e0b; /* amber-500 */
        --color-geum: #d1d5db; /* gray-300 (가독성 보정) */
        --color-su: #374151; /* gray-700 (가독성 보정) */

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
        max-width: 700px; /* 너비 확장 */
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

    h4 {
        text-align: center;
        color: var(--primary-color);
        border-bottom: 2px solid var(--border-color);
        padding-bottom: 0.5rem;
        margin-top: 2.5rem;
        margin-bottom: 1.5rem;
    }

    /* --- Form --- */
    .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    .input-group {
        margin-bottom: 0;
    }
    .gender-group {
        grid-column: 1 / -1;
    }
    .gender-group > div {
        display: flex;
        gap: 1.5rem;
        padding-top: 0.5rem;
    }
    .gender-group label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: normal;
    }
    .gender-group input[type="radio"] {
        width: auto;
    }
    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
        color: var(--text-light);
        font-size: 0.9rem;
    }
    input[type="number"],
    input[type="radio"] {
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

    /* --- Result --- */
    .result {
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 2px solid var(--border-color);
    }

    /* 사주 정보 */
    .info-box {
        background: var(--bg-light);
        border-radius: var(--border-radius);
        padding: 1rem 1.5rem;
        margin-bottom: 2rem;
        border: 1px solid var(--border-color);
    }
    .info-box strong {
        display: block;
        font-size: 1.1rem;
        color: var(--primary-color);
        margin-bottom: 0.75rem;
    }
    .info-box p {
        margin: 0.25rem 0;
        color: var(--text-light);
    }

    /* 사주 원국 테이블 */
    .pillar-table {
        width: 100%;
        border-collapse: collapse;
        text-align: center;
        margin-bottom: 0.5rem;
    }
    .pillar-table th,
    .pillar-table td {
        border: 1px solid var(--border-color);
        padding: 0.5rem;
        font-size: 0.9rem;
        color: var(--text-dark);
    }
    .pillar-table th {
        background: var(--bg-light);
        font-size: 0.95rem;
    }
    .pillar-table td.label {
        background: var(--bg-light);
        font-weight: 600;
        width: 15%;
    }
    .pillar-table td.ilgan {
        font-weight: bold;
        color: var(--primary-color);
    }
    .pillar-table tr.jijanggan td {
        font-size: 0.8rem;
        color: var(--text-light);
        padding: 0.4rem;
    }
    .hanja {
        font-size: 2rem;
        font-weight: bold;
        padding: 0.25rem 0.75rem;
        border-radius: 4px;
        color: var(--text-dark); /* 기본 글자색 */
    }
    /* 오행 색상별 글자색 보정 */
    .hanja[style*="var(--color-su)"] {
        color: var(--text-white); /* 검은 배경이므로 흰 글씨 */
    }
    .hanja.ilgan {
        box-shadow: 0 0 0 3px var(--primary-color);
        position: relative;
    }
    .table-caption {
        display: block;
        text-align: right;
        font-size: 0.8rem;
        color: var(--text-light);
        margin-bottom: 1.5rem;
    }

    /* 핵심 요소 그리드 */
    .element-grid,
    .element-grid-full {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
        background: var(--bg-light);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        padding: 1rem;
        margin-bottom: 1.5rem;
        color: var(--text-dark); /* [수정] 기본 텍스트 색상을 어둡게 설정 */
    }
    .element-grid div,
    .element-grid-full div {
        padding: 0.5rem;
        border-bottom: 1px solid #eee;
    }
    .element-grid div:last-child,
    .element-grid div:nth-last-child(2) {
        border-bottom: none;
    }

    .element-grid-full {
        grid-template-columns: 1fr;
    }
    .element-grid-full div:last-child {
        border-bottom: none;
    }

    .element-grid strong,
    .element-grid-full strong {
        color: var(--text-dark);
        margin-right: 0.75rem;
        display: inline-block;
        min-width: 100px;
    }

    /* 오행 테이블 */
    .ohaeng-table {
        width: 100%;
        border-collapse: collapse;
        text-align: center;
    }
    .ohaeng-table th,
    .ohaeng-table td {
        border: 1px solid var(--border-color);
        padding: 0.6rem;
    }
    .ohaeng-table th {
        background: var(--bg-light);
    }
    .ohaeng-table td:first-child {
        font-weight: bold;
    }
    .color-mok {
        color: var(--color-mok);
    }
    .color-hwa {
        color: var(--color-hwa);
    }
    .color-to {
        color: var(--color-to);
    }
    .color-geum {
        color: #888;
    } /* 글자색이므로 가독성 보정 */
    .color-su {
        color: var(--color-su);
    }

    /* 대운 헤더 */
    .daeun-header {
        background: none;
        border: none;
        padding: 0 0 1rem 0;
        gap: 0.25rem;
    }
    .daeun-header strong {
        min-width: 0;
    }

    /* 대운 리스트 */
    .daeun-list {
        list-style: none;
        padding: 0 0 1rem 0;
        display: flex;
        overflow-x: auto;
        gap: 0.5rem;
    }
    .daeun-list li {
        flex: 0 0 90px; /* 고정 너비 */
        background: var(--bg-light);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        text-align: center;
        padding: 0.75rem 0.5rem;
    }
    .daeun-list span {
        display: block;
        font-size: 0.9rem;
        font-weight: bold;
        color: var(--text-light);
    }
    .hanja-small {
        font-size: 1.25rem;
        font-weight: bold;
        color: var(--text-dark);
        margin: 0.25rem 0.1rem;
        padding: 0 0.2rem;
        border-radius: 3px;
    }
    .hanja-small[style*="var(--color-su)"] {
        color: var(--text-white);
    }
    .daeun-list small {
        display: block;
        font-size: 0.8rem;
        color: var(--primary-color);
        margin-top: 0.25rem;
    }
    .daeun-list small.unseong {
        color: var(--text-light);
        font-style: italic;
    }
</style>

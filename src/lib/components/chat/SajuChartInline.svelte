<script lang="ts">
    import type { SajuChartInput } from "$lib/components/saju/sajuPrompt";
    import {
        calculateAllSajuElements,
        calculateDaeunSu,
        calculateFourPillars,
    } from "$lib/components/saju/SajuTest";
    import {
        parseBirthDate,
        parseBirthTime,
        parseGender,
    } from "$lib/components/utils/sajuParse";

    export let input: SajuChartInput;

    const pillarEntries = [
        { key: "year", label: "년주" },
        { key: "month", label: "월주" },
        { key: "day", label: "일주" },
        { key: "time", label: "시주" },
    ] as const;

    let errorText = "";
    let birthDateLabel = "";
    let birthTimeLabel = "";
    let genderLabel = "";
    let pillars: ReturnType<typeof calculateFourPillars> | null = null;
    let elements: ReturnType<typeof calculateAllSajuElements> | null = null;

    $: {
        errorText = "";
        pillars = null;
        elements = null;
        birthDateLabel = input?.birthDateRaw?.trim() || "";
        birthTimeLabel = input?.birthTimeRaw?.trim() || "?";
        genderLabel = input?.genderRaw?.trim() || "";

        const birthDate = parseBirthDate(input?.birthDateRaw || "");
        if (!birthDate) {
            errorText = "만세력 입력값을 해석할 수 없습니다.";
        } else {
            const birthTime = parseBirthTime(input?.birthTimeRaw || "");
            const gender = parseGender(input?.genderRaw || "");
            const daeunSu = calculateDaeunSu(
                birthDate,
                birthTime.h,
                birthTime.m,
                gender,
            );
            pillars = calculateFourPillars(birthDate, birthTime.h, birthTime.m);
            elements = calculateAllSajuElements(pillars, gender, daeunSu);
            genderLabel = gender;
            birthTimeLabel = `${String(birthTime.h).padStart(2, "0")}:${String(
                birthTime.m,
            ).padStart(2, "0")}`;
        }
    }
</script>

<div class="saju-chart-inline">
    <div class="saju-chart-header">
        <div class="saju-chart-kicker">만세력</div>
        <div class="saju-chart-meta">
            <strong>{birthDateLabel}</strong>
            <span>{birthTimeLabel} · {genderLabel}</span>
        </div>
    </div>

    {#if errorText}
        <div class="saju-chart-error">{errorText}</div>
    {:else if pillars && elements}
        <div class="saju-pillar-grid">
            {#each pillarEntries as entry}
                <div class="saju-pillar-card">
                    <div class="saju-pillar-label">{entry.label}</div>
                    <div class="saju-pillar-main">
                        {pillars[entry.key].sky.name}{pillars[entry.key].ground.name}
                    </div>
                    <div class="saju-pillar-sub">
                        천간 {entry.key === "day"
                            ? "나"
                            : elements.sibsin[entry.key].sky}
                    </div>
                    <div class="saju-pillar-sub">
                        지지 {elements.sibsin[entry.key].ground}
                    </div>
                </div>
            {/each}
        </div>

        <div class="saju-summary-grid">
            <div class="saju-summary-item">
                <span>신강/신약</span>
                <strong>{elements.strength.result}</strong>
                <em>{elements.strength.score}점</em>
            </div>
            <div class="saju-summary-item">
                <span>득령</span>
                <strong>{elements.strength.deukRyeong ? "O" : "X"}</strong>
            </div>
            <div class="saju-summary-item">
                <span>득지</span>
                <strong>{elements.strength.deukJi ? "O" : "X"}</strong>
            </div>
            <div class="saju-summary-item">
                <span>득세</span>
                <strong>{elements.strength.deukSe ? "O" : "X"}</strong>
            </div>
        </div>

        <div class="saju-summary-box">
            <div>
                <span>합충형파해</span>
                <strong>
                    {[
                        ...elements.hapChung.ganHap,
                        ...elements.hapChung.jiHap,
                        ...elements.hapChung.jiSamhap,
                        ...elements.hapChung.jiBanghap,
                        ...elements.hapChung.jiChung,
                        ...elements.hapChung.jiHyeong,
                        ...elements.hapChung.jiPa,
                        ...elements.hapChung.jiHae,
                    ].length > 0
                        ? [
                              ...elements.hapChung.ganHap,
                              ...elements.hapChung.jiHap,
                              ...elements.hapChung.jiSamhap,
                              ...elements.hapChung.jiBanghap,
                              ...elements.hapChung.jiChung,
                              ...elements.hapChung.jiHyeong,
                              ...elements.hapChung.jiPa,
                              ...elements.hapChung.jiHae,
                          ]
                              .slice(0, 3)
                              .join(", ")
                        : "없음"}
                </strong>
            </div>
            <div>
                <span>신살</span>
                <strong>
                    {elements.sinsal.list.length > 0
                        ? elements.sinsal.list.slice(0, 2).join(", ")
                        : "없음"}
                </strong>
            </div>
        </div>

        <div class="saju-daeun-box">
            <div class="saju-daeun-title">
                대운 {elements.daeun.direction} · {elements.daeun.su}세 시작
            </div>
            <div class="saju-daeun-list">
                {#each elements.daeun.cycles.slice(0, 5) as cycle}
                    <div class="saju-daeun-item">
                        <strong>{cycle.age}세</strong>
                        <span>
                            {cycle.pillar.sky.name}{cycle.pillar.ground.name}
                        </span>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .saju-chart-inline {
        width: 100%;
        max-width: 560px;
        padding: 0.9rem;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--secondary);
        margin: 0.25rem 0 0.5rem 0;
    }

    .saju-chart-header {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: flex-start;
        margin-bottom: 0.8rem;
        flex-wrap: wrap;
    }

    .saju-chart-kicker {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--muted-foreground);
    }

    .saju-chart-meta {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        font-size: 0.86rem;
    }

    .saju-chart-meta span {
        color: var(--muted-foreground);
    }

    .saju-pillar-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.55rem;
        margin-bottom: 0.8rem;
    }

    .saju-pillar-card,
    .saju-summary-item,
    .saju-summary-box,
    .saju-daeun-box {
        border: 1px solid var(--border);
        border-radius: 12px;
        background: color-mix(in srgb, var(--secondary) 78%, transparent);
    }

    .saju-pillar-card {
        padding: 0.7rem 0.55rem;
        text-align: center;
    }

    .saju-pillar-label {
        font-size: 0.76rem;
        color: var(--muted-foreground);
        margin-bottom: 0.2rem;
    }

    .saju-pillar-main {
        font-size: 1.15rem;
        font-weight: 800;
        margin-bottom: 0.18rem;
    }

    .saju-pillar-sub {
        font-size: 0.72rem;
        color: var(--muted-foreground);
    }

    .saju-summary-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.55rem;
        margin-bottom: 0.8rem;
    }

    .saju-summary-item {
        padding: 0.7rem 0.55rem;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        text-align: center;
    }

    .saju-summary-item span,
    .saju-summary-box span {
        font-size: 0.75rem;
        color: var(--muted-foreground);
    }

    .saju-summary-item strong {
        font-size: 1rem;
    }

    .saju-summary-item em {
        font-style: normal;
        font-size: 0.72rem;
        color: var(--muted-foreground);
    }

    .saju-summary-box {
        padding: 0.7rem 0.8rem;
        display: grid;
        gap: 0.45rem;
        margin-bottom: 0.8rem;
    }

    .saju-summary-box div {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
    }

    .saju-summary-box strong {
        text-align: right;
        font-size: 0.84rem;
    }

    .saju-daeun-box {
        padding: 0.7rem 0.8rem;
    }

    .saju-daeun-title {
        font-size: 0.82rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
    }

    .saju-daeun-list {
        display: grid;
        gap: 0.35rem;
    }

    .saju-daeun-item {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        font-size: 0.82rem;
    }

    .saju-daeun-item span {
        color: var(--muted-foreground);
    }

    .saju-chart-error {
        font-size: 0.85rem;
        color: var(--muted-foreground);
    }

    @media (max-width: 640px) {
        .saju-pillar-grid,
        .saju-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }
</style>

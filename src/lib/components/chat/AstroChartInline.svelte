<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    type AstroChartInput,
    resolveAstroCoordinates,
  } from "$lib/components/astrology/astrologyPrompt";
  import { parseBirthDate, parseBirthTime } from "$lib/components/utils/sajuParse";

  export let input: AstroChartInput;
  export let blockId: string;

  let chartContainer: HTMLDivElement;
  let isLoading = true;
  let errorText = "";
  let summary = "";

  onMount(async () => {
    try {
      const birthDate = parseBirthDate(input.birthDateRaw);
      if (!birthDate) {
        throw new Error("Invalid birth date");
      }
      const t = parseBirthTime(input.birthTimeRaw);

      const { latitude, longitude } = await resolveAstroCoordinates({
        latitude: input.latitude,
        longitude: input.longitude,
        placeName: input.placeName,
      });

      const pkg = await import("circular-natal-horoscope-js/dist/index.js");
      const { Origin, Horoscope } = (pkg as any).default || pkg;
      const astro = await import("@astrodraw/astrochart");
      const Chart = (astro as any).Chart;

      const origin = new Origin({
        year: birthDate.getFullYear(),
        month: birthDate.getMonth(),
        date: birthDate.getDate(),
        hour: t.h,
        minute: t.m,
        latitude,
        longitude,
      });

      const horoscope = new Horoscope({
        origin,
        houseSystem: "placidus",
        zodiac: "tropical",
        aspectPoints: ["bodies", "points", "angles"],
        aspectWithPoints: ["bodies", "points", "angles"],
        aspectTypes: ["major", "minor"],
        customOrbs: {},
        language: "en",
      }) as any;

      const h = horoscope;
      const planetsData = {
        Sun: [h.CelestialBodies.sun.ChartPosition.Ecliptic.DecimalDegrees],
        Moon: [h.CelestialBodies.moon.ChartPosition.Ecliptic.DecimalDegrees],
        Mercury: [h.CelestialBodies.mercury.ChartPosition.Ecliptic.DecimalDegrees],
        Venus: [h.CelestialBodies.venus.ChartPosition.Ecliptic.DecimalDegrees],
        Mars: [h.CelestialBodies.mars.ChartPosition.Ecliptic.DecimalDegrees],
        Jupiter: [h.CelestialBodies.jupiter.ChartPosition.Ecliptic.DecimalDegrees],
        Saturn: [h.CelestialBodies.saturn.ChartPosition.Ecliptic.DecimalDegrees],
        Uranus: [h.CelestialBodies.uranus.ChartPosition.Ecliptic.DecimalDegrees],
        Neptune: [h.CelestialBodies.neptune.ChartPosition.Ecliptic.DecimalDegrees],
        Pluto: [h.CelestialBodies.pluto.ChartPosition.Ecliptic.DecimalDegrees],
        Chiron: [h.CelestialBodies.chiron.ChartPosition.Ecliptic.DecimalDegrees],
        Sirius: [h.CelestialBodies.sirius?.ChartPosition?.Ecliptic?.DecimalDegrees || 0],
        NorthNode: [h.Points?.northnode?.ChartPosition?.Ecliptic?.DecimalDegrees || 0],
        SouthNode: [h.Points?.southnode?.ChartPosition?.Ecliptic?.DecimalDegrees || 0],
      };

      const cuspsData = horoscope.Houses.map(
        (x: any) => x.ChartPosition.StartPosition.Ecliptic.DecimalDegrees,
      );

      const astroData = {
        planets: planetsData,
        cusps: cuspsData,
      };

      summary = `ASC ${h.Angles.ascendant.Sign.label} · Sun ${h.CelestialBodies.sun.Sign.label} · Moon ${h.CelestialBodies.moon.Sign.label}`;

      await tick();
      const size = Math.min(chartContainer.clientWidth || 420, 420);
      chartContainer.innerHTML = "";
      const chart = new Chart(`astro-chart-${blockId}`, size, size);
      chart.radix(astroData);
    } catch (err) {
      errorText = "Astrology chart could not be rendered.";
      console.error(err);
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="astro-chart-inline">
  <div class="astro-title">Natal Chart</div>
  {#if isLoading}
    <div class="astro-loading">Generating chart...</div>
  {:else if errorText}
    <div class="astro-error">{errorText}</div>
  {:else}
    <div class="astro-summary">{summary}</div>
  {/if}
  <div class="astro-canvas" id={"astro-chart-" + blockId} bind:this={chartContainer}></div>
</div>

<style>
  .astro-chart-inline {
    width: 100%;
    max-width: 460px;
    border: 1px solid var(--border);
    background: var(--secondary);
    border-radius: 12px;
    padding: 0.75rem;
    margin: 0.25rem 0 0.5rem 0;
  }
  .astro-title {
    font-weight: 700;
    font-size: 0.95rem;
    margin-bottom: 0.35rem;
  }
  .astro-summary {
    font-size: 0.82rem;
    color: var(--muted-foreground);
    margin-bottom: 0.5rem;
  }
  .astro-loading,
  .astro-error {
    font-size: 0.85rem;
    color: var(--muted-foreground);
    margin-bottom: 0.5rem;
  }
  .astro-canvas {
    width: 100%;
    display: flex;
    justify-content: center;
  }
</style>


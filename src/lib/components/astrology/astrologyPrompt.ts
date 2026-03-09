import { parseBirthDate, parseBirthTime } from "$lib/components/utils/sajuParse";

type AstroInput = {
    birthDate: Date;
    birthHour: number;
    birthMinute: number;
    latitude: number;
    longitude: number;
    placeName: string | null;
};

export type AstroChartInput = {
    birthDateRaw: string;
    birthTimeRaw: string;
    latitude?: number;
    longitude?: number;
    placeName?: string;
};

const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.978;

function parseNumberOrNull(raw: string): number | null {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

function parseLatLngPair(raw: string): { lat: number; lng: number } | null {
    const parts = raw
        .split(/[,\s/]+/)
        .map((v) => v.trim())
        .filter(Boolean);
    if (parts.length < 2) return null;
    const lat = parseNumberOrNull(parts[0]);
    const lng = parseNumberOrNull(parts[1]);
    if (lat === null || lng === null) return null;
    return { lat, lng };
}

function isAstroDateId(fieldId: string): boolean {
    return ["astro_date", "astrology_date", "birth_date"].includes(fieldId);
}

function isAstroTimeId(fieldId: string): boolean {
    return ["astro_time", "astrology_time", "birth_time"].includes(fieldId);
}

function isAstroLatId(fieldId: string): boolean {
    return ["astro_lat", "astrology_lat", "birth_lat"].includes(fieldId);
}

function isAstroLngId(fieldId: string): boolean {
    return ["astro_lng", "astrology_lng", "birth_lng"].includes(fieldId);
}

function isAstroLocationId(fieldId: string): boolean {
    return ["astro_location", "astrology_location", "birth_location"].includes(
        fieldId,
    );
}

function isAstroPlaceId(fieldId: string): boolean {
    return ["astro_place", "astrology_place", "birth_place"].includes(fieldId);
}

function parseFieldIdValueLines(input: string): Record<string, string> {
    const out: Record<string, string> = {};
    const re = /inputField\s+\[ID:\s*([^\]]+)\]\s*:\s*(.+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
        const key = (m[1] || "").trim().toLowerCase();
        const val = (m[2] || "").trim();
        if (key && val) out[key] = val;
    }
    return out;
}

function getByAliases(
    map: Record<string, string>,
    aliases: string[],
): string | undefined {
    for (const alias of aliases) {
        const v = map[alias.toLowerCase()];
        if (v) return v;
    }
    return undefined;
}

async function geocodePlaceName(
    placeName: string,
): Promise<{ lat: number; lng: number } | null> {
    const q = placeName.trim();
    if (!q) return null;

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as Array<{ lat: string; lon: string }>;
        if (!Array.isArray(data) || data.length === 0) return null;
        const lat = Number(data[0].lat);
        const lng = Number(data[0].lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    } catch {
        return null;
    }
}

export function extractAstrologyInput(
    fields: NodeListOf<HTMLInputElement>,
): AstroInput | null {
    let birthDate: Date | null = null;
    let birthHour: number | null = null;
    let birthMinute: number | null = null;
    let latitude = DEFAULT_LAT;
    let longitude = DEFAULT_LNG;
    let placeName: string | null = null;
    let hasAstroField = false;

    fields.forEach((field) => {
        const fieldId = (field.dataset.id || "").trim().toLowerCase();
        const value = (field.value || "").trim();
        if (!fieldId || !value) return;

        if (isAstroDateId(fieldId)) {
            hasAstroField = true;
            birthDate = parseBirthDate(value) ?? birthDate;
            return;
        }
        if (isAstroTimeId(fieldId)) {
            hasAstroField = true;
            const t = parseBirthTime(value);
            birthHour = t.h;
            birthMinute = t.m;
            return;
        }
        if (isAstroLatId(fieldId)) {
            hasAstroField = true;
            const n = parseNumberOrNull(value);
            if (n !== null) latitude = n;
            return;
        }
        if (isAstroLngId(fieldId)) {
            hasAstroField = true;
            const n = parseNumberOrNull(value);
            if (n !== null) longitude = n;
            return;
        }
        if (isAstroLocationId(fieldId)) {
            hasAstroField = true;
            const pair = parseLatLngPair(value);
            if (pair) {
                latitude = pair.lat;
                longitude = pair.lng;
            } else {
                placeName = value;
            }
            return;
        }
        if (isAstroPlaceId(fieldId)) {
            hasAstroField = true;
            placeName = value;
        }
    });

    if (!hasAstroField || !birthDate || birthHour === null || birthMinute === null) {
        return null;
    }

    return {
        birthDate: birthDate as Date,
        birthHour: birthHour as number,
        birthMinute: birthMinute as number,
        latitude,
        longitude,
        placeName,
    };
}

export function extractAstrologyInputFromSystemInput(
    systemInputMessage: string,
): AstroChartInput | null {
    if (!systemInputMessage.includes("<system-input>")) return null;

    const body = systemInputMessage
        .replace(/^.*?<system-input>/is, "")
        .replace(/<\/system-input>.*$/is, "");
    const map = parseFieldIdValueLines(body);

    const dateRaw = getByAliases(map, ["astro_date", "astrology_date", "birth_date"]);
    const timeRaw = getByAliases(map, ["astro_time", "astrology_time", "birth_time"]);
    if (!dateRaw || !timeRaw) return null;

    let latitude: number | undefined;
    let longitude: number | undefined;
    let placeName: string | undefined;

    const locationRaw = getByAliases(map, [
        "astro_location",
        "astrology_location",
        "birth_location",
    ]);
    const placeRaw = getByAliases(map, [
        "astro_place",
        "astrology_place",
        "birth_place",
    ]);
    const latRaw = getByAliases(map, ["astro_lat", "astrology_lat", "birth_lat"]);
    const lngRaw = getByAliases(map, ["astro_lng", "astrology_lng", "birth_lng"]);

    if (locationRaw) {
        const pair = parseLatLngPair(locationRaw);
        if (pair) {
            latitude = pair.lat;
            longitude = pair.lng;
        } else {
            placeName = locationRaw;
        }
    }
    if (latRaw) {
        const n = parseNumberOrNull(latRaw);
        if (n !== null) latitude = n;
    }
    if (lngRaw) {
        const n = parseNumberOrNull(lngRaw);
        if (n !== null) longitude = n;
    }
    if (placeRaw) {
        placeName = placeRaw;
    }

    return {
        birthDateRaw: dateRaw,
        birthTimeRaw: timeRaw,
        latitude,
        longitude,
        placeName,
    };
}

export async function resolveAstroCoordinates(input: {
    latitude?: number;
    longitude?: number;
    placeName?: string;
}): Promise<{ latitude: number; longitude: number }> {
    let latitude = input.latitude ?? DEFAULT_LAT;
    let longitude = input.longitude ?? DEFAULT_LNG;

    if (
        (input.latitude === undefined || input.longitude === undefined) &&
        input.placeName
    ) {
        const geo = await geocodePlaceName(input.placeName);
        if (geo) {
            latitude = geo.lat;
            longitude = geo.lng;
        }
    }

    return { latitude, longitude };
}

export async function generateAstrologyAnalysisPrompt(
    input: AstroInput,
): Promise<string> {
    const resolved = await resolveAstroCoordinates({
        latitude: input.latitude,
        longitude: input.longitude,
        placeName: input.placeName ?? undefined,
    });
    const latitude = resolved.latitude;
    const longitude = resolved.longitude;

    const pkg = await import("circular-natal-horoscope-js/dist/index.js");
    const { Origin, Horoscope } = (pkg as any).default || pkg;

    const origin = new Origin({
        year: input.birthDate.getFullYear(),
        month: input.birthDate.getMonth(),
        date: input.birthDate.getDate(),
        hour: input.birthHour,
        minute: input.birthMinute,
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

    let prompt = `사용자의 서양 점성술 (Natal Chart) 정보입니다.\n\n`;
    prompt += `[입력 정보]\n`;
    prompt += `- 생년월일시: ${input.birthDate.getFullYear()}년 ${input.birthDate.getMonth() + 1}월 ${input.birthDate.getDate()}일 ${input.birthHour}시 ${input.birthMinute}분\n`;
    if (input.placeName) {
        prompt += `- 지역명: ${input.placeName}\n`;
    }
    prompt += `- 위치: 위도 ${latitude}, 경도 ${longitude}\n\n`;

    prompt += `[주요 앵글 (Angles)]\n`;
    prompt += `- Ascendant: ${horoscope.Angles.ascendant.Sign.label} (${horoscope.Angles.ascendant.ChartPosition.Ecliptic.DecimalDegrees.toFixed(2)}°)\n`;
    prompt += `- Midheaven: ${horoscope.Angles.midheaven.Sign.label} (${horoscope.Angles.midheaven.ChartPosition.Ecliptic.DecimalDegrees.toFixed(2)}°)\n\n`;

    prompt += `[행성 위치 (Planets)]\n`;
    for (const b of bodies) {
        const key = Object.keys(horoscope.CelestialBodies).find(
            (k) => k.toLowerCase() === b,
        );
        if (!key || !horoscope.CelestialBodies[key]) continue;
        const body = horoscope.CelestialBodies[key];
        prompt += `- ${body.label}: ${body.Sign.label} (${body.ChartPosition.Ecliptic.DecimalDegrees.toFixed(2)}°)\n`;
    }

    prompt += `\n[하우스 (Houses)]\n`;
    horoscope.Houses.forEach((house: any) => {
        prompt += `- House ${house.id}: ${house.Sign.label} (${house.ChartPosition.StartPosition.Ecliptic.DecimalDegrees.toFixed(2)}°)\n`;
    });

    prompt += `\n이 데이터를 바탕으로 성향, 관계 성향, 감정 패턴을 점성술 관점에서 해석하고, 불확실한 부분은 단정하지 마세요.`;
    return prompt;
}

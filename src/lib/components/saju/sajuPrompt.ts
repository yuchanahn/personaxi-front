export type SajuChartInput = {
    birthDateRaw: string;
    birthTimeRaw?: string;
    genderRaw: string;
};

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

function parseButtonSelections(input: string): Record<string, string> {
    const out: Record<string, string> = {};
    const re = /\[Button Clicked\s+\[ID:\s*([^\]]+)\]\s*:\s*([^\]]+?)\]/gi;
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
        const value = map[alias.toLowerCase()];
        if (value) return value;
    }
    return undefined;
}

export function extractSajuInputFromSystemInput(
    systemInputMessage: string,
): SajuChartInput | null {
    if (!systemInputMessage.includes("<system-input>")) return null;

    const body = systemInputMessage
        .replace(/^.*?<system-input>/is, "")
        .replace(/<\/system-input>.*$/is, "");

    const fieldMap = parseFieldIdValueLines(body);
    const buttonMap = parseButtonSelections(body);

    const dateRaw = getByAliases(fieldMap, ["saju_date", "birth_date"]);
    const timeRaw = getByAliases(fieldMap, ["saju_time", "birth_time"]);
    const genderRaw =
        getByAliases(buttonMap, ["saju_gender", "gender"]) ??
        getByAliases(fieldMap, ["saju_gender", "gender"]);

    if (!dateRaw || !genderRaw) return null;

    return {
        birthDateRaw: dateRaw,
        birthTimeRaw: timeRaw,
        genderRaw,
    };
}

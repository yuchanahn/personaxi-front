const VARS_BLOCK_REGEX = /<vars\b[^>]*>([\s\S]*?)<\/vars>/gi;

function shouldStartNewAssignment(
    rawLine: string,
    candidateKey: string,
    knownKeys: Set<string>,
) {
    if (!candidateKey) return false;
    if (knownKeys.has(candidateKey)) return true;
    if (knownKeys.size === 0) return true;
    if (/^\s*[-*•]/.test(rawLine)) return false;
    return !/^\s+/.test(rawLine);
}

export function parseVarsBody(
    body: string,
    validKeys?: Iterable<string>,
): Record<string, string> {
    const parsed: Record<string, string> = {};
    const knownKeys = new Set(
        Array.from(validKeys ?? [])
            .map((key) => key.trim())
            .filter(Boolean),
    );
    const lines = body.replace(/\r\n?/g, "\n").trim().split("\n");

    let currentKey: string | null = null;
    let currentValueLines: string[] = [];

    const flush = () => {
        if (!currentKey) return;
        parsed[currentKey] = currentValueLines.join("\n").trim();
        currentKey = null;
        currentValueLines = [];
    };

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        const eqIndex = line.indexOf("=");
        const candidateKey = eqIndex > 0 ? line.slice(0, eqIndex).trim() : "";

        if (shouldStartNewAssignment(rawLine, candidateKey, knownKeys)) {
            flush();
            currentKey = candidateKey;
            currentValueLines = [line.slice(eqIndex + 1).trim()];
            continue;
        }

        if (!currentKey) continue;
        currentValueLines.push(line.trim());
    }

    flush();
    return parsed;
}

export function applyVarsFromContent(
    state: Record<string, string>,
    content: string,
    validKeys?: Iterable<string>,
) {
    const matches = content.matchAll(VARS_BLOCK_REGEX);

    for (const match of matches) {
        const parsed = parseVarsBody(match[1] ?? "", validKeys);
        for (const [key, value] of Object.entries(parsed)) {
            state[key] = value;
        }
    }

    return state;
}

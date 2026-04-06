const ASCII_UNIT = 1;
const DEFAULT_UNIT = 3;

export function getWeightedLimitUnits(limit: number): number {
    return limit * DEFAULT_UNIT;
}

export function getWeightedCharUnits(
    value: string | null | undefined,
): number {
    if (!value) return 0;

    let units = 0;
    for (const char of value) {
        units += char.charCodeAt(0) <= 0x7f ? ASCII_UNIT : DEFAULT_UNIT;
    }
    return units;
}

export function getWeightedCharCount(
    value: string | null | undefined,
): number {
    return getWeightedCharUnits(value) / DEFAULT_UNIT;
}

export function formatWeightedUnits(units: number): string {
    const count = units / DEFAULT_UNIT;
    return Number.isInteger(count) ? String(count) : count.toFixed(1);
}

export function formatWeightedCharCount(
    value: string | null | undefined,
): string {
    return formatWeightedUnits(getWeightedCharUnits(value));
}

export function isWeightedLimitExceeded(
    value: string | null | undefined,
    limit: number,
): boolean {
    return getWeightedCharUnits(value) > getWeightedLimitUnits(limit);
}

export function isWeightedLimitReached(
    value: string | null | undefined,
    limit: number,
): boolean {
    return getWeightedCharUnits(value) >= getWeightedLimitUnits(limit);
}

export function getWeightedRawMaxLength(
    value: string | null | undefined,
    limit: number,
): number {
    const rawLength = value?.length ?? 0;
    const remainingUnits = Math.max(
        0,
        getWeightedLimitUnits(limit) - getWeightedCharUnits(value),
    );
    return rawLength + remainingUnits;
}

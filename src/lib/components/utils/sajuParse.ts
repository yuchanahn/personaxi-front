export type SajuGender = "남" | "여";

export function parseBirthDate(raw: string): Date | null {
    const s = raw.trim();
    if (!s) return null;

    const digits = s.replace(/[^\d]/g, "");
    if (digits.length === 8) {
        const y = parseInt(digits.slice(0, 4), 10);
        const m = parseInt(digits.slice(4, 6), 10);
        const d = parseInt(digits.slice(6, 8), 10);
        const dt = new Date(y, m - 1, d);
        if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) return dt;
    }

    const m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (m) {
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10);
        const d = parseInt(m[3], 10);
        const dt = new Date(y, mo - 1, d);
        if (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d) return dt;
    }

    const fallback = new Date(s);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function parseBirthTime(raw: string): { h: number; m: number } {
    const s = raw.trim();
    if (!s) return { h: 12, m: 0 };

    const digits = s.replace(/[^\d]/g, "");
    if (digits.length === 4) {
        const h = parseInt(digits.slice(0, 2), 10);
        const m = parseInt(digits.slice(2, 4), 10);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { h, m };
    }
    if (digits.length === 3) {
        const h = parseInt(digits.slice(0, 1), 10);
        const m = parseInt(digits.slice(1, 3), 10);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { h, m };
    }

    const mt = s.match(/(\d{1,2})(?:\D+(\d{1,2}))?/);
    if (mt) {
        const h = parseInt(mt[1], 10);
        const m = mt[2] ? parseInt(mt[2], 10) : 0;
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { h, m };
    }

    return { h: 12, m: 0 };
}

export function parseGender(raw: string): SajuGender {
    const s = raw.trim().toLowerCase();
    if (!s) return "남";
    if (/(여|여자|여성|woman|female|f\b)/i.test(s)) return "여";
    if (/(남|남자|남성|man|male|m\b)/i.test(s)) return "남";
    return "남";
}

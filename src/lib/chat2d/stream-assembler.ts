import type { StreamAssemblyResult } from "./types";

export const INCOMPLETE_DIALOGUE_SENTINEL = "\uE000";

const VARS_TAG_REGEX = /(?:\s*)<vars\b[^>]*>[\s\S]*?<\/vars>(?:\s*)/gi;
const INCOMPLETE_VARS_TAG_REGEX = /(?:\s*)<vars\b[^>]*>[\s\S]*$/i;
const DIALOGUE_OPEN_COMPLETE_RE = /<(?:dialogue|say)\b[^>]*>/g;
const DIALOGUE_CLOSE_RE = /<\/(?:dialogue|say)>/g;
const DIALOGUE_OPEN_PARTIAL_AT_END_RE = /<(?:dialogue|say)\b[^>]*$/;
const SPEAKER_ATTR_PARTIAL_RE = /speaker="[^"]*$/;

export function assembleRenderableAssistantContent(
    raw: string,
): StreamAssemblyResult {
    const withoutVars = raw
        .replace(VARS_TAG_REGEX, "")
        .replace(INCOMPLETE_VARS_TAG_REGEX, "");

    const styleStart = findIncompleteStyleTagStart(withoutVars);
    const safePrefix =
        styleStart === -1 ? withoutVars : withoutVars.slice(0, styleStart);

    return {
        content: patchUnclosedDialogueForParse(trimTrailingBrokenTag(safePrefix)),
        hasPendingStyle: styleStart !== -1,
    };
}

function trimTrailingBrokenTag(content: string): string {
    const lastOpen = content.lastIndexOf("<");
    const lastClose = content.lastIndexOf(">");
    if (lastOpen > lastClose) {
        return content.slice(0, lastOpen);
    }
    return content;
}

function findIncompleteStyleTagStart(content: string): number {
    const styleOpenRegex = /<style\b[^>]*>/gi;
    let match: RegExpExecArray | null;

    while ((match = styleOpenRegex.exec(content)) !== null) {
        const closeIdx = content.indexOf("</style>", match.index);
        if (closeIdx === -1) {
            return match.index;
        }
        styleOpenRegex.lastIndex = closeIdx + "</style>".length;
    }

    return -1;
}

export function patchUnclosedDialogueForParse(raw: string): string {
    let s = raw;

    if (DIALOGUE_OPEN_PARTIAL_AT_END_RE.test(s)) {
        if (SPEAKER_ATTR_PARTIAL_RE.test(s)) s += `"`;
        s += `>`;
    }

    const openCount = (s.match(DIALOGUE_OPEN_COMPLETE_RE) ?? []).length;
    const closeCount = (s.match(DIALOGUE_CLOSE_RE) ?? []).length;
    const missing = openCount - closeCount;

    if (missing > 0) {
        const openMatches = Array.from(s.matchAll(/<(dialogue|say)\b[^>]*>/g));
        const lastOpenTag = openMatches.at(-1)?.[1] ?? "say";
        const closingTag = lastOpenTag === "say" ? "</say>" : "</dialogue>";
        s += `${INCOMPLETE_DIALOGUE_SENTINEL}${closingTag.repeat(missing)}`;
    }

    return s;
}

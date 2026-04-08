import type { StreamAssemblyResult } from "./types";

export const INCOMPLETE_DIALOGUE_SENTINEL = "\uE000";

const VARS_TAG_REGEX = /(?:\s*)<vars\b[^>]*>[\s\S]*?<\/vars>(?:\s*)/gi;
const INCOMPLETE_VARS_TAG_REGEX = /(?:\s*)<vars\b[^>]*>[\s\S]*$/i;
const END_TAG_REGEX = /(?:\s*<end>\s*|\s*<end\b[^>]*>[\s\S]*?<\/end>\s*)$/i;
const DIALOGUE_OPEN_COMPLETE_RE = /<(?:dialogue|say)\b[^>]*>/g;
const DIALOGUE_CLOSE_RE = /<\/(?:dialogue|say)>/g;
const DIALOGUE_OPEN_PARTIAL_AT_END_RE = /<(?:dialogue|say)\b[^>]*$/;
const SPEAKER_ATTR_PARTIAL_RE = /speaker="[^"]*$/;
const UNSAFE_HTML_CONTAINER_TAGS = [
    "style",
    "div",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "p",
    "span",
    "section",
    "article",
    "header",
    "footer",
    "main",
    "aside",
    "blockquote",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "button",
    "label",
    "select",
    "option",
    "textarea",
    "form",
] as const;
const UNSAFE_HTML_VOID_TAGS = ["input", "img", "br", "hr"] as const;
const ATOMIC_INTERACTIVE_CONTAINER_TAGS = [
    "style",
    "div",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "section",
    "article",
    "header",
    "footer",
    "main",
    "aside",
    "button",
    "label",
    "select",
    "option",
    "textarea",
    "form",
] as const;
const ATOMIC_INTERACTIVE_VOID_TAGS = ["input", "img", "br", "hr"] as const;

export function assembleRenderableAssistantContent(
    raw: string,
): StreamAssemblyResult {
    const withoutVars = raw
        .replace(VARS_TAG_REGEX, "")
        .replace(INCOMPLETE_VARS_TAG_REGEX, "")
        .replace(END_TAG_REGEX, "");

    const cutIndex = findFirstUnsafeCutIndex(withoutVars);
    const safePrefix = cutIndex === -1 ? withoutVars : withoutVars.slice(0, cutIndex);

    return {
        content: patchUnclosedDialogueForParse(trimTrailingBrokenTag(safePrefix)),
        hasPendingStyle: findFirstPendingInteractiveCutIndex(withoutVars) !== -1,
    };
}

export function skipInteractiveHtmlTyping(
    content: string,
    currentLength: number,
    nextLength: number,
): number {
    const candidate = findNextAtomicInteractiveSegment(
        content,
        currentLength,
        nextLength,
    );
    return candidate?.end ?? nextLength;
}

function trimTrailingBrokenTag(content: string): string {
    const lastOpen = content.lastIndexOf("<");
    const lastClose = content.lastIndexOf(">");
    if (lastOpen > lastClose) {
        return content.slice(0, lastOpen);
    }
    return content;
}

function findFirstUnsafeCutIndex(content: string): number {
    const candidates = [
        findIncompleteRawTagStart(content),
        findIncompleteStructuredTagStart(content),
    ].filter((index) => index !== -1);

    if (candidates.length === 0) return -1;
    return Math.min(...candidates);
}

function findIncompleteRawTagStart(content: string): number {
    const lastOpen = content.lastIndexOf("<");
    const lastClose = content.lastIndexOf(">");
    if (lastOpen > lastClose) {
        return lastOpen;
    }
    return -1;
}

function findIncompleteStructuredTagStart(content: string): number {
    for (const tagName of UNSAFE_HTML_CONTAINER_TAGS) {
        const openRegex = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
        let match: RegExpExecArray | null;

        while ((match = openRegex.exec(content)) !== null) {
            const closeIndex = findMatchingContainerEnd(content, match.index, tagName);
            if (closeIndex === -1) {
                return match.index;
            }
            openRegex.lastIndex = closeIndex;
        }
    }

    for (const tagName of UNSAFE_HTML_VOID_TAGS) {
        const openRegex = new RegExp(`<${tagName}\\b[^>]*`, "gi");
        let match: RegExpExecArray | null;

        while ((match = openRegex.exec(content)) !== null) {
            const tagEnd = content.indexOf(">", match.index);
            if (tagEnd === -1) {
                return match.index;
            }
            openRegex.lastIndex = tagEnd + 1;
        }
    }

    const incompleteActionIndex = content.search(/<Action\b[^>]*$/i);
    if (incompleteActionIndex !== -1) {
        return incompleteActionIndex;
    }

    return -1;
}

function findFirstPendingInteractiveCutIndex(content: string): number {
    const candidates: number[] = [];

    for (const tagName of ATOMIC_INTERACTIVE_CONTAINER_TAGS) {
        const openRegex = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
        let match: RegExpExecArray | null;

        while ((match = openRegex.exec(content)) !== null) {
            const closeIndex = findMatchingContainerEnd(content, match.index, tagName);
            if (closeIndex === -1) {
                candidates.push(match.index);
                break;
            }
            openRegex.lastIndex = closeIndex;
        }
    }

    for (const tagName of ATOMIC_INTERACTIVE_VOID_TAGS) {
        const openRegex = new RegExp(`<${tagName}\\b[^>]*`, "gi");
        let match: RegExpExecArray | null;

        while ((match = openRegex.exec(content)) !== null) {
            const tagEnd = content.indexOf(">", match.index);
            if (tagEnd === -1) {
                candidates.push(match.index);
                break;
            }
            openRegex.lastIndex = tagEnd + 1;
        }
    }

    const incompleteActionIndex = content.search(/<Action\b[^>]*$/i);
    if (incompleteActionIndex !== -1) {
        candidates.push(incompleteActionIndex);
    }

    if (candidates.length === 0) return -1;
    return Math.min(...candidates);
}

function findMatchingContainerEnd(
    content: string,
    startIndex: number,
    tagName: string,
): number {
    const tagRegex = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
    tagRegex.lastIndex = startIndex;

    let depth = 0;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(content)) !== null) {
        const tag = match[0];
        const isClosing = tag.startsWith("</");
        const isSelfClosing = tag.endsWith("/>");

        if (!isClosing) {
            depth += 1;
            if (isSelfClosing) depth -= 1;
        } else {
            depth -= 1;
            if (depth === 0) {
                return match.index + tag.length;
            }
        }
    }

    return -1;
}

function findNextAtomicInteractiveSegment(
    content: string,
    currentLength: number,
    nextLength: number,
): { start: number; end: number } | null {
    let best: { start: number; end: number } | null = null;

    const consider = (start: number, end: number) => {
        const intersects =
            (currentLength <= start && nextLength >= start) ||
            (start < nextLength && nextLength < end) ||
            (start < currentLength && currentLength < end);

        if (!intersects) return;
        if (!best || start < best.start) {
            best = { start, end };
        }
    };

    for (const tagName of ATOMIC_INTERACTIVE_CONTAINER_TAGS) {
        const openRegex = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
        let match: RegExpExecArray | null;

        while ((match = openRegex.exec(content)) !== null) {
            const start = match.index;
            const end = findMatchingContainerEnd(content, start, tagName);
            if (end === -1) continue;
            consider(start, end);
            openRegex.lastIndex = end;
        }
    }

    for (const tagName of ATOMIC_INTERACTIVE_VOID_TAGS) {
        const openRegex = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
        let match: RegExpExecArray | null;

        while ((match = openRegex.exec(content)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            consider(start, end);
        }
    }

    const actionRegex = /<Action\b[^>]*\/>/gi;
    let actionMatch: RegExpExecArray | null;
    while ((actionMatch = actionRegex.exec(content)) !== null) {
        const start = actionMatch.index;
        const end = start + actionMatch[0].length;
        consider(start, end);
    }

    return best;
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

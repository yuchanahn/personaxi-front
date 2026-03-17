import type { Message } from "$lib/stores/messages";
import { get } from "svelte/store";
import { t } from "svelte-i18n";
import type { Persona } from "$lib/types";
import {
    extractAstrologyInputFromSystemInput,
    type AstroChartInput,
} from "$lib/components/astrology/astrologyPrompt";
import {
    extractSajuInputFromSystemInput,
    type SajuChartInput,
} from "$lib/components/saju/sajuPrompt";
import type { Chat2DBlock, Chat2DParseContext } from "./types";
import { INCOMPLETE_DIALOGUE_SENTINEL } from "./stream-assembler";

const CODE_BLOCK_REGEX = /```(?<lang>\w*)\s*\n?(?<code>[\s\S]+?)\s*```/;
const ALL_TAGS_REGEX =
    /<((?:say|dialogue)) speaker="([^"]+)">([\s\S]*?)<\/(?:say|dialogue)>|<(img) (\d+)>|<(Action) type="([^"]+)" question="([^"]+)" variable="([^"]+)"(?: max="(\d+)")? \/>|!\[(.*?)\]\((.*?)\)/g;
const FIRST_SCENE_TAG_REGEX = /<first_scene>/g;
const VARS_TAG_REGEX = /(?:\s*)<vars\b[^>]*>[\s\S]*?<\/vars>(?:\s*)/gi;

export function parseChat2DMessages(
    messages: Message[],
    context: Chat2DParseContext,
    options?: {
        showVariableStatus?: boolean;
        revealVariableStatus?: boolean;
    },
): Chat2DBlock[] {
    const blocks: Chat2DBlock[] = [];

    messages.forEach((msg, i) => {
        const messageId = msg.key ? `msg-${msg.key}` : `msg-${i}`;

        if (msg.role === "user") {
            if (/<system-input>[\s\S]*?<\/system-input>/g.test(msg.content)) {
                blocks.push({
                    type: "user-interaction",
                    content:
                        get(t)("chatWindow.selectionComplete") || "선택 완료",
                    id: messageId,
                });
                const astroInput = extractAstrologyInputFromSystemInput(
                    msg.content,
                );
                if (astroInput) {
                    blocks.push({
                        type: "astro_chart",
                        id: `${messageId}-astro`,
                        input: astroInput as AstroChartInput as Record<
                            string,
                            unknown
                        >,
                    });
                }
                const sajuInput = extractSajuInputFromSystemInput(msg.content);
                if (sajuInput) {
                    blocks.push({
                        type: "saju_chart",
                        id: `${messageId}-saju`,
                        input: sajuInput as SajuChartInput as Record<
                            string,
                            unknown
                        >,
                    });
                }
            } else {
                blocks.push({
                    type: "user",
                    content: msg.content,
                    id: messageId,
                });
            }
            return;
        }

        blocks.push(...parseAssistantContent(msg.content, messageId, context));

        if (
            isLastAssistantMessage(messages, i) &&
            options?.showVariableStatus &&
            options?.revealVariableStatus &&
            context.persona?.status_template &&
            context.persona?.variables?.length
        ) {
            blocks.push({
                type: "vars_status",
                id: `${messageId}-vars`,
                variables: extractVarsUpToIndex(messages, i, context.persona),
            });
        }

        const isLast = i === messages.length - 1;
        if (
            isLast &&
            context.persona?.personaType === "2D" &&
            messages.length > 1
        ) {
            blocks.push({
                type: "situation_trigger",
                id: `${messageId}-trigger`,
            });
        }
    });

    return blocks;
}

function isLastAssistantMessage(messages: Message[], index: number): boolean {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].role === "assistant") {
            return i === index;
        }
    }

    return false;
}

function parseAssistantContent(
    content: string,
    baseId: string,
    context: Chat2DParseContext,
): Chat2DBlock[] {
    const processedContent = content
        .replace(VARS_TAG_REGEX, "")
        .replace(FIRST_SCENE_TAG_REGEX, () => {
            if (context.persona?.first_scene) {
                return replacePlaceholders(context.persona.first_scene, context);
            }
            return "";
        })
        .trim();

    const parts = processedContent.split(CODE_BLOCK_REGEX);
    const blocks: Chat2DBlock[] = [];
    let partIndex = 0;

    parts.forEach((part, i) => {
        if (!part) return;

        const isCodeBlock = i % 3 === 2;
        if (isCodeBlock) {
            const lang = parts[i - 1] || "";
            blocks.push({
                type: "code",
                language: lang,
                content: part,
                id: `${baseId}-code-${partIndex++}`,
            });
            return;
        }

        if (!part.trim()) return;

        const textPart = part.trim();
        const partId = `${baseId}-part-${partIndex}`;
        let subPartIndex = 0;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = ALL_TAGS_REGEX.exec(textPart)) !== null) {
            const narrationContent = textPart
                .substring(lastIndex, match.index)
                .trim();

            if (narrationContent) {
                blocks.push({
                    type: "narration",
                    content: replacePlaceholders(narrationContent, context),
                    id: `${partId}-n-${subPartIndex++}`,
                });
            }

            const [fullMatch] = match;

            if (
                fullMatch.startsWith("<dialogue") ||
                fullMatch.startsWith("<say")
            ) {
                const m = fullMatch.match(
                    /speaker="([^"]+)">([\s\S]*?)<\/(?:say|dialogue)>/,
                );
                if (m) {
                    const rawDialogueContent = replacePlaceholders(
                        m[2].trim(),
                        context,
                    );
                    const isIncompleteDialogue = rawDialogueContent.includes(
                        INCOMPLETE_DIALOGUE_SENTINEL,
                    );
                    const cleanedDialogueContent = rawDialogueContent.replaceAll(
                        INCOMPLETE_DIALOGUE_SENTINEL,
                        "",
                    ).trim();

                    if (
                        !cleanedDialogueContent ||
                        (isIncompleteDialogue &&
                            cleanedDialogueContent.length < 1)
                    ) {
                        lastIndex = match.index + fullMatch.length;
                        continue;
                    }

                    blocks.push({
                        type: "dialogue",
                        speaker: replacePlaceholders(m[1], context),
                        content: cleanedDialogueContent,
                        id: `${partId}-d-${subPartIndex++}`,
                    });
                }
            } else if (fullMatch.startsWith("<img")) {
                const m = fullMatch.match(/<img (\d+)>/);
                if (m) {
                    const imgIndex = parseInt(m[1], 10);
                    const imageMetadata =
                        context.persona?.image_metadatas?.[imgIndex];
                    if (imageMetadata && !Number.isNaN(imgIndex)) {
                        blocks.push({
                            type: "image",
                            url: imageMetadata.url || "",
                            alt: imageMetadata.description || "scene image",
                            metadata: imageMetadata,
                            id: `${partId}-img-${subPartIndex++}`,
                            index: imgIndex,
                        });
                    }
                }
            } else if (fullMatch.startsWith("<Action")) {
                const m = fullMatch.match(
                    /type="([^"]+)" question="([^"]+)" variable="([^"]+)"(?: max="(\d+)")?/,
                );
                if (m) {
                    blocks.push({
                        type: "input_prompt",
                        id: `${partId}-action-${subPartIndex++}`,
                        prompt_type: m[1],
                        question: m[2],
                        variable: m[3],
                        max: m[4] ? parseInt(m[4], 10) : null,
                    });
                }
            } else if (fullMatch.startsWith("![")) {
                const m = fullMatch.match(/!\[(.*?)\]\((.*?)\)/);
                if (m) {
                    blocks.push({
                        type: "markdown_image",
                        alt: m[1],
                        url: m[2],
                        id: `${partId}-md-img-${subPartIndex++}`,
                    });
                }
            }

            lastIndex = match.index + fullMatch.length;
        }

        const remainingNarration = textPart.substring(lastIndex).trim();
        if (remainingNarration) {
            blocks.push({
                type: "narration",
                content: replacePlaceholders(remainingNarration, context),
                id: `${partId}-n-${subPartIndex++}`,
            });
        }

        partIndex += 1;
    });

    return blocks;
}

function replacePlaceholders(
    text: string,
    context: Chat2DParseContext,
): string {
    return text
        .replaceAll("{{user}}", context.userName || "User")
        .replaceAll("{{char}}", context.persona?.name || "Character");
}

function extractVarsUpToIndex(
    msgs: Message[],
    upTo: number,
    persona: Persona | null,
): Record<string, string> {
    const state: Record<string, string> = {};
    if (persona?.variables) {
        for (const v of persona.variables) {
            state[v.name] = v.default_value;
        }
    }

    for (let j = 0; j <= upTo && j < msgs.length; j += 1) {
        const msg = msgs[j];
        if (msg.role !== "assistant") continue;
        const matches = msg.content.matchAll(/<vars>([\s\S]*?)<\/vars>/g);
        for (const match of matches) {
            const body = match[1].trim();
            for (const line of body.split("\n")) {
                const eq = line.indexOf("=");
                if (eq > 0) {
                    state[line.slice(0, eq).trim()] = line
                        .slice(eq + 1)
                        .trim();
                }
            }
        }
    }

    return state;
}

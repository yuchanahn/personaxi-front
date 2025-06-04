import { goto } from "$app/navigation";
import { impl_sendPromptStream } from "$lib/api/chat";
import { loadCharacterSessions, loadChatSessions } from "$lib/api/sessions";
import { messages } from "$lib/stores/messages";
import type { Model } from "$lib/vrm/core/model";

export function extractExpressionTags(text: string): string[] {
    const matches = text.matchAll(/<emo:([a-zA-Z_]+)>/g);
    const result: string[] = [];
    for (const match of matches) {
        if (match[1]) result.push(match[1]);
    }
    return result;
}

export function extractActionTags(text: string): string[] {
    const matches = text.matchAll(/<act:([a-zA-Z_]+)>/g);
    const result: string[] = [];
    for (const match of matches) {
        if (match[1]) result.push(match[1]);
    }
    return result;
}


export async function handleSendToCharacter(cid: string, prompt: string, model?: Model) {
    if (!prompt.trim()) return;

    messages.update(m => [...m, { role: 'user', content: prompt }]);

    let aiText = ""; // 초기화

    await impl_sendPromptStream(
        prompt,
        cid ?? "",
        (data: string) => {
            aiText += data;
            messages.update(m => {

                let tags = extractExpressionTags(aiText)
                let tags2 = extractActionTags(aiText)

                if (tags.length > 0) {
                    aiText = aiText.replace(/<emo:([a-zA-Z_]+)>/g, "")
                    model?.Emotion(tags[0]);
                }

                if (tags2.length > 0) {
                    aiText = aiText.replace(/<act:([a-zA-Z_]+)>/g, "")
                }

                const last = m.at(-1);
                return last?.role === "assistant"
                    ? [...m.slice(0, -1), { role: "assistant", content: aiText }]
                    : [...m, { role: "assistant", content: aiText }];
            });
        },
        (cssid: string) => {
            loadChatSessions();
            loadCharacterSessions();
            goto(`/personaxi-front/character?c=${cssid}`);
        },
        "character"
    );
}
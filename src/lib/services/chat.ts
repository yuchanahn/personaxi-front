import { goto } from "$app/navigation";
import { impl_sendPromptStream } from "$lib/api/chat";
import { loadCharacterSessions } from "$lib/api/sessions";
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
    const matches = text.matchAll(/\[(.*?)\]/g);
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

            //데이터가 json 형식으로 올 경우
            if (data.startsWith("{") && data.endsWith("}")) {
                try {
                    const jsonData = JSON.parse(data);
                    if (jsonData.text) {
                        data = jsonData.text;
                    }
                    if (jsonData.predictions) {
                        const p = JSON.parse("[" + jsonData.predictions[0] + "]")
                        console.log("Emotion data received: ", p);
                        model?.Emotion(p[0].key, p[0].value);
                    }
                } catch (e) {
                    console.error("JSON 파싱 오류:", e);
                }

                return; // JSON 데이터는 처리하지 않고 넘어감
            }

            aiText += data;
            messages.update(m => {

                let tags = extractExpressionTags(aiText)
                let tags2 = extractActionTags(aiText)

                if (tags.length > 0) {
                    aiText = aiText.replace(/<emo:([a-zA-Z_]+)>/g, "")
                    model?.Emotion(tags[0]);
                }

                if (tags2.length > 0) {
                    console.log("🔥 [Animation Detected]:", tags2);
                    aiText = aiText.replace(/\[(.*?)\]/g, "")
                    tags2.forEach(tag => {
                        console.log("➡️ Triggering gesture:", tag);
                        model?.doGesture(tag)
                    });
                }

                const last = m.at(-1);
                return last?.role === "assistant"
                    ? [...m.slice(0, -1), { role: "assistant", content: aiText }]
                    : [...m, { role: "assistant", content: aiText }];
            });
        },
        (cssid: string) => {
            loadCharacterSessions();
            goto(`/character?c=${cssid}`);
        },
        "3d"
    );

    // Mark the last assistant message as done
    messages.update((m) => {
        const updated = [...m];
        const last = updated.at(-1);
        if (last?.role === 'assistant') last.done = true;
        return updated;
    });
}
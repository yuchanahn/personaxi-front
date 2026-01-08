import { messages, type Message } from '$lib/stores/messages';
import { tickSSEStream, extractCSSID, tickSSEStream2 } from '$lib/parser/sseParser';
import { loadCharacterSessions } from './sessions';
import { goto } from '$app/navigation';
import { api } from '$lib/api';
import { showNeedMoreNeuronsModal } from '$lib/stores/modal';
import { get } from 'svelte/store';


/**
 * Parse ESFPrompt JSON response to extract character's thoughts and speech
 * Supports both NEW 3-stage format and OLD format for backward compatibility
 */
function parseESFResponse(content: string): string {
    try {
        const json = JSON.parse(content);

        console.log("ESFPrompt JSON:", json);

        // NEW 3-Stage Format (perception → speech → reflection)
        if (json.perception_analysis || json.internal_monologue_reflection) {
            const analysis = json.perception_analysis
                ? `*(분석: ${json.perception_analysis})*\n`
                : '';

            const speech = json.speech_text
                ? `<dialogue speaker="${json.speaker || 'Character'}">${json.speech_text}</dialogue>\n`
                : '';

            const reflection = json.internal_monologue_reflection
                ? `*(${json.internal_monologue_reflection})*`
                : '';

            return analysis + speech + reflection;
        }

        const thoughts = json.internal_monologue ? `(${json.internal_monologue})\n` : '';
        const speech = json.speech_text ? `<dialogue speaker="${json.speaker || 'Character'}">${json.speech_text}</dialogue>` : '';
        return thoughts + speech;

    } catch (e) {
        // Not JSON or parsing failed, return original content
        return content;
    }
}

export async function loadChatHistory(sessionId: string) {
    const res = await api.get(`/api/chat/history?CSSID=${sessionId}`);
    if (res.ok) {
        const history = await res.json();

        if (history === null) {

            messages.set([{ role: "assistant", content: "<first_scene>" }]);
            console.warn("No chat history found for session:", sessionId);
            return;
        }
        // Initialize Affection Score from last assistant message
        const lastAssistantMsg = [...history].reverse().find((m: any) => m.role === 'assistant');
        if (lastAssistantMsg) {
            try {
                const json = JSON.parse(lastAssistantMsg.content);
                if (typeof json.affection_score === 'number') {
                    console.log("💕 Initialize Affection Score:", json.affection_score);
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('affection-update', {
                            detail: { score: json.affection_score }
                        }));
                    }
                }
            } catch (e) {
                // Ignore parse errors for legacy text messages
            }
        }

        messages.set(
            [
                { role: "assistant", content: "<first_scene>" },
                ...history.map((msg: any) => ({
                    role: msg.role,
                    content: msg.role === 'assistant' ? parseESFResponse(msg.content) : msg.content
                }))
            ]
        );
    } else {
        messages.set([{ role: "assistant", content: "<first_scene>" }]);
    }
}

export async function resetChatHistory(sessionId: string) {
    if (get(messages).length <= 1) {
        console.log("No chat history to reset");
        return;
    }

    const res = await api.get(`/api/chat/reset?CSSID=${sessionId}`);
    if (res.ok) {
        const r = await res.json();
        console.log("Reset chat history response:", r);
        messages.set([{ role: "assistant", content: "<first_scene>" }]);
    } else {
        messages.set([{ role: "assistant", content: "<first_scene>" }]);
    }
}

export async function deleteChatHistory(sessionId: string) {
    const res = await api.get(`/api/chat/delete?CSSID=${sessionId}`);
    if (res.ok) {
        console.log("Deleting chat history for session:", sessionId);

        const r = await res.json();
        console.log("Delete chat history response:", r);
        messages.set([]);
        await loadCharacterSessions();
        goto(`/hub`);

        //messages.set(history.map((msg: any) => ({ role: msg.role, content: msg.content })));
    }
}




export async function sendPromptStream(cid: string, prompt: string, type?: string, onDone?: () => void, onEmotion?: (emotion: string) => void) {
    if (!prompt.trim()) return;
    messages.update((m) => [...m, { role: 'user', content: prompt }]);

    let aiText = "";

    if (cid === "1" || cid === null) {
        cid = "";
    }

    impl_sendPromptStream(prompt, cid, (data) => {
        // Check if data is emotion JSON
        try {
            const trimmed = data.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                const json = JSON.parse(trimmed);

                if (json.predictions && Array.isArray(json.predictions) && json.predictions.length > 0) {
                    // Logic copied from services/chat.ts
                    // The backend sends a string of comma-separated JSON objects, so we wrap it in []
                    const p = JSON.parse("[" + json.predictions[0] + "]");

                    if (Array.isArray(p) && p.length > 0) {
                        // Find the emotion with the highest value
                        const dominant = p.reduce((prev: any, current: any) => (prev.value > current.value) ? prev : current);
                        if (dominant && dominant.key) {
                            console.log("Emotion detected:", dominant.key);
                            onEmotion?.(dominant.key);
                        }
                    }
                    return; // Don't append to text
                }
            }
        } catch (e) {
            // Not JSON or parsing failed, treat as text
        }

        aiText += data;

        messages.update((m) => {
            const last = m.at(-1);
            return last?.role === "assistant"
                ? [...m.slice(0, -1), { role: "assistant", content: aiText }]
                : [...m, { role: "assistant", content: aiText }];
        });
    }, (cssid) => {
        if (cssid) {
            loadCharacterSessions();
            if (type == "character" || type == "2d" || type == "3d") {
                goto(`/2d?c=${cssid}`);
            }
            else if (type == "live2d") {
                goto(`/live2d?c=${cssid}`);
            }
            else {
                goto(`/chat?c=${cssid}`);
            }
        }
    }, type).then(() => {
        onDone?.();
        console.log(aiText)
    });
}

export async function impl_sendPromptStream(
    prompt: string,
    currentSessionId: string,
    onData: (data: string) => void,
    onCSSID?: (cssid: string) => void,
    type?: string,
): Promise<void> {
    if (!prompt.trim()) return;

    const body = {
        prompt,
        CSSID: currentSessionId,
        type: type ?? "chat",
    };
    //HandleLLMChat
    const response = await api.post(`/api/chat/${type ?? "2d"}`, body);

    if (response.status === 402) {
        showNeedMoreNeuronsModal()

        console.log("showNeedMoreNeuronsModal()")
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
        const { events, done } = await tickSSEStream2(reader, decoder, { buffer });

        for (const event of events) {
            if (event.type === 'affection') {
                // Handle affection update
                try {
                    const affectionData = JSON.parse(event.data);
                    console.log("💕 Affection Update:", affectionData);
                    // Dispatch custom event for UI to pick up
                    window.dispatchEvent(new CustomEvent('affection-update', { detail: affectionData }));
                } catch (e) {
                    console.error("Failed to parse affection data", e);
                }
            } else if (event.type === 'data') {
                const rt = event.data;
                const cssid = extractCSSID(rt);
                if (cssid) {
                    onCSSID?.(cssid);
                } else {
                    onData(rt);
                }
            }
        }

        if (done) break;
    }

}

import { messages } from '$lib/stores/messages';
import { currentSessionId } from '$lib/stores/chatSessions';
import { tickSSEStream, extractCSSID } from '$lib/parser/sseParser';
import { loadChatSessions } from './sessions';
import { get } from 'svelte/store';

export async function loadChatHistory() {
    const res = await fetch(`http://localhost:8080/api/chat/history?CSSID=${get(currentSessionId)}`, {
        credentials: 'include'
    });
    if (res.ok) {
        const history = await res.json();
        messages.set(history.map((msg: any) => ({ role: msg.role, content: msg.content })));
    } else {
        messages.set([{ role: 'assistant', content: '질문을 입력하세요.' }]);
    }
}

export async function sendPromptStream(prompt: string) {
    if (!prompt.trim()) return;
    messages.update((m) => [...m, { role: 'user', content: prompt }]);

    const response = await fetch("http://localhost:8080/api/ChatLLM", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            prompt,
            CSSID: (get(currentSessionId) === "1" ? "" : get(currentSessionId)) || ""
        })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let aiText = "";

    while (true) {
        const { rt, done } = await tickSSEStream(reader, decoder, { buffer });
        if (done) break;

        let cssid = extractCSSID(rt);
        if (cssid) {
            currentSessionId.set(cssid);

            console.log("CSSID:", cssid);

            loadChatSessions();
            continue
        }

        aiText += rt;

        messages.update((m) => {
            const last = m.at(-1);
            return last?.role === "assistant"
                ? [...m.slice(0, -1), { role: "assistant", content: aiText }]
                : [...m, { role: "assistant", content: aiText }];
        });
    }
}
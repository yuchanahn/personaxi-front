import { messages, type Message } from '$lib/stores/messages';
import { tickSSEStream, extractCSSID, tickSSEStream2 } from '$lib/parser/sseParser';
import { loadCharacterSessions } from './sessions';
import { goto } from '$app/navigation';
import { api } from '$lib/api';
import { showNeedMoreNeuronsModal } from '$lib/stores/modal';


export async function loadChatHistory(sessionId: string) {
    const res = await api.get(`/api/chat/history?CSSID=${sessionId}`);
    if (res.ok) {
        const history = await res.json();

        if (history === null) {

            messages.set([{ role: "assistant", content: "<first_scene>" }]);
            console.warn("No chat history found for session:", sessionId);
            return;
        }
        messages.set(
            [{ role: "assistant", content: "<first_scene>" }, ...history.map((msg: any) => ({ role: msg.role, content: msg.content }))]
        );
    } else {
        messages.set([{ role: "assistant", content: "<first_scene>" }]);
    }
}

export async function resetChatHistory(sessionId: string) {
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




export async function sendPromptStream(cid: string, prompt: string, type?: string, onDone?: () => void) {
    if (!prompt.trim()) return;
    messages.update((m) => [...m, { role: 'user', content: prompt }]);

    let aiText = "";

    if (cid === "1" || cid === null) {
        cid = "";
    }

    impl_sendPromptStream(prompt, cid, (data) => {
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
            } else {
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
        const { rts, done } = await tickSSEStream2(reader, decoder, { buffer });

        for (const rt of rts) {
            const cssid = extractCSSID(rt);
            if (cssid) {
                onCSSID?.(cssid);
            } else {
                onData(rt);
            }
        }

        if (done) break;
    }

}

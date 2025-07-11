import { messages, type Message } from '$lib/stores/messages';
import { tickSSEStream, extractCSSID } from '$lib/parser/sseParser';
import { loadCharacterSessions, loadChatSessions } from './sessions';
import { get, type Writable } from 'svelte/store';
import { goto } from '$app/navigation';
import { API_BASE_URL } from '$lib/constants';
import { showNeedMoreNeuronsModal } from '$lib/stores/modal';


export async function loadChatHistory(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/api/chat/history?CSSID=${sessionId}`, {
        credentials: 'include'
    });
    if (res.ok) {
        const history = await res.json();
        if (history === null) {
            messages.set([]);
            console.warn("No chat history found for session:", sessionId);
            return;
        }
        messages.set(history.map((msg: any) => ({ role: msg.role, content: msg.content })));
    } else {
        messages.set([]);
    }
}

export async function resetChatHistory(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/api/chat/reset?CSSID=${sessionId}`, {
        credentials: 'include'
    });
    if (res.ok) {
        const r = await res.json();
        messages.set([]);
        //messages.set(history.map((msg: any) => ({ role: msg.role, content: msg.content })));
    } else {
        messages.set([]);
    }
}

export async function deleteChatHistory(sessionId: string) {
    const res = await fetch(`${API_BASE_URL}/api/chat/delete?CSSID=${sessionId}`, {
        credentials: 'include'
    });
    if (res.ok) {
        const r = await res.json();

        goto(`/hub`);

        loadChatSessions();
        loadCharacterSessions();
        //messages.set(history.map((msg: any) => ({ role: msg.role, content: msg.content })));
    }
}




export async function sendPromptStream(cid: string, prompt: string, type?: string) {
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
            loadChatSessions();
            loadCharacterSessions();
            if (type == "character") {
                goto(`/2d?c=${cssid}`);
            } else {
                goto(`/chat?c=${cssid}`);
            }
        }
    }, type)
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

    const response = await fetch(`${API_BASE_URL}/api/ChatLLM`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
    });

    if (response.status === 402) {
        showNeedMoreNeuronsModal()

        console.log("showNeedMoreNeuronsModal()")
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
        const { rts, done } = await tickSSEStream(reader, decoder, { buffer });

        for (const rt of rts) {
            const cssid = extractCSSID(rt);
            if (cssid) {
                onCSSID?.(cssid);
            } else {
                onData(rt);
                console.log("data: ", rt);
            }
        }

        if (done) break;
    }

}

export function extractCSSID(raw: string): string | null {
    const match = raw.match(/CSSID: (.+)/);
    return match ? match[1].trim() : null;
}

export async function tickSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array> | undefined,
    decoder: TextDecoder,
    bufferRef: { buffer: string }
): Promise<{ rt: any | null; done: boolean }> {
    if (!reader) {
        console.error('tickSSEStream: reader가 정의되지 않음');
        return { rt: null, done: true };
    }

    const { value, done } = await reader.read();
    if (done) return { rt: null, done: true };

    bufferRef.buffer += decoder.decode(value, { stream: true });

    const events = bufferRef.buffer.split('\n\n');
    bufferRef.buffer = events.pop() || ''; 

    for (const event of events) {
        const dataLines = event
            .split('\n')
            .filter(line => line.startsWith('data: '))
            .map(line => line.slice(6)); 

        const raw = dataLines.join('\n'); 
        if (raw === '[DONE]') return { rt: null, done: true };

        try {
            return { rt: raw.replace(/\\n/g, '\n'), done: false };
        } catch (err) {
            console.error('tickSSEStream JSON 파싱 실패:', raw);
            return { rt: null, done: false };
        }
    }

    return { rt: null, done: false };
}
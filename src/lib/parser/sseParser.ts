export function extractCSSID(raw: string | null | undefined): string | null {
    if (!raw) return null;

    const match = raw.match(/CSSID: (.+)/);
    return match ? match[1].trim() : null;
}


export async function tickSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array> | undefined,
    decoder: TextDecoder,
    bufferRef: { buffer: string }
): Promise<{ rts: string[]; done: boolean }> {
    if (!reader) {
        console.error('tickSSEStream: reader가 정의되지 않음');
        return { rts: [], done: true };
    }

    const { value, done } = await reader.read();
    if (done) {
        return { rts: [], done: true };
    }

    bufferRef.buffer += decoder.decode(value, { stream: true });

    const events = bufferRef.buffer.split('\n\n');
    bufferRef.buffer = events.pop() || '';

    const rts: string[] = [];

    for (const event of events) {
        const dataLines = event
            .split('\n')
            .filter(line => line.startsWith('data: '))
            .map(line => line.slice(6));

        const raw = dataLines.join('\n');
        if (raw === '[DONE]') return { rts, done: true };

        rts.push(raw.replace(/\\n/g, '\n'));
    }

    return { rts, done: false };
}

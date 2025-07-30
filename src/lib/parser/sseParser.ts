import { createParser, type EventSourceMessage } from 'eventsource-parser';

export function extractCSSID(raw: string | null | undefined): string | null {
    if (!raw) return null;

    const match = raw.match(/CSSID: (.+)/);
    return match ? match[1].trim() : null;
}


export async function tickSSEStream2(
    reader: ReadableStreamDefaultReader<Uint8Array> | undefined,
    decoder: TextDecoder,
    bufferRef: { buffer: string }
): Promise<{ rts: string[]; done: boolean }> {
    if (!reader) {
        console.error('tickSSEStream: reader가 정의되지 않음');
        return { rts: [], done: true };
    }

    let chat = "";

    const { value, done } = await reader.read();
    if (done) {
        console.log("DONE: ", chat)
        return { rts: [], done: true };
    }

    bufferRef.buffer += decoder.decode(value, { stream: true });

    const events = bufferRef.buffer.split('\n\n');
    bufferRef.buffer = events.pop() || '';

    const rts: string[] = [];

    for (const event of events) {
        //if (!event.startsWith('data: ')) {
        chat += event;
        //}
        const dataLines = event
            .split('\n')
            .filter(line => line.startsWith('data: '))
            .map(line => line.slice(6));

        const raw = dataLines.join('\n');
        if (raw === '[DONE]') {
            return { rts, done: true };
        }
        rts.push(raw.replace(/\\n/g, '\n'));
    }

    return { rts, done: false };
}

export async function tickSSEStream(
    reader?: ReadableStreamDefaultReader<Uint8Array>
): Promise<{ rts: string[]; done: boolean }> {
    if (!reader) {
        return { rts: [], done: true };
    }

    const decoder = new TextDecoder();
    let done = false;
    const rts: string[] = [];

    let fullText = '';
    let lastChar = '';

    // 단어 경계에 공백이 필요한지 판단해 병합
    function smartAppend(chunk: string) {
        const firstChar = chunk.charAt(0) || '';
        const needSpace =
            /\p{L}/u.test(lastChar) &&
            /\p{L}/u.test(firstChar) &&
            !/\s/.test(lastChar) &&
            !/\s/.test(firstChar);

        fullText += needSpace ? ' ' + chunk : chunk;
        lastChar = fullText.slice(-1);
    }

    const parser = createParser({
        onEvent(event: EventSourceMessage) {
            if (event.data === '[DONE]') {
                done = true;
            } else {
                rts.push(event.data);
                smartAppend(event.data);
            }
        },
        onRetry(retryMs) {
            console.warn(`서버 요청 재시도 대기: ${retryMs}ms`);
        },
        onError(err) {
            console.error('파싱 오류:', err);
        }
    });

    // 스트림 읽기 및 파싱
    while (!done) {
        const { value, done: streamDone } = await reader.read();
        done ||= streamDone;
        const chunk = decoder.decode(value ?? new Uint8Array(), { stream: !done });
        parser.feed(chunk);
    }

    // 서버가 '\\n' 형태로 보냈다면 실제 개행 문자로 변환
    fullText = fullText.replace(/\\n/g, '\n');
    console.log('## data: ', fullText);

    return { rts, done };
}

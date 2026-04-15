export type ChatDeltaChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

type ConsumeSseStreamOptions = {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  shouldStop?: () => boolean;
  onChunk?: (chunk: Uint8Array) => void;
  onDelta?: (delta: string) => void;
};

export type ConsumeSseStreamStatus = 'completed' | 'stopped';

export function splitSseLines(
  buffer: string,
  chunkText: string,
): {
  lines: string[];
  rest: string;
} {
  const merged = buffer + chunkText;
  const allLines = merged.split(/\r?\n/);

  return {
    lines: allLines.slice(0, -1),
    rest: allLines.at(-1) ?? '',
  };
}

export function getSseDataPayload(line: string): string | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  if (line === 'data: [DONE]') {
    return null;
  }

  const raw = line.slice(6).trim();
  return raw || null;
}

export function extractAssistantDelta(rawPayload: string): string | null {
  try {
    const chunk = JSON.parse(rawPayload) as ChatDeltaChunk;
    const delta = chunk.choices?.[0]?.delta?.content;

    return delta || null;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

export async function consumeSseStream(
  options: ConsumeSseStreamOptions,
): Promise<ConsumeSseStreamStatus> {
  const { reader, shouldStop, onChunk, onDelta } = options;
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    if (shouldStop?.()) {
      return 'stopped';
    }

    const { done, value } = await reader.read();
    if (done) {
      return 'completed';
    }

    if (!value) {
      continue;
    }

    onChunk?.(value);

    const splitResult = splitSseLines(
      buffer,
      decoder.decode(value, { stream: true }),
    );
    buffer = splitResult.rest;

    for (const line of splitResult.lines) {
      if (shouldStop?.()) {
        return 'stopped';
      }

      const payload = getSseDataPayload(line);
      if (!payload) {
        continue;
      }

      const delta = extractAssistantDelta(payload);
      if (delta) {
        onDelta?.(delta);
      }
    }
  }
}

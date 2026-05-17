/**
 * 本文件封装聊天 SSE 数据解析与流式消费工具。
 */
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

/**
 * 合并上一轮未完成文本和当前 chunk，并按 SSE 行切分。
 *
 * @param buffer 上一次读取后剩余的半行文本。
 * @param chunkText 当前读取到的文本片段。
 * @returns 已完整到达的行列表，以及需要留到下一轮拼接的剩余文本。
 */
export function splitSseLines(
  buffer: string,
  chunkText: string,
): {
  lines: string[];
  rest: string;
} {
  // SSE chunk 可能截在半行中间，所以把上一轮 rest 拼回来再切行。
  const merged = buffer + chunkText;
  const allLines = merged.split(/\r?\n/);

  return {
    // 最后一段可能还没收到换行，留到下一次 reader.read() 后继续拼接。
    lines: allLines.slice(0, -1),
    rest: allLines.at(-1) ?? '',
  };
}

/**
 * 从 SSE 行中提取 data payload。
 *
 * 非 `data: ` 行和结束标记 `[DONE]` 会被忽略。
 *
 * @param line 单行 SSE 文本。
 * @returns 可解析的 payload 字符串；无有效数据时返回 `null`。
 */
export function getSseDataPayload(line: string): string | null {
  // SSE 里只有 data 行承载模型 payload，event/id 等其它行直接忽略。
  if (!line.startsWith('data: ')) {
    return null;
  }

  // 上游用 [DONE] 表示流结束，不需要继续 JSON.parse。
  if (line === 'data: [DONE]') {
    return null;
  }

  const raw = line.slice(6).trim();
  return raw || null;
}

/**
 * 从模型流式响应 payload 中提取 assistant 增量文本。
 *
 * @param rawPayload SSE data 中的原始 JSON 字符串。
 * @returns assistant 的文本增量；payload 无文本或 JSON 无效时返回 `null`。
 */
export function extractAssistantDelta(rawPayload: string): string | null {
  try {
    // SiliconFlow/OpenAI 风格流式响应把文本放在 choices[0].delta.content。
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

/**
 * 消费模型 SSE 字节流。
 *
 * 调用方可以通过 `onChunk` 原样转发上游 chunk，通过 `onDelta` 接收解析出的
 * assistant 文本增量，并通过 `shouldStop` 在请求失效时提前停止消费。
 *
 * @param options SSE 消费选项。
 * @returns 流正常结束时返回 `completed`，被外部停止时返回 `stopped`。
 */
export async function consumeSseStream(
  options: ConsumeSseStreamOptions,
): Promise<ConsumeSseStreamStatus> {
  // reader 负责读取字节流，回调分别用于原样转发 chunk 和消费解析后的文本增量。
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

    // 原始 chunk 先交给调用方，服务端路由可以不等待解析就转发给浏览器。
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

      // 每一行先提取 data，再从 JSON payload 中取出 assistant 新增文本。
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

import { z } from 'zod';

import { consumeSseStream } from '@/lib/chat-sse';
import {
  createJsonError,
  createUnauthorizedResponse,
  requireCurrentUserId,
} from '@/server/auth/utils';
import { conversationRepository } from '@/server/repositories/conversation.repository';
import { messageRepository } from '@/server/repositories/message.repository';
import { userRepository } from '@/server/repositories/user.repository';
import {
  DEFAULT_SILICONFLOW_BASE_URL,
  joinSiliconFlowUrl,
} from '@/lib/siliconflow-voice';

export const runtime = 'nodejs';

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z
    .string()
    .trim()
    .min(1, '消息内容不能为空')
    .max(20000, '消息内容过长'),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1, '至少需要一条消息'),
  conversationId: z.string().trim().min(1, '会话 ID 不合法').optional(),
  title: z
    .string()
    .trim()
    .min(1, '标题不能为空')
    .max(120, '标题不能超过 120 个字符')
    .optional(),
});

const CHAT_MODEL = 'Qwen/Qwen3-8B';

function resolveConversationTitle(
  title: string | undefined,
  fallback: string,
): string {
  if (title?.trim()) {
    return title.trim();
  }

  const normalizedFallback = fallback.trim();
  if (!normalizedFallback) {
    return '新对话';
  }

  return normalizedFallback.slice(0, 40);
}

export async function POST(req: Request) {
  try {
    const userId = await requireCurrentUserId(req);
    const user = await userRepository.findById(userId);

    if (!user) {
      return createUnauthorizedResponse('会话已失效，请重新登录');
    }

    const parsed = chatRequestSchema.safeParse(
      await req.json().catch(() => null),
    );

    if (!parsed.success) {
      return createJsonError(
        '请求参数不合法',
        400,
        parsed.error.issues[0]?.message || '请检查消息参数',
      );
    }

    const apiKey = user.siliconflowApiKey?.trim();
    if (!apiKey) {
      return createJsonError(
        '未配置硅基流动 API Key，请先保存后再发送消息',
        400,
      );
    }

    const { conversationId: rawConversationId, messages, title } = parsed.data;
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user');

    if (!latestUserMessage) {
      return createJsonError('请求参数不合法', 400, '至少需要一条 user 消息');
    }

    let conversationId = rawConversationId;
    if (conversationId) {
      const existingConversation = await conversationRepository.findOwnedIdOnly(
        userId,
        conversationId,
      );

      if (!existingConversation) {
        return createJsonError('会话不存在', 404);
      }
    } else {
      const conversation = await conversationRepository.createForUser(
        userId,
        resolveConversationTitle(title, latestUserMessage.content),
      );
      conversationId = conversation.id;
    }

    await messageRepository.create({
      conversationId,
      role: 'user',
      content: latestUserMessage.content,
    });
    await conversationRepository.touch(conversationId);

    const upstreamResponse = await fetch(
      joinSiliconFlowUrl(
        process.env.SILICONFLOW_BASE_URL?.trim() ||
          DEFAULT_SILICONFLOW_BASE_URL,
        '/chat/completions',
      ),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: CHAT_MODEL,
          messages,
          stream: true,
        }),
        signal: req.signal,
      },
    );

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      return createJsonError(
        '上游模型调用失败',
        502,
        `status=${upstreamResponse.status}; ${errorText || 'empty response body'}`,
      );
    }

    if (!upstreamResponse.body) {
      return createJsonError('上游模型响应异常', 502, '未收到可读流');
    }

    const upstreamReader = upstreamResponse.body.getReader();
    const encoder = new TextEncoder();
    let assistantContent = '';

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ conversationId })}\n\n`),
          );

          await consumeSseStream({
            reader: upstreamReader,
            onChunk: (chunk) => {
              controller.enqueue(chunk);
            },
            onDelta: (delta) => {
              assistantContent += delta;
            },
          });

          if (assistantContent.trim()) {
            await messageRepository.create({
              conversationId,
              role: 'assistant',
              content: assistantContent,
            });
            await conversationRepository.touch(conversationId);
          }

          controller.close();
        } catch (error) {
          console.error('Chat Stream Error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: '上游流式响应中断，请稍后重试' })}\n\n`,
            ),
          );
          controller.close();
        } finally {
          upstreamReader.releaseLock();
        }
      },
      async cancel() {
        await upstreamReader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Conversation-Id': conversationId,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === '请先登录') {
      return createUnauthorizedResponse();
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }

    console.error('Chat Error:', error);
    return createJsonError('聊天请求失败，请稍后重试', 500);
  }
}

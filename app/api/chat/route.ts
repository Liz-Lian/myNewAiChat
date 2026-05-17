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
import { generationTaskManager } from '@/server/chat/generation-task-manager';
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
  regeneration: z
    .discriminatedUnion('type', [
      z.object({
        type: z.literal('retry'),
        messageId: z.string().trim().min(1, '消息 ID 不合法'),
      }),
      z.object({
        type: z.literal('edit'),
        messageId: z.string().trim().min(1, '消息 ID 不合法'),
      }),
    ])
    .optional(),
  title: z
    .string()
    .trim()
    .min(1, '标题不能为空')
    .max(120, '标题不能超过 120 个字符')
    .optional(),
});

const DEFAULT_CHAT_MODEL = 'Qwen/Qwen3-8B';

/**
 * 解析会话标题。
 *
 * 优先使用前端传入标题；未传标题时使用最新用户消息前 40 个字符；
 * 如果两者都为空，则回退到默认标题。
 *
 * @param title 前端传入的候选会话标题。
 * @param fallback 用于生成标题的兜底文本，通常是最新用户消息。
 * @returns 规范化后的会话标题。
 */
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

/**
 * 处理聊天发送请求。
 *
 * 会校验登录态、用户私有 SiliconFlow API Key 和会话归属；
 * 首次发送时自动创建会话，随后把用户消息与完整 assistant 回复持久化。
 * 对前端仍保持 SSE 流式响应，并通过响应头返回当前会话 ID。
 *
 * @param req 聊天请求，body 包含消息列表、可选会话 ID 和可选标题。
 * @returns SSE 流式响应；失败时返回结构化 JSON 错误或 499 中断响应。
 */
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

    const {
      conversationId: rawConversationId,
      messages,
      regeneration,
      title,
    } = parsed.data;
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user');

    if (!latestUserMessage) {
      return createJsonError('请求参数不合法', 400, '至少需要一条 user 消息');
    }

    let conversationId = rawConversationId;
    if (conversationId) {
      const existingConversation =
        await conversationRepository.findOwnedWithMessages(
          userId,
          conversationId,
        );

      if (!existingConversation) {
        return createJsonError('会话不存在', 404);
      }

      if (regeneration?.type === 'retry') {
        const targetMessage = existingConversation.messages.find(
          (message) => message.id === regeneration.messageId,
        );

        if (!targetMessage || targetMessage.role !== 'assistant') {
          return createJsonError('消息不存在', 404);
        }

        await messageRepository.deleteFromMessage(
          conversationId,
          regeneration.messageId,
        );
      }

      if (regeneration?.type === 'edit') {
        const targetMessage = existingConversation.messages.find(
          (message) => message.id === regeneration.messageId,
        );

        if (!targetMessage || targetMessage.role !== 'user') {
          return createJsonError('消息不存在', 404);
        }

        await messageRepository.updateUserContent(
          regeneration.messageId,
          latestUserMessage.content,
        );
        await messageRepository.deleteAfterMessage(
          conversationId,
          regeneration.messageId,
        );
      }
    } else {
      const conversation = await conversationRepository.createForUser(
        userId,
        resolveConversationTitle(title, latestUserMessage.content),
      );
      conversationId = conversation.id;
    }

    const userMessage = regeneration
      ? null
      : await messageRepository.create({
          conversationId,
          role: 'user',
          content: latestUserMessage.content,
        });
    const assistantMessage =
      await messageRepository.createAssistantPlaceholder(conversationId);
    generationTaskManager.cleanupOldTasks();
    generationTaskManager.createTask({
      messageId: assistantMessage.id,
      userId,
      conversationId,
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
          model:
            process.env.SILICONFLOW_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL,
          messages,
          stream: true,
        }),
      },
    );

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      generationTaskManager.errorTask(assistantMessage.id, '上游模型调用失败');
      return createJsonError(
        '上游模型调用失败',
        502,
        `status=${upstreamResponse.status}; ${errorText || 'empty response body'}`,
      );
    }

    if (!upstreamResponse.body) {
      generationTaskManager.errorTask(assistantMessage.id, '上游模型响应异常');
      return createJsonError('上游模型响应异常', 502, '未收到可读流');
    }

    const upstreamReader = upstreamResponse.body.getReader();
    const encoder = new TextEncoder();
    let assistantContent = '';
    let clientConnected = true;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ conversationId })}\n\n`),
          );

          await consumeSseStream({
            reader: upstreamReader,
            onChunk: (chunk) => {
              if (!clientConnected) {
                return;
              }

              try {
                controller.enqueue(chunk);
              } catch {
                clientConnected = false;
                generationTaskManager.pauseTask(assistantMessage.id);
              }
            },
            onDelta: (delta) => {
              assistantContent += delta;
              generationTaskManager.appendFullContent(
                assistantMessage.id,
                delta,
              );
              void messageRepository
                .updateContent(assistantMessage.id, assistantContent)
                .catch((error) => {
                  console.warn('Failed to persist streaming content:', error);
                });
              if (clientConnected) {
                generationTaskManager.appendSentContent(
                  assistantMessage.id,
                  delta,
                );
              }
            },
          });

          await messageRepository.updateContent(
            assistantMessage.id,
            assistantContent,
          );
          await conversationRepository.touch(conversationId);
          generationTaskManager.completeTask(assistantMessage.id);

          if (clientConnected) {
            controller.close();
          }
        } catch (error) {
          console.error('Chat Stream Error:', error);
          generationTaskManager.errorTask(
            assistantMessage.id,
            '上游流式响应中断，请稍后重试',
          );
          await messageRepository.updateContent(
            assistantMessage.id,
            assistantContent,
          );

          if (clientConnected) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: '上游流式响应中断，请稍后重试' })}\n\n`,
              ),
            );
            controller.close();
          }
        } finally {
          upstreamReader.releaseLock();
        }
      },
      cancel() {
        clientConnected = false;
        generationTaskManager.pauseTask(assistantMessage.id);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Conversation-Id': conversationId,
        'X-Message-Id': assistantMessage.id,
        ...(userMessage ? { 'X-User-Message-Id': userMessage.id } : {}),
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

/**
 * 聊天续传接口，用于补发指定 assistant 消息尚未送达前端的内容。
 */
import { z } from 'zod';

import {
  createJsonError,
  createUnauthorizedResponse,
  requireCurrentUserId,
} from '@/server/auth/utils';
import { generationTaskManager } from '@/server/chat/generation-task-manager';
import { conversationRepository } from '@/server/repositories/conversation.repository';
import { messageRepository } from '@/server/repositories/message.repository';
import { userRepository } from '@/server/repositories/user.repository';
import { consumeSseStream } from '@/lib/chat-sse';
import {
  DEFAULT_SILICONFLOW_BASE_URL,
  joinSiliconFlowUrl,
} from '@/lib/siliconflow-voice';

export const runtime = 'nodejs';

const continueRequestSchema = z.object({
  conversationId: z.string().trim().min(1, '会话 ID 不合法'),
  messageId: z.string().trim().min(1, '消息 ID 不合法'),
});

const DEFAULT_CHAT_MODEL = 'Qwen/Qwen3-8B';

/**
 * 将文本包装成与上游模型兼容的 SSE delta 事件。
 *
 * @param content 需要发送给前端的增量内容。
 * @returns SSE 字符串。
 */
function createDeltaEvent(content: string): string {
  return `data: ${JSON.stringify({
    choices: [
      {
        delta: {
          content,
        },
      },
    ],
  })}\n\n`;
}

/**
 * 继续补发指定 assistant 消息尚未送达前端的内容。
 *
 * 当前实现是服务端任务级断点续传：不会重新请求上游模型，只从内存任务中
 * 计算 `fullContent - sentContent` 并返回给前端。
 *
 * @param req 请求体包含 conversationId 和 messageId。
 * @returns SSE 流式响应或结构化 JSON 错误。
 */
export async function POST(req: Request) {
  try {
    const userId = await requireCurrentUserId(req);
    const user = await userRepository.findById(userId);

    if (!user) {
      return createUnauthorizedResponse('会话已失效，请重新登录');
    }

    const parsed = continueRequestSchema.safeParse(
      await req.json().catch(() => null),
    );

    if (!parsed.success) {
      return createJsonError(
        '请求参数不合法',
        400,
        parsed.error.issues[0]?.message || '请检查续传参数',
      );
    }

    const { conversationId, messageId } = parsed.data;
    const conversation = await conversationRepository.findOwnedWithMessages(
      userId,
      conversationId,
    );

    if (!conversation) {
      return createJsonError('会话不存在', 404);
    }

    const targetMessage = conversation.messages.find(
      (message) => message.id === messageId,
    );

    if (!targetMessage || targetMessage.role !== 'assistant') {
      return createJsonError('消息不存在', 404);
    }

    const apiKey = user.siliconflowApiKey?.trim();
    if (!apiKey) {
      return createJsonError(
        '未配置硅基流动 API Key，请先保存后再继续生成',
        400,
      );
    }

    generationTaskManager.cleanupOldTasks();
    const task = generationTaskManager.getTask(messageId);

    if (
      task?.status === 'error' &&
      task.userId === userId &&
      task.conversationId === conversationId
    ) {
      return createJsonError(
        '生成任务已失败，可以重试生成',
        409,
        task.error || undefined,
      );
    }

    const encoder = new TextEncoder();
    const canResumeTask =
      task && task.userId === userId && task.conversationId === conversationId;
    const unsentContent = canResumeTask
      ? (generationTaskManager.getUnsentContent(messageId) ?? '')
      : '';

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (canResumeTask) {
            generationTaskManager.resumeTask(messageId);

            if (unsentContent) {
              controller.enqueue(
                encoder.encode(createDeltaEvent(unsentContent)),
              );
              generationTaskManager.appendSentContent(messageId, unsentContent);
            }

            const latestTask = generationTaskManager.getTask(messageId);
            await messageRepository.updateContent(
              messageId,
              latestTask?.fullContent ?? task.fullContent,
            );
            await conversationRepository.touch(conversationId);
          } else {
            // TODO: 当前内存任务不存在时无法做真正断点续传，这里降级为模型续写。
            const targetIndex = conversation.messages.findIndex(
              (message) => message.id === messageId,
            );
            const messagesForModel = [
              ...conversation.messages
                .slice(0, targetIndex + 1)
                .filter(
                  (message) =>
                    (message.role === 'user' || message.role === 'assistant') &&
                    message.content.trim(),
                )
                .map((message) => ({
                  role: message.role as 'user' | 'assistant',
                  content: message.content,
                })),
              {
                role: 'user' as const,
                content:
                  '请从上一条助手回复中断的位置继续生成，不要重复已经给出的内容。',
              },
            ];
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
                    process.env.SILICONFLOW_CHAT_MODEL?.trim() ||
                    DEFAULT_CHAT_MODEL,
                  messages: messagesForModel,
                  stream: true,
                }),
              },
            );

            if (!upstreamResponse.ok) {
              const errorText = await upstreamResponse.text();
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    error: `续写失败：${errorText || upstreamResponse.status}`,
                  })}\n\n`,
                ),
              );
              controller.close();
              return;
            }

            if (!upstreamResponse.body) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: '未收到续写响应' })}\n\n`,
                ),
              );
              controller.close();
              return;
            }

            const upstreamReader = upstreamResponse.body.getReader();
            let continuedContent = '';

            try {
              await consumeSseStream({
                reader: upstreamReader,
                onChunk: (chunk) => {
                  controller.enqueue(chunk);
                },
                onDelta: (delta) => {
                  continuedContent += delta;
                },
              });
            } finally {
              upstreamReader.releaseLock();
            }

            if (continuedContent.trim()) {
              await messageRepository.appendContent(
                messageId,
                continuedContent,
              );
              await conversationRepository.touch(conversationId);
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'complete', messageId })}\n\n`,
            ),
          );
          controller.close();
        } catch (error) {
          console.error('Continue Chat Error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: '续传失败，请稍后重试' })}\n\n`,
            ),
          );
          controller.close();
        }
      },
      cancel() {
        generationTaskManager.pauseTask(messageId);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Conversation-Id': conversationId,
        'X-Message-Id': messageId,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === '请先登录') {
      return createUnauthorizedResponse();
    }

    console.error('Continue Chat Error:', error);
    return createJsonError('续传请求失败，请稍后重试', 500);
  }
}

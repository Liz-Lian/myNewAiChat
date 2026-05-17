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
  // 前端复用普通聊天流解析逻辑，所以续传内容也包装成 choices.delta.content。
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
    // 续传必须确认当前用户，防止通过 messageId 读取其它用户的生成任务。
    const userId = await requireCurrentUserId(req);
    const user = await userRepository.findById(userId);

    if (!user) {
      return createUnauthorizedResponse('会话已失效，请重新登录');
    }

    // 请求体只接受会话 ID 和 assistant 消息 ID，其它内容全部忽略。
    const requestBody = await req.json().catch(() => null);
    const parsed = continueRequestSchema.safeParse(requestBody);

    if (!parsed.success) {
      return createJsonError(
        '请求参数不合法',
        400,
        parsed.error.issues[0]?.message || '请检查续传参数',
      );
    }

    const { conversationId, messageId } = parsed.data;
    // 读取会话时带上 userId 过滤，确保 messageId 必须属于当前用户的会话。
    const conversation = await conversationRepository.findOwnedWithMessages(
      userId,
      conversationId,
    );

    if (!conversation) {
      return createJsonError('会话不存在', 404);
    }

    // 续传只允许 assistant 消息；用户消息没有可补发的模型内容。
    const targetMessage = conversation.messages.find(
      (message) => message.id === messageId,
    );

    if (!targetMessage || targetMessage.role !== 'assistant') {
      return createJsonError('消息不存在', 404);
    }

    // 内存任务失效时会降级请求上游模型续写，所以仍然需要用户自己的 API Key。
    const apiKey = user.siliconflowApiKey?.trim();
    if (!apiKey) {
      return createJsonError(
        '未配置硅基流动 API Key，请先保存后再继续生成',
        400,
      );
    }

    generationTaskManager.cleanupOldTasks();
    const task = generationTaskManager.getTask(messageId);

    // 任务已经失败时不要盲目续传，提示用户走重试生成更明确。
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
    // 只有任务归属完全匹配时，才允许使用内存里的断点内容。
    const canResumeTask =
      task && task.userId === userId && task.conversationId === conversationId;
    const unsentContent = canResumeTask
      ? (generationTaskManager.getUnsentContent(messageId) ?? '')
      : '';

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (canResumeTask) {
            // 内存任务还在时，直接补发 fullContent 中尚未 sent 的部分。
            generationTaskManager.resumeTask(messageId);

            if (unsentContent) {
              controller.enqueue(
                encoder.encode(createDeltaEvent(unsentContent)),
              );
              generationTaskManager.appendSentContent(messageId, unsentContent);
            }

            const latestTask = generationTaskManager.getTask(messageId);
            // 补发后把完整内容重新落库，确保刷新页面也能看到最新文本。
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
            // 只把目标消息之前的有效 user/assistant 文本发给模型，避免空消息污染上下文。
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
            // 没有内存任务时，请模型根据已有上下文继续写，不保证完全无重复。
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
              // 上游 chunk 原样转给前端，同时把 delta 累加起来用于追加落库。
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
              // 续写内容只追加到原 assistant 消息末尾，不新建一条 assistant 消息。
              await messageRepository.appendContent(
                messageId,
                continuedContent,
              );
              await conversationRepository.touch(conversationId);
            }
          }

          // complete 事件让前端知道续传流自然结束，可以把消息标记为完成。
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'complete', messageId })}\n\n`,
            ),
          );
          controller.close();
        } catch (error) {
          console.error('Continue Chat Error:', error);
          // 续传失败也走 SSE error 帧，前端不用额外处理 fetch 异常格式。
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: '续传失败，请稍后重试' })}\n\n`,
            ),
          );
          controller.close();
        }
      },
      cancel() {
        // 客户端主动断开时，保留任务进度，下一次还能继续补发。
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
      // 登录态错误统一转换为 401 JSON。
      return createUnauthorizedResponse();
    }

    console.error('Continue Chat Error:', error);
    return createJsonError('续传请求失败，请稍后重试', 500);
  }
}

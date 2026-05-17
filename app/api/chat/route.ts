/**
 * 本文件实现 /api/chat 接口的 Next.js Route Handler。
 */
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
  // 前端传了标题就直接使用，避免被后续默认标题覆盖。
  if (title?.trim()) {
    return title.trim();
  }

  // 没有标题时，用最新用户消息截断生成会话列表里的默认标题。
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
    // 每次聊天都必须绑定当前登录用户，后续会话查询也依赖这个 userId 做隔离。
    const userId = await requireCurrentUserId(req);
    const user = await userRepository.findById(userId);

    if (!user) {
      return createUnauthorizedResponse('会话已失效，请重新登录');
    }

    // 请求体解析失败时传 null 给 zod，让客户端拿到统一的参数错误响应。
    const requestBody = await req.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(requestBody);

    if (!parsed.success) {
      return createJsonError(
        '请求参数不合法',
        400,
        parsed.error.issues[0]?.message || '请检查消息参数',
      );
    }

    // SiliconFlow Key 是用户私有配置，缺失时不要继续创建会话或消息。
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
    // 从完整上下文里找到最后一条 user 消息，作为本次要入库/重试/编辑的内容。
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user');

    if (!latestUserMessage) {
      return createJsonError('请求参数不合法', 400, '至少需要一条 user 消息');
    }

    let conversationId = rawConversationId;
    if (conversationId) {
      // 已有会话必须先查归属和消息列表，防止用户操作别人的会话。
      const existingConversation =
        await conversationRepository.findOwnedWithMessages(
          userId,
          conversationId,
        );

      if (!existingConversation) {
        return createJsonError('会话不存在', 404);
      }

      if (regeneration?.type === 'retry') {
        // 重试 assistant 回复时，从目标 assistant 消息开始删掉后续内容再重新生成。
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
        // 编辑用户消息时，先改这条 user 内容，再删除它后面的 assistant 分支。
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
      // 首次发送没有会话 ID，需要先创建会话，标题由前端标题或最新用户消息生成。
      const conversation = await conversationRepository.createForUser(
        userId,
        resolveConversationTitle(title, latestUserMessage.content),
      );
      conversationId = conversation.id;
    }

    // 普通发送要新增 user 消息；重试/编辑已在上面处理过历史消息，所以这里不重复写入。
    const userMessage = regeneration
      ? null
      : await messageRepository.create({
          conversationId,
          role: 'user',
          content: latestUserMessage.content,
        });
    // 先创建空 assistant 占位，让前端立刻拿到稳定的消息 ID 来承接流式内容。
    const assistantMessage =
      await messageRepository.createAssistantPlaceholder(conversationId);
    // 生成任务记录同时保存完整内容和已发送内容，用于断连后继续生成。
    generationTaskManager.cleanupOldTasks();
    generationTaskManager.createTask({
      messageId: assistantMessage.id,
      userId,
      conversationId,
    });
    await conversationRepository.touch(conversationId);

    // 向 SiliconFlow 请求流式补全，模型和 baseUrl 支持通过环境变量覆盖。
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
      // 上游非 2xx 时，标记任务失败并把上游状态码/文本带回 details 方便排查。
      const errorText = await upstreamResponse.text();
      generationTaskManager.errorTask(assistantMessage.id, '上游模型调用失败');
      return createJsonError(
        '上游模型调用失败',
        502,
        `status=${upstreamResponse.status}; ${errorText || 'empty response body'}`,
      );
    }

    if (!upstreamResponse.body) {
      // 选择 stream=true 后理论上必须有 body，没有可读流就不能继续 SSE 转发。
      generationTaskManager.errorTask(assistantMessage.id, '上游模型响应异常');
      return createJsonError('上游模型响应异常', 502, '未收到可读流');
    }

    const upstreamReader = upstreamResponse.body.getReader();
    const encoder = new TextEncoder();
    let assistantContent = '';
    let clientConnected = true;

    // 这里把 SiliconFlow 的 SSE 读出来，再转发成我们自己的 SSE 响应给前端。
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // 第一帧先告诉前端会话 ID，首次会话创建后 UI 可以立即绑定到真实会话。
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
                // 原样转发上游 chunk，保证前端仍按 SSE 流式追加内容。
                controller.enqueue(chunk);
              } catch {
                // 前端断开时 enqueue 会失败，此时暂停任务，后续可用继续生成补发未发送部分。
                clientConnected = false;
                generationTaskManager.pauseTask(assistantMessage.id);
              }
            },
            onDelta: (delta) => {
              // delta 是本次新增文本：完整内容用于落库，已发送内容用于断点续传判断。
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
                // 只有确认发给前端的 delta 才记入 sentContent，避免断线时漏补。
                generationTaskManager.appendSentContent(
                  assistantMessage.id,
                  delta,
                );
              }
            },
          });

          // 流结束后再做一次完整落库，覆盖过程中可能失败的增量保存。
          await messageRepository.updateContent(
            assistantMessage.id,
            assistantContent,
          );
          await conversationRepository.touch(conversationId);
          generationTaskManager.completeTask(assistantMessage.id);

          if (clientConnected) {
            // 客户端仍在线时正常关闭 SSE；断开时让 cancel 分支维护任务状态。
            controller.close();
          }
        } catch (error) {
          console.error('Chat Stream Error:', error);
          // 上游流中断时保留已经生成的内容，方便用户看到部分回答或后续重试。
          generationTaskManager.errorTask(
            assistantMessage.id,
            '上游流式响应中断，请稍后重试',
          );
          await messageRepository.updateContent(
            assistantMessage.id,
            assistantContent,
          );

          if (clientConnected) {
            // 用 SSE error 帧通知前端，而不是让浏览器只看到连接突然结束。
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: '上游流式响应中断，请稍后重试' })}\n\n`,
              ),
            );
            controller.close();
          }
        } finally {
          // 释放 reader 锁，避免同一个 ReadableStream 后续被锁死。
          upstreamReader.releaseLock();
        }
      },
      cancel() {
        // 浏览器取消请求时暂停任务，保留完整内容和已发送进度用于继续生成。
        clientConnected = false;
        generationTaskManager.pauseTask(assistantMessage.id);
      },
    });

    // 响应头把消息 ID 和会话 ID 带回前端，前端据此更新本地临时消息。
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
      // requireCurrentUserId 会通过抛错表示未登录，这里转成统一 401 JSON。
      return createUnauthorizedResponse();
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      // 499 表示客户端主动中断，避免把取消操作记录成服务端错误。
      return new Response(null, { status: 499 });
    }

    console.error('Chat Error:', error);
    return createJsonError('聊天请求失败，请稍后重试', 500);
  }
}

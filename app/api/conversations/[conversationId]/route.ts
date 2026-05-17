/**
 * 单会话接口（Conversation Item）
 *
 * 职责：
 * - GET: 获取当前用户的单个会话。
 * - PATCH: 修改当前用户会话标题。
 * - DELETE: 删除当前用户会话。
 *
 * 安全约束：
 * - 所有入口先鉴权。
 * - 所有查询与变更都携带 userId 条件，避免跨用户访问。
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  createJsonError,
  createUnauthorizedResponse,
  requireCurrentUserId,
} from '@/server/auth/utils';
import { generationTaskManager } from '@/server/chat/generation-task-manager';
import { conversationRepository } from '@/server/repositories/conversation.repository';

export const runtime = 'nodejs';

const updateConversationTitleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '标题不能为空')
    .max(120, '标题不能超过 120 个字符'),
});

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

/**
 * 获取当前登录用户拥有的单个会话。
 *
 * @param req 当前请求，用于读取会话 Cookie。
 * @param context Next.js 动态路由上下文，包含会话 ID。
 * @returns 会话元信息响应；未登录、无归属或失败时返回结构化 JSON 错误。
 */
export async function GET(req: Request, context: RouteContext) {
  // 先按接口职责校验请求，再执行业务处理并返回响应。
  try {
    /**
     * 先鉴权，再执行资源级权限校验。
     */
    const userId = await requireCurrentUserId(req);
    const { conversationId } = await context.params;

    /**
     * 通过 id + userId 双条件确保只能读取自己的会话。
     */
    const conversation = await conversationRepository.findOwnedWithMessages(
      userId,
      conversationId,
    );

    if (!conversation) {
      return createJsonError('会话不存在', 404);
    }

    const tasks = generationTaskManager.listConversationTasks(
      userId,
      conversationId,
    );
    const taskByMessageId = new Map(
      tasks.map((task) => [task.messageId, task]),
    );
    const conversationWithTaskMessages = {
      ...conversation,
      messages: conversation.messages.map((message) => {
        const task = taskByMessageId.get(message.id);

        if (!task || message.role !== 'assistant') {
          return message;
        }

        return {
          ...message,
          content: task.fullContent || message.content,
          isComplete: task.status === 'completed',
          hasError: task.status === 'error',
        };
      }),
    };

    return NextResponse.json(
      {
        conversation: conversationWithTaskMessages,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === '请先登录') {
      return createUnauthorizedResponse();
    }

    console.error('Get Conversation Error:', error);
    return createJsonError('获取会话失败，请稍后重试', 500);
  }
}

/**
 * 更新当前登录用户拥有的会话标题。
 *
 * @param req 更新请求，body 需包含新的 title。
 * @param context Next.js 动态路由上下文，包含会话 ID。
 * @returns 更新后的会话元信息；未登录、无归属或失败时返回结构化 JSON 错误。
 */
export async function PATCH(req: Request, context: RouteContext) {
  // 先按接口职责校验请求，再执行业务处理并返回响应。
  try {
    /**
     * 先鉴权，再做参数与资源权限检查。
     */
    const userId = await requireCurrentUserId(req);
    const { conversationId } = await context.params;

    const body = await req.json().catch(() => null);
    const parsed = updateConversationTitleSchema.safeParse(body);

    if (!parsed.success) {
      return createJsonError(
        '请求参数不合法',
        400,
        parsed.error.issues[0]?.message || '请检查会话标题',
      );
    }

    /**
     * 先确认资源归属，避免跨用户更新。
     */
    const existingConversation = await conversationRepository.findOwnedIdOnly(
      userId,
      conversationId,
    );

    if (!existingConversation) {
      return createJsonError('会话不存在', 404);
    }

    const conversation = await conversationRepository.updateTitleOwned(
      userId,
      conversationId,
      parsed.data.title,
    );

    if (!conversation) {
      return createJsonError('会话不存在', 404);
    }

    return NextResponse.json(
      {
        conversation,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === '请先登录') {
      return createUnauthorizedResponse();
    }

    console.error('Update Conversation Error:', error);
    return createJsonError('更新会话标题失败，请稍后重试', 500);
  }
}

/**
 * 删除当前登录用户拥有的会话。
 *
 * @param req 当前请求，用于读取会话 Cookie。
 * @param context Next.js 动态路由上下文，包含会话 ID。
 * @returns 删除成功消息；未登录、无归属或失败时返回结构化 JSON 错误。
 */
export async function DELETE(req: Request, context: RouteContext) {
  // 先按接口职责校验请求，再执行业务处理并返回响应。
  try {
    /**
     * 先鉴权，再按 userId 做删除隔离。
     */
    const userId = await requireCurrentUserId(req);
    const { conversationId } = await context.params;

    /**
     * deleteMany 搭配 userId 条件，可同时实现权限校验与幂等删除。
     */
    const deleteResult = await conversationRepository.deleteOwned(
      userId,
      conversationId,
    );

    if (deleteResult.count === 0) {
      return createJsonError('会话不存在', 404);
    }

    return NextResponse.json(
      {
        message: '会话已删除',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === '请先登录') {
      return createUnauthorizedResponse();
    }

    console.error('Delete Conversation Error:', error);
    return createJsonError('删除会话失败，请稍后重试', 500);
  }
}

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

export async function GET(req: Request, context: RouteContext) {
  try {
    // 先鉴权，再执行资源级权限校验。
    const userId = await requireCurrentUserId(req);
    const { conversationId } = await context.params;

    // 通过 id + userId 双条件确保只能读取自己的会话。
    const conversation = await conversationRepository.findOwnedById(
      userId,
      conversationId,
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

    console.error('Get Conversation Error:', error);
    return createJsonError('获取会话失败，请稍后重试', 500);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    // 先鉴权，再做参数与资源权限检查。
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

    // 先确认资源归属，避免跨用户更新。
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

export async function DELETE(req: Request, context: RouteContext) {
  try {
    // 先鉴权，再按 userId 做删除隔离。
    const userId = await requireCurrentUserId(req);
    const { conversationId } = await context.params;

    // deleteMany 搭配 userId 条件，可同时实现权限校验与幂等删除。
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

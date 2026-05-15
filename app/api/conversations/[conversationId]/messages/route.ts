import {
  createJsonError,
  createUnauthorizedResponse,
  requireCurrentUserId,
} from '@/server/auth/utils';
import { conversationRepository } from '@/server/repositories/conversation.repository';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

/**
 * 获取当前登录用户某个会话下的消息列表。
 *
 * @param req 当前请求，用于读取会话 Cookie。
 * @param context Next.js 动态路由上下文，包含会话 ID。
 * @returns 会话消息列表；未登录、无归属或失败时返回结构化 JSON 错误。
 */
export async function GET(req: Request, context: RouteContext) {
  try {
    const userId = await requireCurrentUserId(req);
    const { conversationId } = await context.params;
    const conversation = await conversationRepository.findOwnedWithMessages(
      userId,
      conversationId,
    );

    if (!conversation) {
      return createJsonError('会话不存在', 404);
    }

    return Response.json(
      {
        conversation: {
          id: conversation.id,
          title: conversation.title,
          userId: conversation.userId,
          isShared: conversation.isShared,
          sharedAt: conversation.sharedAt,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
        messages: conversation.messages,
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

    console.error('List Conversation Messages Error:', error);
    return createJsonError('获取会话消息失败，请稍后重试', 500);
  }
}

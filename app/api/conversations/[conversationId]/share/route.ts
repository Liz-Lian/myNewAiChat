import { randomBytes } from 'crypto';

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
 * 生成公开分享 token。
 *
 * @returns URL 安全的随机 token。
 */
function createShareToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * 为当前登录用户的会话开启公开分享。
 *
 * @param req 当前请求，用于读取会话 Cookie。
 * @param context Next.js 动态路由上下文，包含会话 ID。
 * @returns 分享 token 和分享链接；未登录、无归属或失败时返回结构化 JSON 错误。
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const userId = await requireCurrentUserId(req);
    const { conversationId } = await context.params;
    const share = await conversationRepository.enableShareOwned(
      userId,
      conversationId,
      createShareToken(),
    );

    if (!share?.shareToken) {
      return createJsonError('会话不存在', 404);
    }

    const shareUrl = new URL(`/share/${share.shareToken}`, req.url).toString();

    return Response.json(
      {
        shareToken: share.shareToken,
        shareUrl,
        isShared: share.isShared,
        sharedAt: share.sharedAt,
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

    console.error('Share Conversation Error:', error);
    return createJsonError('生成分享链接失败，请稍后重试', 500);
  }
}

/**
 * 取消当前登录用户会话的公开分享。
 *
 * @param req 当前请求，用于读取会话 Cookie。
 * @param context Next.js 动态路由上下文，包含会话 ID。
 * @returns 取消分享后的状态；未登录、无归属或失败时返回结构化 JSON 错误。
 */
export async function DELETE(req: Request, context: RouteContext) {
  try {
    const userId = await requireCurrentUserId(req);
    const { conversationId } = await context.params;
    const share = await conversationRepository.disableShareOwned(
      userId,
      conversationId,
    );

    if (!share) {
      return createJsonError('会话不存在', 404);
    }

    return Response.json(
      {
        isShared: share.isShared,
        sharedAt: share.sharedAt,
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

    console.error('Cancel Conversation Share Error:', error);
    return createJsonError('取消分享失败，请稍后重试', 500);
  }
}

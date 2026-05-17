/**
 * 本文件实现 /api/share/[shareToken] 接口的 Next.js Route Handler。
 */
import { createJsonError } from '@/server/auth/utils';
import { conversationRepository } from '@/server/repositories/conversation.repository';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{
    shareToken: string;
  }>;
};

/**
 * 通过公开分享 token 获取只读会话内容。
 *
 * 该接口无需登录，但只返回已开启分享的会话。
 *
 * @param _req 当前请求。
 * @param context Next.js 动态路由上下文，包含分享 token。
 * @returns 公开分享会话详情；分享不存在或已失效时返回 404。
 */
export async function GET(_req: Request, context: RouteContext) {
  // 先按接口职责校验请求，再执行业务处理并返回响应。
  try {
    const { shareToken } = await context.params;
    const conversation =
      await conversationRepository.findPublicSharedByToken(shareToken);

    if (!conversation) {
      return createJsonError('分享不存在或已失效', 404);
    }

    return Response.json(
      {
        conversation: {
          id: conversation.id,
          title: conversation.title,
          shareToken: conversation.shareToken,
          sharedAt: conversation.sharedAt,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          owner: conversation.user,
          messages: conversation.messages,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('Get Public Share Error:', error);
    return createJsonError('获取分享内容失败，请稍后重试', 500);
  }
}

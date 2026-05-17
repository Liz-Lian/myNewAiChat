/**
 * 本文件实现 /api/auth/me 接口的 Next.js Route Handler。
 */
import { NextResponse } from 'next/server';

import {
  clearSessionCookie,
  createUnauthorizedResponse,
  getCurrentUserId,
} from '@/server/auth/utils';
import { userRepository } from '@/server/repositories/user.repository';

export const runtime = 'nodejs';

/**
 * 获取当前登录用户信息。
 *
 * 从会话 Cookie 中解析用户 ID，再查询数据库确认用户仍然存在。
 * 当 Cookie 缺失、令牌失效或用户不存在时，会返回 401 并清除旧 Cookie。
 *
 * @param req 当前请求，用于读取 Cookie 中的会话令牌。
 * @returns 登录有效时返回当前用户基础信息；否则返回未授权响应。
 */
export async function GET(req: Request) {
  try {
    // 先从 Cookie/JWT 解析用户 ID，解析失败就清掉旧 Cookie。
    const userId = await getCurrentUserId(req);

    if (!userId) {
      const response = createUnauthorizedResponse();
      clearSessionCookie(response);
      return response;
    }

    // JWT 有效还不够，仍要确认数据库用户没有被删除。
    const user = await userRepository.findById(userId);

    if (!user) {
      const response = createUnauthorizedResponse();
      clearSessionCookie(response);
      return response;
    }

    // 这里只返回前端展示需要的用户信息，不包含 API Key、密码哈希等敏感字段。
    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('Me Error:', error);
    return createUnauthorizedResponse('会话已失效，请重新登录');
  }
}

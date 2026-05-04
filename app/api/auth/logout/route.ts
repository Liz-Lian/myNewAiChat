import { NextResponse } from 'next/server';

import { clearSessionCookie, createJsonError } from '@/server/auth/utils';

export const runtime = 'nodejs';

/**
 * 处理用户登出请求。
 *
 * 服务端通过清空会话 Cookie 结束当前登录态，不依赖数据库状态。
 *
 * @returns 登出成功时返回提示消息；失败时返回结构化 JSON 错误。
 */
export async function POST() {
  try {
    const response = NextResponse.json(
      {
        message: '已登出',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );

    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error('Logout Error:', error);
    return createJsonError('登出失败，请稍后重试', 500);
  }
}

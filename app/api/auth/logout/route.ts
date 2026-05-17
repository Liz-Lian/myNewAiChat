/**
 * 本文件实现 /api/auth/logout 接口的 Next.js Route Handler。
 */
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
    // 登出不需要读取请求体，只要覆盖并过期当前会话 Cookie。
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

    // clearSessionCookie 会使用和登录相同的 Cookie 名称与路径，确保覆盖成功。
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error('Logout Error:', error);
    return createJsonError('登出失败，请稍后重试', 500);
  }
}

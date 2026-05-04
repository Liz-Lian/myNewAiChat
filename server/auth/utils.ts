import 'server-only';

/**
 * 认证工具模块。
 *
 * 职责：
 * - 处理会话 Cookie 的读写。
 * - 提供统一的 JSON 错误响应。
 * - 从请求中解析当前用户与用户 ID。
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { verifySessionToken } from '@/server/auth/jwt';
import { userRepository } from '@/server/repositories/user.repository';

const SESSION_COOKIE_NAME = '__Host-session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const AUTH_ERROR_MESSAGE = '请先登录';

export const loginRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .check(z.email({ error: '请输入有效的邮箱地址' })),
  password: z.string().min(1, '请输入密码'),
});

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  siliconflowApiKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 从 Cookie 请求头中提取指定键值。
 *
 * @param cookieHeader 原始 Cookie 请求头。
 * @param name 要读取的 Cookie 名称。
 * @returns 找到时返回 Cookie 值，否则返回 `null`。
 */
function getCookieValue(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    if (rawName === name) {
      return rawValueParts.join('=');
    }
  }

  return null;
}

/**
 * 获取统一的会话 Cookie 配置。
 *
 * @returns NextResponse Cookie API 可用的会话 Cookie 配置。
 */
function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

/**
 * 写入会话 Cookie。
 *
 * @param response 需要附加 Cookie 的 Next.js 响应对象。
 * @param token 已签发的会话 JWT。
 */
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

/**
 * 清除会话 Cookie。
 *
 * @param response 需要附加清除 Cookie 指令的 Next.js 响应对象。
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...getSessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * 统一生成 JSON 错误响应。
 *
 * @param message 面向客户端的错误信息。
 * @param status HTTP 状态码。
 * @param details 可选的错误详情。
 * @returns 带 `Cache-Control: no-store` 的 JSON 错误响应。
 */
export function createJsonError(
  message: string,
  status: number,
  details?: string,
) {
  return NextResponse.json(
    {
      error: message,
      ...(details ? { details } : {}),
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}

/**
 * 统一生成 401 未授权响应。
 *
 * @param details 可选的未授权详情。
 * @returns 标准 401 JSON 错误响应。
 */
export function createUnauthorizedResponse(details?: string) {
  return createJsonError(AUTH_ERROR_MESSAGE, 401, details);
}

/**
 * 从请求中解析当前登录用户。
 *
 * @param request 当前 HTTP 请求。
 * @returns 登录有效时返回数据库中的用户信息，否则返回 `null`。
 */
export async function getCurrentUserFromRequest(
  request: Request,
): Promise<SessionUser | null> {
  const token = getCookieValue(
    request.headers.get('cookie'),
    SESSION_COOKIE_NAME,
  );

  if (!token) {
    return null;
  }

  try {
    const session = await verifySessionToken(token);
    const user = await userRepository.findById(session.id);

    if (!user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * 从请求中解析当前登录用户 ID。
 *
 * @param request 当前 HTTP 请求。
 * @returns 登录有效时返回用户 ID，否则返回 `null`。
 */
export async function getCurrentUserId(
  request: Request,
): Promise<string | null> {
  const user = await getCurrentUserFromRequest(request);
  return user?.id ?? null;
}

/**
 * 要求请求必须已登录，并返回用户对象。
 *
 * @param request 当前 HTTP 请求。
 * @returns 当前登录用户的数据库信息。
 * @throws 当请求没有有效登录态时抛出“请先登录”错误。
 */
export async function requireCurrentUser(
  request: Request,
): Promise<SessionUser> {
  const user = await getCurrentUserFromRequest(request);

  if (!user) {
    throw new Error(AUTH_ERROR_MESSAGE);
  }

  return user;
}

/**
 * 要求请求必须已登录，并返回用户 ID。
 *
 * @param request 当前 HTTP 请求。
 * @returns 当前登录用户 ID。
 * @throws 当请求没有有效登录态时抛出“请先登录”错误。
 */
export async function requireCurrentUserId(request: Request): Promise<string> {
  const userId = await getCurrentUserId(request);

  if (!userId) {
    throw new Error(AUTH_ERROR_MESSAGE);
  }

  return userId;
}

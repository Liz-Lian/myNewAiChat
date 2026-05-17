/**
 * 本文件封装认证 Cookie、当前用户解析和统一错误响应工具。
 */
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
const DEV_SESSION_COOKIE_NAME = 'session';
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
  // 没有 Cookie 头时直接视为未登录，避免后续 split 空字符串。
  if (!cookieHeader) {
    return null;
  }

  // Cookie 头是用分号拼接的键值对，这里逐项寻找目标 session 名称。
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
 * 获取当前环境使用的会话 Cookie 名称。
 *
 * @returns 生产环境返回 `__Host-session`，开发环境返回普通本地 Cookie 名称。
 */
function getSessionCookieName(): string {
  // 生产环境必须使用 __Host- 前缀；开发环境用普通名称方便本地 http 调试。
  return process.env.NODE_ENV === 'production'
    ? SESSION_COOKIE_NAME
    : DEV_SESSION_COOKIE_NAME;
}

/**
 * 获取统一的会话 Cookie 配置。
 *
 * @returns NextResponse Cookie API 可用的会话 Cookie 配置。
 */
function getSessionCookieOptions() {
  // secure 只在生产环境开启，避免本地 http 开发时 Cookie 无法写入。
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
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
  // 登录成功后把 JWT 写入 HttpOnly Cookie，前端 JS 不能直接读取它。
  response.cookies.set(
    getSessionCookieName(),
    token,
    getSessionCookieOptions(),
  );
}

/**
 * 清除会话 Cookie。
 *
 * @param response 需要附加清除 Cookie 指令的 Next.js 响应对象。
 */
export function clearSessionCookie(response: NextResponse): void {
  // 登出时把同名 Cookie 设为空并过期，覆盖浏览器里已有的会话。
  response.cookies.set(getSessionCookieName(), '', {
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
  // details 只在有值时返回，避免客户端拿到空字符串字段。
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
  // 所有未登录错误统一走同一个文案和 401 状态码。
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
  // 当前用户完全来自请求 Cookie，不信任客户端传入的用户 ID。
  const token = getCookieValue(
    request.headers.get('cookie'),
    getSessionCookieName(),
  );

  if (!token) {
    return null;
  }

  try {
    // JWT 只存用户标识，仍然要回数据库读取最新用户信息和 API Key。
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
  // 复用完整用户解析逻辑，保证 token 校验和用户存在性检查保持一致。
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
  // 路由需要强制登录时使用这个函数，把 null 结果转换成可捕获的错误。
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
  // 只需要用户 ID 的路由使用这个轻量入口，避免重复处理未登录分支。
  const userId = await getCurrentUserId(request);

  if (!userId) {
    throw new Error(AUTH_ERROR_MESSAGE);
  }

  return userId;
}

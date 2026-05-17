/**
 * 本文件实现 /api/auth/login 接口的 Next.js Route Handler。
 */
import { NextResponse } from 'next/server';

import {
  createJsonError,
  loginRequestSchema,
  setSessionCookie,
} from '@/server/auth/utils';
import { createSessionToken } from '@/server/auth/jwt';
import { verifyPassword } from '@/server/auth/password';
import { userRepository } from '@/server/repositories/user.repository';

export const runtime = 'nodejs';

/**
 * 处理用户登录请求。
 *
 * 校验邮箱和密码后签发会话 JWT，并通过 HttpOnly Cookie 写入浏览器。
 * 登录失败时统一返回邮箱或密码错误，避免泄露账号是否存在。
 *
 * @param req 登录请求，body 需包含 email 和 password。
 * @returns 登录成功时返回当前用户基础信息；失败时返回结构化 JSON 错误。
 */
export async function POST(req: Request) {
  try {
    // 登录表单只接受邮箱和密码，JSON 解析失败时统一交给 zod 生成参数错误。
    const requestBody = await req.json().catch(() => null);
    const bodyResult = loginRequestSchema.safeParse(requestBody);

    if (!bodyResult.success) {
      return createJsonError(
        '请求参数不合法',
        400,
        bodyResult.error.issues[0]?.message || '请检查邮箱和密码',
      );
    }

    const { email, password } = bodyResult.data;
    // 先按邮箱查用户，再统一返回“邮箱或密码错误”，避免泄露账号是否存在。
    const user = await userRepository.findByEmail(email);

    if (!user) {
      return createJsonError('邮箱或密码错误', 401);
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);

    if (!passwordMatches) {
      return createJsonError('邮箱或密码错误', 401);
    }

    // 密码校验通过后签发短载荷 JWT，完整用户信息仍然从数据库读取。
    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json(
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

    // token 写入 HttpOnly Cookie，响应体只返回前端展示需要的基础用户信息。
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Login Error:', error);
    return createJsonError('登录失败，请稍后重试', 500);
  }
}

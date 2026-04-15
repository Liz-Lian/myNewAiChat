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

export async function POST(req: Request) {
  try {
    const bodyResult = loginRequestSchema.safeParse(
      await req.json().catch(() => null),
    );

    if (!bodyResult.success) {
      return createJsonError(
        '请求参数不合法',
        400,
        bodyResult.error.issues[0]?.message || '请检查邮箱和密码',
      );
    }

    const { email, password } = bodyResult.data;
    const user = await userRepository.findByEmail(email);

    if (!user) {
      return createJsonError('邮箱或密码错误', 401);
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);

    if (!passwordMatches) {
      return createJsonError('邮箱或密码错误', 401);
    }

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

    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Login Error:', error);
    return createJsonError('登录失败，请稍后重试', 500);
  }
}

import 'server-only';

/**
 * JWT 认证能力模块。
 *
 * 职责：
 * - 签发会话令牌。
 * - 校验会话令牌并返回标准化用户载荷。
 */

import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const AUTH_ISSUER = 'my-ai-chat';
const AUTH_AUDIENCE = 'my-ai-chat-session';

const tokenPayloadSchema = z.object({
  email: z.email(),
  name: z.string().nullable().optional(),
});

export type AuthPayload = {
  id: string;
  email: string;
  name: string | null;
};

/**
 * 读取并校验 JWT 密钥配置。
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET;

  if (!secret) {
    throw new Error('AUTH_JWT_SECRET 未配置');
  }

  return new TextEncoder().encode(secret);
}

/**
 * 根据用户信息签发会话 JWT。
 */
export async function createSessionToken(user: AuthPayload): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(AUTH_ISSUER)
    .setAudience(AUTH_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

/**
 * 校验并解析会话 JWT。
 */
export async function verifySessionToken(token: string): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    issuer: AUTH_ISSUER,
    audience: AUTH_AUDIENCE,
    clockTolerance: '5s',
  });

  const parsed = tokenPayloadSchema.safeParse(payload);

  if (!parsed.success || typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('无效的会话令牌');
  }

  return {
    id: payload.sub,
    email: parsed.data.email,
    name: parsed.data.name ?? null,
  };
}

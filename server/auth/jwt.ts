/**
 * 本文件封装认证 JWT 的签发、校验和密钥读取逻辑。
 */
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
 * 读取并编码 JWT 签名密钥。
 *
 * @returns 可供 jose 使用的 HMAC 密钥字节数组。
 * @throws 当 `AUTH_JWT_SECRET` 未配置时抛出错误。
 */
function getJwtSecret(): Uint8Array {
  // jose 需要 Uint8Array 密钥，所以把环境变量里的字符串编码成字节。
  const secret = process.env.AUTH_JWT_SECRET;

  if (!secret) {
    throw new Error('AUTH_JWT_SECRET 未配置');
  }

  return new TextEncoder().encode(secret);
}

/**
 * 根据用户信息签发会话 JWT。
 *
 * @param user 当前登录用户的标准化认证载荷。
 * @returns 已签名的会话令牌字符串。
 * @throws 当 `AUTH_JWT_SECRET` 未配置或签名失败时抛出错误。
 */
export async function createSessionToken(user: AuthPayload): Promise<string> {
  // JWT 只放必要身份字段，用户 ID 放在标准 sub 字段里。
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
 *
 * @param token 待校验的会话令牌。
 * @returns 从令牌中解析出的标准化用户认证载荷。
 * @throws 当令牌签名、issuer、audience、过期时间或 payload 不合法时抛出错误。
 */
export async function verifySessionToken(token: string): Promise<AuthPayload> {
  // 同时校验签名、issuer、audience 和过期时间，防止其它 token 被复用。
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

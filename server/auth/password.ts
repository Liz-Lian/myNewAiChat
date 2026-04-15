/**
 * 密码处理模块。
 *
 * 职责：
 * - 生成密码哈希。
 * - 校验明文密码与哈希是否匹配。
 */
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * 对明文密码进行哈希。
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 校验密码是否与哈希一致。
 */
export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

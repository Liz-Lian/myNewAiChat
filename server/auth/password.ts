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
 * 对明文密码进行 bcrypt 哈希。
 *
 * @param password 待哈希的明文密码。
 * @returns 可持久化保存的密码哈希。
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 校验密码是否与哈希一致。
 *
 * @param password 用户提交的明文密码。
 * @param passwordHash 数据库中保存的密码哈希。
 * @returns 密码匹配时返回 `true`，否则返回 `false`。
 */
export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

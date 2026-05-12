import 'dotenv/config';

/**
 * 数据库 Seed 模块。
 *
 * 职责：
 * - 初始化管理员账号。
 * - 支持通过环境变量注入初始 API Key。
 */

import { hashPassword } from '@/server/auth/password';
import { userRepository } from '@/server/repositories/user.repository';

const DEFAULT_ADMIN_EMAIL = 'admin@local.dev';
const DEFAULT_ADMIN_NAME = 'Admin';
const DEFAULT_ADMIN_PASSWORD = 'Admin@123456';

/**
 * 执行基础数据初始化。
 *
 * @returns Seed 执行完成后 resolve。
 * @throws 当 `DATABASE_URL` 缺失或管理员账号写入失败时抛出错误。
 */
export async function runSeed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('缺少 DATABASE_URL，无法执行 seed');
  }

  const adminEmail =
    process.env.SEED_ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;
  const adminName = process.env.SEED_ADMIN_NAME?.trim() || DEFAULT_ADMIN_NAME;
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const siliconflowApiKey =
    process.env.SEED_ADMIN_SILICONFLOW_API_KEY?.trim() ||
    process.env.SILICONFLOW_API_KEY?.trim() ||
    null;

  console.log('[seed] 开始初始化基础数据...');
  console.log(`[seed] admin email: ${adminEmail}`);
  console.log(
    `[seed] siliconflow key: ${siliconflowApiKey ? '已提供' : '未提供（将置空）'}`,
  );

  const passwordHash = await hashPassword(adminPassword);

  const admin = await userRepository.upsertAdminUser({
    email: adminEmail,
    name: adminName,
    passwordHash,
    siliconflowApiKey,
  });

  console.log(`[seed] admin 用户就绪: ${admin.email} (${admin.id})`);
  console.log('[seed] 基础数据初始化完成');
}

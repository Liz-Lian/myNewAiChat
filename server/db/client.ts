/**
 * Prisma Client 单例模块。
 *
 * 职责：
 * - 初始化 PostgreSQL 适配器。
 * - 在开发环境复用 Prisma Client，避免连接泄漏。
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../app/generated/prisma/client';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

/**
 * 数据库连接适配器。
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

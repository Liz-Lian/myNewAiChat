import 'dotenv/config';

/**
 * Prisma seed 命令入口。
 *
 * 负责加载环境变量、执行基础数据初始化，并在结束后断开 Prisma 连接。
 */

import prisma from '@/server/db/client';
import { runSeed } from '@/server/db/seed';

runSeed()
  .catch((error) => {
    console.error('[seed] 初始化失败:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

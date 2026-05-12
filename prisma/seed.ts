import { config } from 'dotenv';

/**
 * Prisma seed 命令入口。
 *
 * 负责加载环境变量、执行基础数据初始化，并在结束后断开 Prisma 连接。
 */

config({ path: '.env' });
config({ path: '.env.local', override: true });

const [{ default: prisma }, { runSeed }] = await Promise.all([
  import('@/server/db/client'),
  import('@/server/db/seed'),
]);

runSeed()
  .catch((error) => {
    console.error('[seed] 初始化失败:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

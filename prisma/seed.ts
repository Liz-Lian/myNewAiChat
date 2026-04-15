import 'dotenv/config';

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

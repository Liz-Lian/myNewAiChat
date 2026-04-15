/**
 * User 数据访问仓储。
 *
 * 职责：
 * - 封装 User 表的常用读写操作。
 * - 对上层暴露语义化方法，避免路由层直接写 Prisma 查询。
 */
import prisma from '@/server/db/client';

type UpsertAdminUserInput = {
  email: string;
  name: string;
  passwordHash: string;
  siliconflowApiKey: string | null;
};

export const userRepository = {
  /**
   * 根据邮箱查询用户。
   */
  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: {
        email,
      },
    });
  },

  /**
   * 根据用户 ID 查询用户。
   */
  findById(id: string) {
    return prisma.user.findUnique({
      where: {
        id,
      },
    });
  },

  /**
   * 更新指定用户的 SiliconFlow API Key。
   */
  updateSiliconflowApiKey(userId: string, apiKey: string | null) {
    return prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        siliconflowApiKey: apiKey,
      },
      select: {
        id: true,
        siliconflowApiKey: true,
      },
    });
  },

  /**
   * 初始化或更新管理员账号。
   */
  upsertAdminUser(input: UpsertAdminUserInput) {
    return prisma.user.upsert({
      where: {
        email: input.email,
      },
      update: {
        name: input.name,
        passwordHash: input.passwordHash,
        siliconflowApiKey: input.siliconflowApiKey,
      },
      create: {
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        siliconflowApiKey: input.siliconflowApiKey,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  },
};

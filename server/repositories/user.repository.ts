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
   *
   * @param email 用户邮箱。
   * @returns 找到时返回用户记录，否则返回 `null`。
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
   *
   * @param id 用户 ID。
   * @returns 找到时返回用户记录，否则返回 `null`。
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
   *
   * @param userId 用户 ID。
   * @param apiKey 新 API Key；传入 `null` 表示清空。
   * @returns 更新后的用户 ID 和 API Key 字段。
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
   *
   * @param input 管理员账号初始化参数。
   * @returns 管理员用户基础信息。
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

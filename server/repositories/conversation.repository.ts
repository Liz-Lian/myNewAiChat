/**
 * Conversation 数据访问仓储。
 *
 * 职责：
 * - 管理会话的查询、创建、更新与删除。
 * - 封装用户归属校验所需的查询条件。
 */
import prisma from '@/server/db/client';

export const conversationRepository = {
  /**
   * 获取指定用户的会话列表（按更新时间倒序）。
   */
  listByUserId(userId: string) {
    return prisma.conversation.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  /**
   * 为指定用户创建会话。
   */
  createForUser(userId: string, title: string) {
    return prisma.conversation.create({
      data: {
        userId,
        title,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  /**
   * 查询指定用户是否拥有某个会话，并返回会话详情。
   */
  findOwnedById(userId: string, conversationId: string) {
    return prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  /**
   * 查询指定用户是否拥有某个会话，仅返回会话 ID。
   */
  findOwnedIdOnly(userId: string, conversationId: string) {
    return prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
      select: {
        id: true,
      },
    });
  },

  /**
   * 更新指定用户会话标题。
   */
  async updateTitleOwned(
    userId: string,
    conversationId: string,
    title: string,
  ) {
    const updated = await prisma.conversation.updateMany({
      where: {
        id: conversationId,
        userId,
      },
      data: {
        title,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  /**
   * 删除指定用户拥有的会话。
   */
  deleteOwned(userId: string, conversationId: string) {
    return prisma.conversation.deleteMany({
      where: {
        id: conversationId,
        userId,
      },
    });
  },

  /**
   * 刷新会话更新时间。
   */
  touch(conversationId: string) {
    return prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        updatedAt: new Date(),
      },
      select: {
        id: true,
      },
    });
  },
};

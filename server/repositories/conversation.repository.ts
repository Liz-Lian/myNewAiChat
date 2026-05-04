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
   *
   * @param userId 当前用户 ID。
   * @returns 当前用户的会话元信息列表。
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
   *
   * @param userId 当前用户 ID。
   * @param title 会话标题。
   * @returns 新建会话的元信息。
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
   *
   * @param userId 当前用户 ID。
   * @param conversationId 会话 ID。
   * @returns 找到时返回会话元信息，否则返回 `null`。
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
   *
   * @param userId 当前用户 ID。
   * @param conversationId 会话 ID。
   * @returns 找到时返回会话 ID 对象，否则返回 `null`。
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
   *
   * @param userId 当前用户 ID。
   * @param conversationId 会话 ID。
   * @param title 新会话标题。
   * @returns 更新后的会话元信息；会话不存在或不属于当前用户时返回 `null`。
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
   *
   * @param userId 当前用户 ID。
   * @param conversationId 会话 ID。
   * @returns Prisma deleteMany 的删除结果。
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
   *
   * @param conversationId 会话 ID。
   * @returns 被刷新的会话 ID。
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

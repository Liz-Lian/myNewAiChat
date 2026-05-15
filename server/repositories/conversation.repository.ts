/**
 * Conversation 数据访问仓储。
 *
 * 职责：
 * - 管理会话的查询、创建、更新与删除。
 * - 封装用户归属校验所需的查询条件。
 */
import prisma from '@/server/db/client';

type ConversationSummary = {
  id: string;
  title: string;
  isShared: boolean;
  sharedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ConversationMessage = {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  toolCalls: unknown;
  createdAt: Date;
};

type ConversationWithMessages = ConversationSummary & {
  userId: string;
  messages: ConversationMessage[];
};

type PublicSharedConversation = ConversationSummary & {
  shareToken: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  messages: ConversationMessage[];
};

export const conversationRepository = {
  /**
   * 获取指定用户的会话列表（按更新时间倒序）。
   *
   * @param userId 当前用户 ID。
   * @returns 当前用户的会话元信息列表。
   */
  listByUserId(userId: string) {
    return prisma.$queryRaw<ConversationSummary[]>`
      SELECT
        "id",
        "title",
        "isShared",
        "sharedAt",
        "createdAt",
        "updatedAt"
      FROM "Conversation"
      WHERE "userId" = ${userId}
      ORDER BY "updatedAt" DESC
    `;
  },

  /**
   * 为指定用户创建会话。
   *
   * @param userId 当前用户 ID。
   * @param title 会话标题。
   * @returns 新建会话的元信息。
   */
  async createForUser(userId: string, title: string) {
    const conversation = await prisma.conversation.create({
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

    return {
      ...conversation,
      isShared: false,
      sharedAt: null,
    };
  },

  /**
   * 查询指定用户是否拥有某个会话，并返回会话详情。
   *
   * @param userId 当前用户 ID。
   * @param conversationId 会话 ID。
   * @returns 找到时返回会话元信息，否则返回 `null`。
   */
  findOwnedById(userId: string, conversationId: string) {
    return prisma.$queryRaw<ConversationSummary[]>`
      SELECT
        "id",
        "title",
        "isShared",
        "sharedAt",
        "createdAt",
        "updatedAt"
      FROM "Conversation"
      WHERE "id" = ${conversationId} AND "userId" = ${userId}
      LIMIT 1
    `.then((rows) => rows[0] ?? null);
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

    return conversationRepository.findOwnedById(userId, conversationId);
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

  /**
   * 获取当前用户拥有的会话及其消息。
   *
   * @param userId 当前用户 ID。
   * @param conversationId 会话 ID。
   * @returns 找到时返回会话详情和消息列表，否则返回 `null`。
   */
  async findOwnedWithMessages(
    userId: string,
    conversationId: string,
  ): Promise<ConversationWithMessages | null> {
    const conversations = await prisma.$queryRaw<
      Array<ConversationSummary & { userId: string }>
    >`
      SELECT
        "id",
        "userId",
        "title",
        "isShared",
        "sharedAt",
        "createdAt",
        "updatedAt"
      FROM "Conversation"
      WHERE "id" = ${conversationId} AND "userId" = ${userId}
      LIMIT 1
    `;
    const conversation = conversations[0];

    if (!conversation) {
      return null;
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        conversationId: true,
        role: true,
        content: true,
        toolCalls: true,
        createdAt: true,
      },
    });

    return {
      ...conversation,
      messages,
    };
  },

  /**
   * 开启指定用户会话的公开分享。
   *
   * @param userId 当前用户 ID。
   * @param conversationId 会话 ID。
   * @param shareToken 新生成的分享 token。
   * @returns 更新后的分享字段；会话不存在或不属于当前用户时返回 `null`。
   */
  async enableShareOwned(
    userId: string,
    conversationId: string,
    shareToken: string,
  ) {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        shareToken: string | null;
        isShared: boolean;
        sharedAt: Date | null;
      }>
    >`
      UPDATE "Conversation"
      SET
        "shareToken" = ${shareToken},
        "isShared" = true,
        "sharedAt" = NOW()
      WHERE "id" = ${conversationId} AND "userId" = ${userId}
      RETURNING "id", "shareToken", "isShared", "sharedAt"
    `;

    return rows[0] ?? null;
  },

  /**
   * 取消指定用户会话的公开分享。
   *
   * @param userId 当前用户 ID。
   * @param conversationId 会话 ID。
   * @returns 更新后的分享字段；会话不存在或不属于当前用户时返回 `null`。
   */
  async disableShareOwned(userId: string, conversationId: string) {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        shareToken: string | null;
        isShared: boolean;
        sharedAt: Date | null;
      }>
    >`
      UPDATE "Conversation"
      SET
        "shareToken" = NULL,
        "isShared" = false,
        "sharedAt" = NULL
      WHERE "id" = ${conversationId} AND "userId" = ${userId}
      RETURNING "id", "shareToken", "isShared", "sharedAt"
    `;

    return rows[0] ?? null;
  },

  /**
   * 通过公开分享 token 获取会话详情。
   *
   * @param shareToken 公开分享 token。
   * @returns 分享有效时返回会话、分享者和消息列表，否则返回 `null`。
   */
  async findPublicSharedByToken(
    shareToken: string,
  ): Promise<PublicSharedConversation | null> {
    const conversations = await prisma.$queryRaw<
      Array<
        ConversationSummary & {
          userId: string;
          shareToken: string | null;
          ownerId: string;
          ownerName: string | null;
          ownerEmail: string;
        }
      >
    >`
      SELECT
        c."id",
        c."userId",
        c."title",
        c."shareToken",
        c."isShared",
        c."sharedAt",
        c."createdAt",
        c."updatedAt",
        u."id" AS "ownerId",
        u."name" AS "ownerName",
        u."email" AS "ownerEmail"
      FROM "Conversation" c
      INNER JOIN "User" u ON u."id" = c."userId"
      WHERE c."shareToken" = ${shareToken} AND c."isShared" = true
      LIMIT 1
    `;
    const conversation = conversations[0];

    if (!conversation) {
      return null;
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        conversationId: true,
        role: true,
        content: true,
        toolCalls: true,
        createdAt: true,
      },
    });

    return {
      id: conversation.id,
      title: conversation.title,
      shareToken: conversation.shareToken,
      isShared: conversation.isShared,
      sharedAt: conversation.sharedAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      user: {
        id: conversation.ownerId,
        name: conversation.ownerName,
        email: conversation.ownerEmail,
      },
      messages,
    };
  },
};

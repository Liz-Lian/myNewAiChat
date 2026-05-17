/**
 * Message 数据访问仓储。
 *
 * 职责：
 * - 管理消息写入。
 * - 提供按会话时间序读取消息能力。
 */
import { Prisma } from '@/app/generated/prisma/client';
import prisma from '@/server/db/client';

type MessageRole = 'user' | 'assistant';

type CreateMessageInput = {
  conversationId: string;
  role: MessageRole;
  content: string;
  toolCalls?: Prisma.InputJsonValue;
};

export const messageRepository = {
  /**
   * 创建一条消息记录。
   *
   * @param input 消息创建参数。
   * @returns 新建消息的完整展示字段。
   */
  create(input: CreateMessageInput) {
    return prisma.message.create({
      data: {
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        toolCalls: input.toolCalls,
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
  },

  /**
   * 创建一条空的 assistant 占位消息，用于提前获得稳定 messageId。
   *
   * @param conversationId 会话 ID。
   * @returns 新建的 assistant 消息。
   */
  createAssistantPlaceholder(conversationId: string) {
    return messageRepository.create({
      conversationId,
      role: 'assistant',
      content: '',
    });
  },

  /**
   * 将增量内容追加到指定 assistant 消息。
   *
   * @param messageId 消息 ID。
   * @param content 需要追加的内容。
   * @returns 更新后的消息；消息不存在或不是 assistant 时返回 `null`。
   */
  async appendContent(messageId: string, content: string) {
    if (!content) {
      return prisma.message.findFirst({
        where: {
          id: messageId,
          role: 'assistant',
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
    }

    const updated = await prisma.$executeRaw`
      UPDATE "Message"
      SET "content" = "content" || ${content}
      WHERE "id" = ${messageId} AND "role" = 'assistant'
    `;

    if (updated === 0) {
      return null;
    }

    return prisma.message.findUnique({
      where: {
        id: messageId,
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
  },

  /**
   * 覆盖指定 assistant 消息的完整内容。
   *
   * @param messageId 消息 ID。
   * @param content 完整 assistant 内容。
   * @returns 更新后的消息；消息不存在或不是 assistant 时返回 `null`。
   */
  async updateContent(messageId: string, content: string) {
    const updated = await prisma.message.updateMany({
      where: {
        id: messageId,
        role: 'assistant',
      },
      data: {
        content,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.message.findUnique({
      where: {
        id: messageId,
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
  },

  /**
   * 更新指定 user 消息内容。
   *
   * @param messageId 消息 ID。
   * @param content 新用户消息内容。
   * @returns 更新后的消息；消息不存在或不是 user 时返回 `null`。
   */
  async updateUserContent(messageId: string, content: string) {
    const updated = await prisma.message.updateMany({
      where: {
        id: messageId,
        role: 'user',
      },
      data: {
        content,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.message.findUnique({
      where: {
        id: messageId,
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
  },

  /**
   * 删除指定消息之后的所有消息。
   *
   * @param conversationId 会话 ID。
   * @param messageId 作为截断锚点的消息 ID。
   * @returns 删除结果；锚点不存在于会话中时返回 `null`。
   */
  async deleteAfterMessage(conversationId: string, messageId: string) {
    const anchor = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      select: {
        createdAt: true,
      },
    });

    if (!anchor) {
      return null;
    }

    return prisma.message.deleteMany({
      where: {
        conversationId,
        createdAt: {
          gt: anchor.createdAt,
        },
      },
    });
  },

  /**
   * 删除指定消息及其之后的所有消息。
   *
   * @param conversationId 会话 ID。
   * @param messageId 作为截断起点的消息 ID。
   * @returns 删除结果；锚点不存在于会话中时返回 `null`。
   */
  async deleteFromMessage(conversationId: string, messageId: string) {
    const anchor = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
      },
      select: {
        createdAt: true,
      },
    });

    if (!anchor) {
      return null;
    }

    return prisma.message.deleteMany({
      where: {
        conversationId,
        createdAt: {
          gte: anchor.createdAt,
        },
      },
    });
  },

  /**
   * 按时间升序获取会话消息。
   *
   * @param conversationId 会话 ID。
   * @returns 指定会话下按创建时间升序排列的消息列表。
   */
  listByConversation(conversationId: string) {
    return prisma.message.findMany({
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
  },
};

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
   * 按时间升序获取会话消息。
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

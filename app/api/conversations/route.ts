/**
 * 会话集合接口（Conversation Collection）
 *
 * 职责：
 * - GET: 获取当前登录用户的会话列表（按最近更新时间倒序）。
 * - POST: 为当前登录用户创建新会话。
 *
 * 安全约束：
 * - 所有入口先鉴权。
 * - 所有数据库读写都使用 userId 过滤，避免跨用户访问。
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  createJsonError,
  createUnauthorizedResponse,
  requireCurrentUserId,
} from '@/server/auth/utils';
import { conversationRepository } from '@/server/repositories/conversation.repository';

export const runtime = 'nodejs';

const createConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '标题不能为空')
    .max(120, '标题不能超过 120 个字符')
    .optional(),
});

/**
 * 获取当前登录用户的会话列表。
 *
 * 只返回当前用户拥有的会话元信息，并按最近更新时间倒序排列。
 *
 * @param req 当前请求，用于读取会话 Cookie。
 * @returns 会话列表响应；未登录或失败时返回结构化 JSON 错误。
 */
export async function GET(req: Request) {
  try {
    // 只要能拿到用户 ID，后面的仓储查询就会自动限定当前用户的数据。
    const userId = await requireCurrentUserId(req);

    // 侧边栏只需要会话摘要，不返回消息正文，减少列表接口负担。
    const conversations = await conversationRepository.listByUserId(userId);

    return NextResponse.json(
      {
        conversations,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === '请先登录') {
      return createUnauthorizedResponse();
    }

    console.error('List Conversations Error:', error);
    return createJsonError('获取会话列表失败，请稍后重试', 500);
  }
}

/**
 * 为当前登录用户创建新会话。
 *
 * 请求体可以传入可选标题；未传标题时使用“新对话”。
 *
 * @param req 创建会话请求，body 可包含 title。
 * @returns 创建成功时返回新会话元信息；失败时返回结构化 JSON 错误。
 */
export async function POST(req: Request) {
  try {
    // 创建会话必须绑定登录用户，不能接受客户端传来的 userId。
    const userId = await requireCurrentUserId(req);

    // 空请求体也允许创建默认“新对话”，所以解析失败时回退成空对象。
    const body = await req.json().catch(() => null);
    const parsed = createConversationSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return createJsonError(
        '请求参数不合法',
        400,
        parsed.error.issues[0]?.message || '请检查会话标题',
      );
    }

    // 标题没传时后端兜底，保证数据库里不会出现空标题。
    const conversation = await conversationRepository.createForUser(
      userId,
      parsed.data.title || '新对话',
    );

    return NextResponse.json(
      {
        conversation,
      },
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === '请先登录') {
      return createUnauthorizedResponse();
    }

    console.error('Create Conversation Error:', error);
    return createJsonError('创建会话失败，请稍后重试', 500);
  }
}

/**
 * 本文件实现 /api/user/siliconflow-key 接口的 Next.js Route Handler。
 */
import { z } from 'zod';

import {
  createJsonError,
  createUnauthorizedResponse,
  requireCurrentUserId,
} from '@/server/auth/utils';
import { userRepository } from '@/server/repositories/user.repository';

export const runtime = 'nodejs';

const updateSiliconFlowApiKeySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .max(512, 'API Key 长度不能超过 512 个字符')
    .nullable(),
});

/**
 * 更新当前登录用户的 SiliconFlow API Key。
 *
 * 传入空字符串或 `null` 时会清空配置；成功响应只返回是否已配置，
 * 不回显完整 API Key。
 *
 * @param req 更新请求，body 需包含 apiKey 字段。
 * @returns 更新结果与 hasApiKey 标记；未登录或失败时返回结构化 JSON 错误。
 */
export async function PATCH(req: Request) {
  try {
    // API Key 只能写到当前登录用户，不能接受客户端指定用户 ID。
    const userId = await requireCurrentUserId(req);
    const body = await req.json().catch(() => null);
    const parsed = updateSiliconFlowApiKeySchema.safeParse(body);

    if (!parsed.success) {
      return createJsonError(
        '请求参数不合法',
        400,
        parsed.error.issues[0]?.message || '请检查 API Key 参数',
      );
    }

    // 空字符串按清空处理，非空值才写入数据库。
    const normalizedApiKey = parsed.data.apiKey?.trim() || null;

    await userRepository.updateSiliconflowApiKey(userId, normalizedApiKey);

    // 出于安全考虑，响应只告诉前端是否已配置，不回显完整 API Key。
    return Response.json(
      {
        message: normalizedApiKey ? 'API Key 已更新' : 'API Key 已清空',
        hasApiKey: Boolean(normalizedApiKey),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === '请先登录') {
      return createUnauthorizedResponse();
    }

    console.error('Update SiliconFlow API Key Error:', error);
    return createJsonError('更新 API Key 失败，请稍后重试', 500);
  }
}

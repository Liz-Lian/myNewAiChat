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

export async function PATCH(req: Request) {
  try {
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

    const normalizedApiKey = parsed.data.apiKey?.trim() || null;

    await userRepository.updateSiliconflowApiKey(userId, normalizedApiKey);

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

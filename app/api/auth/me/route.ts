import { NextResponse } from 'next/server';

import {
  clearSessionCookie,
  createUnauthorizedResponse,
  getCurrentUserId,
} from '@/server/auth/utils';
import { userRepository } from '@/server/repositories/user.repository';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId(req);

    if (!userId) {
      const response = createUnauthorizedResponse();
      clearSessionCookie(response);
      return response;
    }

    const user = await userRepository.findById(userId);

    if (!user) {
      const response = createUnauthorizedResponse();
      clearSessionCookie(response);
      return response;
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('Me Error:', error);
    return createUnauthorizedResponse('会话已失效，请重新登录');
  }
}

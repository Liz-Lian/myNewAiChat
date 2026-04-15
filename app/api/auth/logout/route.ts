import { NextResponse } from 'next/server';

import { clearSessionCookie, createJsonError } from '@/server/auth/utils';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const response = NextResponse.json(
      {
        message: '已登出',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );

    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error('Logout Error:', error);
    return createJsonError('登出失败，请稍后重试', 500);
  }
}

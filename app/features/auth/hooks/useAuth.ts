/**
 * 前端认证状态 Hook，用于检查当前登录态并执行登录。
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

type AuthError = {
  error?: string;
  details?: string;
};

/**
 * 读取接口错误文案。
 *
 * @param response fetch 响应。
 * @param fallback 兜底文案。
 * @returns 错误文案。
 */
async function readAuthError(
  response: Response,
  fallback: string,
): Promise<string> {
  const payload = (await response.json().catch(() => null)) as AuthError | null;
  return payload?.details || payload?.error || fallback;
}

/**
 * 管理当前用户认证状态。
 *
 * @returns 当前用户、认证状态和登录方法。
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    setStatus('checking');
    setError(null);

    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
      });

      if (!response.ok) {
        setUser(null);
        setStatus('unauthenticated');
        return;
      }

      const payload = (await response.json()) as { user: AuthUser };
      setUser(payload.user);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoggingIn(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const message = await readAuthError(response, '登录失败');
        setError(message);
        setStatus('unauthenticated');
        return false;
      }

      const payload = (await response.json()) as { user: AuthUser };
      setUser(payload.user);
      setStatus('authenticated');
      return true;
    } catch {
      setError('登录失败，请稍后重试');
      setStatus('unauthenticated');
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  return {
    user,
    status,
    isChecking: status === 'checking',
    isAuthenticated: status === 'authenticated',
    isLoggingIn,
    error,
    login,
    checkAuth,
  };
}

export type { AuthUser };

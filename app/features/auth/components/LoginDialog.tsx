/**
 * 登录弹窗组件，用于未登录时阻塞主界面并提交账号密码。
 */
'use client';

import { ComponentProps, useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface LoginDialogProps {
  open: boolean;
  loading?: boolean;
  error?: string | null;
  onLogin: (email: string, password: string) => Promise<boolean>;
}

export function LoginDialog({
  open,
  loading = false,
  error,
  onLogin,
}: LoginDialogProps) {
  // 邮箱和密码只保存在弹窗本地状态，提交成功后清空密码。
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit: ComponentProps<'form'>['onSubmit'] = async (event) => {
    // 阻止浏览器刷新页面，并在字段不完整或正在登录时忽略提交。
    event.preventDefault();
    if (!email.trim() || !password || loading) {
      return;
    }

    const success = await onLogin(email.trim(), password);
    if (success) {
      setPassword('');
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="max-w-sm rounded-[1.75rem]"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>登录后继续</DialogTitle>
          <DialogDescription>使用已有账号进入你的聊天会话。</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="login-email" className="text-sm font-medium">
              邮箱
            </label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="login-password" className="text-sm font-medium">
              密码
            </label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              autoComplete="current-password"
              placeholder="输入密码"
            />
          </div>
          {error ? (
            <p className="border-destructive/20 bg-destructive/10 text-destructive rounded-2xl border px-3 py-2 text-sm">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full gap-2 rounded-2xl"
            disabled={loading || !email.trim() || !password}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {loading ? '登录中' : '登录'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * copy-button.tsx
 * 复制按钮组件
 * 用于复制代码块中的代码到剪贴板。
 * 点击后按钮显示"已复制"验证，2秒后恢复原样。
 */

'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface CopyButtonProps {
  code: string;
  className?: string;
}

export function CopyButton({ code, className }: CopyButtonProps) {
  // copied 只控制按钮上的短暂“已复制”反馈。
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const handleCopy = async () => {
    // 空代码块不触发剪贴板写入，避免覆盖用户已有剪贴板内容。
    if (!code) {
      return;
    }

    await navigator.clipboard.writeText(code);
    setCopied(true);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 opacity-0 transition group-hover/codeblock:opacity-100 hover:bg-white/10 hover:text-white',
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          已复制
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </>
      )}
    </button>
  );
}

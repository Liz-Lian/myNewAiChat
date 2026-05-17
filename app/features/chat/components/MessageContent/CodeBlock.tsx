/**
 * code-block.tsx
 * 代码块渲染组件
 * 用于显示代码片段，支持行内代码和代码块两种模式。
 * - 行内代码：简单的灰色背景样式
 * - 代码块：带语言标签和复制按钮的完整代码编辑器样式
 */

import { isValidElement, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { CopyButton } from './CopyButton';

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * 从CSS类名中提取编程语言标识
 * 例如："language-javascript" -> "javascript"
 */
function getLanguage(className?: string) {
  // react-markdown 会把代码语言放进 language-xxx className。
  const match = /language-([\w-]+)/.exec(className ?? '');
  return match?.[1] ?? 'code';
}

/**
 * 从React子节点中提取代码字符串
 * 处理字符串、数组和其他类型的节点
 */
function extractText(node: ReactNode): string {
  // 代码内容可能被 react-markdown 拆成字符串、数字或嵌套节点，需要递归取文本。
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }

  return '';
}

function getCodeString(children: ReactNode) {
  // react-markdown 会把代码语言放进 language-xxx className。
  return extractText(children);
}

export function CodeBlock({ inline, className, children }: CodeBlockProps) {
  // 去掉代码块末尾多余换行，避免复制时多带一个空行。
  const code = getCodeString(children).replace(/\n$/, '');
  const isInline = inline ?? !className?.includes('language-');

  if (isInline) {
    return (
      <code
        className={cn(
          'border-border/60 bg-muted/70 text-foreground rounded-lg border px-1.5 py-0.5 font-mono text-[0.92em]',
          className,
        )}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="group/codeblock border-border/70 my-3 overflow-hidden rounded-2xl border bg-slate-950 shadow-[0_16px_50px_rgba(15,23,42,0.14)] dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-2">
        <span className="text-xs font-medium tracking-wider text-slate-300 uppercase">
          {getLanguage(className)}
        </span>
        <CopyButton code={code} />
      </div>
      <pre className="overflow-x-auto p-0 text-slate-100">
        <code
          className={cn(
            'hljs block bg-transparent px-4 py-3 font-mono text-sm leading-6',
            className,
          )}
        >
          {children}
        </code>
      </pre>
    </div>
  );
}

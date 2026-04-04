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
  const match = /language-([\w-]+)/.exec(className ?? '');
  return match?.[1] ?? 'code';
}

/**
 * 从React子节点中提取代码字符串
 * 处理字符串、数组和其他类型的节点
 */
function extractText(node: ReactNode): string {
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
  return extractText(children);
}

export function CodeBlock({ inline, className, children }: CodeBlockProps) {
  // 提取代码字符串并移除末尾的换行符
  const code = getCodeString(children).replace(/\n$/, '');
  // 判断是否为行内模式：显式设置或根据是否有语言类名推断
  const isInline = inline ?? !className?.includes('language-');

  // 行内代码样式
  if (isInline) {
    return (
      <code
        className={cn(
          'rounded-md bg-slate-200 px-1.5 py-0.5 font-mono text-[0.92em] text-slate-900 dark:bg-white/10 dark:text-slate-100',
          className,
        )}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="group/codeblock my-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-2">
        <span className="text-xs font-medium tracking-wider text-slate-300 uppercase dark:text-slate-300">
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

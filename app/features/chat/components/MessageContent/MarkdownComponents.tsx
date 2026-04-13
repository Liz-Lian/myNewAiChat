/**
 * markdown-components.tsx
 * Markdown渲染配置
 * 负责定义 React Markdown 的自定义元素渲染规则，
 * 并根据消息角色（用户/助手）切换视觉样式。
 */

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { type Components, type ExtraProps } from 'react-markdown';

import { cn } from '@/lib/utils';

import { CodeBlock } from './CodeBlock';

type MessageRole = 'user' | 'assistant';

type MarkdownCodeProps = ComponentPropsWithoutRef<'code'> &
  ExtraProps & {
    inline?: boolean;
    children?: ReactNode;
  };

/**
 * 根据消息角色创建自定义的Markdown渲染组件
 * 为用户消息和AI消息应用不同的颜色方案
 */
export function createMarkdownComponents(role: MessageRole): Components {
  const isUser = role === 'user';
  const textClass = isUser ? 'text-primary-foreground' : 'text-foreground';
  const mutedTextClass = isUser
    ? 'text-primary-foreground/85'
    : 'text-muted-foreground';
  const linkClass = isUser
    ? 'text-primary-foreground underline underline-offset-4 decoration-primary-foreground/70 hover:decoration-primary-foreground'
    : 'text-primary underline underline-offset-4 decoration-primary/60 hover:decoration-primary';

  return {
    h1: ({ children }) => (
      <h1
        className={cn(
          'mt-4 text-2xl font-semibold tracking-tight first:mt-0',
          textClass,
        )}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className={cn(
          'mt-4 text-xl font-semibold tracking-tight first:mt-0',
          textClass,
        )}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className={cn(
          'mt-4 text-lg font-semibold tracking-tight first:mt-0',
          textClass,
        )}
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4
        className={cn(
          'mt-4 text-base font-semibold tracking-tight first:mt-0',
          textClass,
        )}
      >
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5
        className={cn(
          'mt-4 text-sm font-semibold tracking-tight first:mt-0',
          textClass,
        )}
      >
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6
        className={cn(
          'mt-4 text-sm font-semibold tracking-tight first:mt-0',
          textClass,
        )}
      >
        {children}
      </h6>
    ),
    p: ({ children }) => (
      <p className={cn('leading-7 whitespace-pre-wrap', mutedTextClass)}>
        {children}
      </p>
    ),
    strong: ({ children }) => (
      <strong className={cn('font-semibold', textClass)}>{children}</strong>
    ),
    em: ({ children }) => (
      <em className={cn('italic', textClass)}>{children}</em>
    ),
    a: ({ children, href, ...props }) => (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={linkClass}
      >
        {children}
      </a>
    ),
    blockquote: ({ children }) => (
      <blockquote
        className={cn(
          'my-3 border-l-4 border-current/20 pl-4 italic',
          mutedTextClass,
        )}
      >
        {children}
      </blockquote>
    ),
    ul: ({ children }) => (
      <ul className={cn('my-3 list-disc space-y-1 pl-6', mutedTextClass)}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className={cn('my-3 list-decimal space-y-1 pl-6', mutedTextClass)}>
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-7">{children}</li>,
    hr: () => <hr className={cn('my-4 border-current/15', mutedTextClass)} />,
    table: ({ children }) => (
      <div className="my-3 w-full overflow-x-auto">
        <table
          className={cn(
            'w-full border-collapse text-left text-sm',
            mutedTextClass,
          )}
        >
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-current/5">{children}</thead>,
    th: ({ children }) => (
      <th
        className={cn(
          'border border-current/10 px-3 py-2 font-semibold',
          textClass,
        )}
      >
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td
        className={cn(
          'border border-current/10 px-3 py-2 align-top',
          mutedTextClass,
        )}
      >
        {children}
      </td>
    ),
    pre: ({ children }) => <>{children}</>,
    code: ({ inline, className, children }: MarkdownCodeProps) => {
      if (inline) {
        return (
          <CodeBlock inline className={className}>
            {children}
          </CodeBlock>
        );
      }

      return <CodeBlock className={className}>{children}</CodeBlock>;
    },
  };
}

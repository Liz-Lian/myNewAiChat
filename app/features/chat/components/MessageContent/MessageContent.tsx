/**
 * message-content.tsx
 * 消息内容渲染组件
 * 使用React Markdown将消息文本渲染为富文本内容，
 * 支持GFM语法和代码高亮。
 */

'use client';

import rehypeHighlight from 'rehype-highlight';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

import { createMarkdownComponents } from './MarkdownComponents';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';
}

export function MessageContent({ content, role }: MessageContentProps) {
  return (
    <div
      className={cn(
        'min-w-0 text-sm leading-7 break-words',
        role === 'user' ? 'text-white' : 'text-slate-900',
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={createMarkdownComponents(role)}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

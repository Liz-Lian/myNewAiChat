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
  // ReactMarkdown 负责解析 GFM 和代码高亮，具体标签样式交给 createMarkdownComponents。
  return (
    <div
      className={cn(
        'min-w-0 text-sm leading-7 wrap-break-word',
        role === 'user' ? 'text-primary-foreground' : 'text-foreground',
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

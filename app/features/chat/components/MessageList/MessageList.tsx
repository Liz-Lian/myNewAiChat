/**
 * message-list.tsx
 * 消息列表组件
 * 显示用户和助手之间的对话历史。
 * - 用户消息对齐到右侧，蓝色背景
 * - 助手消息对齐到左侧，灰色背景
 * - 加载状态下显示动画加载指示器
 */

import { MessageContent } from '@/app/features/chat/components/MessageContent';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="min-h-0 flex-1">
      <ScrollArea className="h-full bg-white">
        <div className="space-y-4 p-6">
          {/* 空状态：显示欢迎提示 */}
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-slate-400">
                <div className="mb-2 text-4xl">💬</div>
                <p className="text-sm">开始聊天吧！</p>
              </div>
            </div>
          ) : (
            // 渲染消息列表：用户消息靠右蓝色，AI消息靠左灰色
            messages.map((message, idx) => (
              <div
                key={message.id || idx}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xl rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  <MessageContent
                    content={message.content}
                    role={message.role}
                  />
                </div>
              </div>
            ))
          )}

          {/* 加载状态：显示动画加载指示器 */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-slate-100 px-4 py-3">
                {/* 三个跳跃的圆点动画 */}
                <div className="flex gap-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 delay-100" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 delay-200" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

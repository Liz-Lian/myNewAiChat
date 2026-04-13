'use client';

/**
 * message-list.tsx
 * 消息列表组件
 * 显示用户和助手之间的对话历史。
 * - 用户消息对齐到右侧，蓝色背景
 * - 助手消息对齐到左侧，灰色背景
 * - 加载状态下显示动画加载指示器
 */

import { Loader2, Pause, Play, Square, Volume2 } from 'lucide-react';

import { useSpeechPlayback } from '@/app/features/chat/hooks/useSpeechPlayback';
import { MessageContent } from '@/app/features/chat/components/MessageContent';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
  const playback = useSpeechPlayback();

  return (
    <div className="min-h-0 flex-1">
      <ScrollArea className="h-full bg-white">
        <div className="space-y-4 p-6">
          {playback.error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {playback.error}
            </p>
          ) : null}
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-slate-400">
                <div className="mb-2 text-4xl">💬</div>
                <p className="text-sm">开始聊天吧！</p>
              </div>
            </div>
          ) : (
            messages.map((message, idx) => {
              const messageKey = message.id || String(idx);
              const isActive = playback.activeKey === messageKey;

              return (
                <div
                  key={message.id || idx}
                  className={cn(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-xl rounded-lg px-4 py-3',
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 text-slate-900',
                    )}
                  >
                    <MessageContent
                      content={message.content}
                      role={message.role}
                    />
                    {message.role === 'assistant' ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {isActive && playback.status === 'loading' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled
                            className="gap-2"
                          >
                            <Loader2 className="h-4 w-4 animate-spin" />
                            生成中
                          </Button>
                        ) : isActive && playback.status === 'playing' ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={playback.pause}
                              className="gap-2"
                            >
                              <Pause className="h-4 w-4" />
                              暂停
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={playback.stop}
                              className="gap-2"
                            >
                              <Square className="h-4 w-4" />
                              停止
                            </Button>
                            <span className="text-xs text-slate-500">
                              朗读中
                            </span>
                          </>
                        ) : isActive && playback.status === 'paused' ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void playback.playSpeech({
                                  key: messageKey,
                                  text: message.content,
                                })
                              }
                              className="gap-2"
                            >
                              <Play className="h-4 w-4" />
                              继续
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={playback.stop}
                              className="gap-2"
                            >
                              <Square className="h-4 w-4" />
                              停止
                            </Button>
                            <span className="text-xs text-slate-500">
                              已暂停
                            </span>
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void playback.playSpeech({
                                key: messageKey,
                                text: message.content,
                              })
                            }
                            className="gap-2"
                          >
                            <Volume2 className="h-4 w-4" />
                            朗读
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-slate-100 px-4 py-3">
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

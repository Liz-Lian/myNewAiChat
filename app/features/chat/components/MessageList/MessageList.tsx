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
      <ScrollArea className="h-full bg-transparent">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
          {playback.error ? (
            <p className="border-destructive/20 bg-destructive/10 text-destructive rounded-2xl border px-4 py-3 text-sm">
              {playback.error}
            </p>
          ) : null}
          {messages.length === 0 ? (
            <div className="flex min-h-[55vh] items-center justify-center">
              <div className="border-border/60 bg-card/80 max-w-md rounded-[2rem] border px-8 py-10 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 via-blue-500 to-indigo-500 text-2xl shadow-lg shadow-blue-500/20">
                  💬
                </div>
                <h2 className="text-foreground text-lg font-semibold tracking-tight">
                  从一句话开始
                </h2>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  像 Gemini
                  一样，先提问、再补充细节。你可以直接输入需求，或者试试左侧的新对话。
                </p>
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
                      'group relative max-w-[min(46rem,92%)] rounded-[1.75rem] px-5 py-4 shadow-sm ring-1',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground shadow-primary/15 ring-primary/15'
                        : 'border-border/60 bg-card/90 text-card-foreground ring-border/70 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl',
                    )}
                  >
                    <MessageContent
                      content={message.content}
                      role={message.role}
                    />
                    {message.role === 'assistant' ? (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {isActive && playback.status === 'loading' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled
                            className="gap-2 rounded-full"
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
                              className="gap-2 rounded-full"
                            >
                              <Pause className="h-4 w-4" />
                              暂停
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={playback.stop}
                              className="gap-2 rounded-full"
                            >
                              <Square className="h-4 w-4" />
                              停止
                            </Button>
                            <span className="text-muted-foreground text-xs">
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
                              className="gap-2 rounded-full"
                            >
                              <Play className="h-4 w-4" />
                              继续
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={playback.stop}
                              className="gap-2 rounded-full"
                            >
                              <Square className="h-4 w-4" />
                              停止
                            </Button>
                            <span className="text-muted-foreground text-xs">
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
                            className="gap-2 rounded-full"
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
              <div className="border-border/60 bg-card/90 rounded-[1.5rem] border px-4 py-3 shadow-sm backdrop-blur-xl">
                <div className="flex gap-1.5">
                  <div className="bg-muted-foreground/60 h-2.5 w-2.5 animate-bounce rounded-full" />
                  <div className="bg-muted-foreground/60 h-2.5 w-2.5 animate-bounce rounded-full delay-100" />
                  <div className="bg-muted-foreground/60 h-2.5 w-2.5 animate-bounce rounded-full delay-200" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

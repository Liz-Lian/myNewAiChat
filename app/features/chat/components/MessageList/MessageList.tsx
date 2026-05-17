'use client';

/**
 * message-list.tsx
 * 消息列表组件
 * 显示用户和助手之间的对话历史。
 * - 用户消息对齐到右侧，蓝色背景
 * - 助手消息对齐到左侧，灰色背景
 * - 加载状态下显示动画加载指示器
 */

import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  Check,
  Loader2,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  ArrowDown,
  Sparkles,
  Square,
  Volume2,
  X,
} from 'lucide-react';

import { useSpeechPlayback } from '@/app/features/chat/hooks/useSpeechPlayback';
import { MessageContent } from '@/app/features/chat/components/MessageContent';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  hasError?: boolean;
  isComplete?: boolean;
}

interface MessageListProps {
  messages: Message[];
  conversationId?: string | null;
  isGenerating?: boolean;
  streamingMessageId?: string | null;
  onContinueGeneration?: (messageId: string) => Promise<void>;
  onRetryMessage?: (messageId: string) => Promise<void>;
  onEditAndResend?: (messageId: string, content: string) => Promise<void>;
}

export function MessageList({
  messages,
  conversationId,
  isGenerating,
  streamingMessageId,
  onContinueGeneration,
  onRetryMessage,
  onEditAndResend,
}: MessageListProps) {
  const playback = useSpeechPlayback();
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const lastMessageContent = messages.at(-1)?.content ?? '';

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({
      block: 'end',
    });
  };

  // 当用户滚动时，更新是否应该自动滚动到底部的状态
  const updateScrollFollowState = () => {
    const viewport = scrollContainerRef.current;
    if (!viewport) {
      return;
    }

    const distanceToBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const isNearBottom = distanceToBottom < 96;

    shouldAutoScrollRef.current = isNearBottom;
    setShowScrollToBottom(!isNearBottom);
  };
  // 切换会话时自动滚动到底部
  useEffect(() => {
    shouldAutoScrollRef.current = true;
    requestAnimationFrame(() => {
      setShowScrollToBottom(false);
      scrollToBottom();
    });
  }, [conversationId]);
  // 消息更新时按用户当前阅读位置决定要不要跟随滚动
  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    requestAnimationFrame(scrollToBottom);
  }, [conversationId, messages.length, lastMessageContent]);

  const startEditing = (message: Message) => {
    if (!message.id || isGenerating) {
      return;
    }

    setEditingMessageId(message.id);
    setEditingContent(message.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const submitEditing = async (messageId: string) => {
    const nextContent = editingContent.trim();
    if (!nextContent || isGenerating) {
      return;
    }

    await onEditAndResend?.(messageId, nextContent);
    cancelEditing();
  };

  const handleEditKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
    messageId: string,
  ) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditing();
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitEditing(messageId);
    }
  };

  return (
    <div className="relative min-h-0 flex-1">
      <ScrollArea
        className="h-full bg-transparent"
        viewportRef={scrollContainerRef}
        viewportProps={{
          onScroll: updateScrollFollowState,
        }}
      >
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
              const isEditing =
                Boolean(message.id) && editingMessageId === message.id;
              const isStreamingThisMessage =
                Boolean(message.id) && streamingMessageId === message.id;
              const hasContent = Boolean(message.content.trim());
              const canContinue =
                message.role === 'assistant' &&
                Boolean(message.id) &&
                message.isComplete === false &&
                !isStreamingThisMessage;

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
                    {isEditing && message.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editingContent}
                          onChange={(event) =>
                            setEditingContent(event.target.value)
                          }
                          onKeyDown={(event) =>
                            handleEditKeyDown(event, message.id || '')
                          }
                          className="border-primary/25 bg-background/90 text-foreground focus-visible:ring-primary/30 min-h-28 w-full resize-y rounded-2xl border px-4 py-3 text-sm leading-6 shadow-inner outline-none focus-visible:ring-2"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                            className="gap-2 rounded-full"
                          >
                            <X className="h-4 w-4" />
                            取消
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void submitEditing(message.id || '')}
                            disabled={!editingContent.trim() || isGenerating}
                            className="gap-2 rounded-full"
                          >
                            <Check className="h-4 w-4" />
                            发送
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <MessageContent
                        content={message.content}
                        role={message.role}
                      />
                    )}
                    {message.role === 'user' && message.id && !isEditing ? (
                      <div className="absolute -top-3 right-3 flex translate-y-1 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          onClick={() => startEditing(message)}
                          disabled={isGenerating}
                          className="bg-background/95 text-foreground hover:bg-accent rounded-full shadow-sm backdrop-blur"
                          title="编辑并重新发送"
                          aria-label="编辑并重新发送"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                    {message.role === 'assistant' ? (
                      <div className="absolute -top-3 left-3 flex translate-y-1 flex-wrap items-center gap-1.5 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                        {canContinue ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() =>
                              void onContinueGeneration?.(message.id || '')
                            }
                            disabled={isGenerating || isStreamingThisMessage}
                            className="bg-background/95 rounded-full shadow-sm backdrop-blur"
                            title="继续生成"
                            aria-label="继续生成"
                          >
                            {isStreamingThisMessage ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                          </Button>
                        ) : null}
                        {message.hasError && message.id ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() =>
                              void onRetryMessage?.(message.id || '')
                            }
                            disabled={isGenerating}
                            className="bg-background/95 rounded-full shadow-sm backdrop-blur"
                            title="重试"
                            aria-label="重试"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {isActive && playback.status === 'loading' ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            disabled
                            className="bg-background/95 rounded-full shadow-sm backdrop-blur"
                            title="朗读生成中"
                            aria-label="朗读生成中"
                          >
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </Button>
                        ) : isActive && playback.status === 'playing' ? (
                          <>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={playback.pause}
                              className="bg-background/95 rounded-full shadow-sm backdrop-blur"
                              title="暂停朗读"
                              aria-label="暂停朗读"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={playback.stop}
                              className="bg-background/95 rounded-full shadow-sm backdrop-blur"
                              title="停止朗读"
                              aria-label="停止朗读"
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          </>
                        ) : isActive && playback.status === 'paused' ? (
                          <>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() =>
                                void playback.playSpeech({
                                  key: messageKey,
                                  text: message.content,
                                })
                              }
                              className="bg-background/95 rounded-full shadow-sm backdrop-blur"
                              title="继续朗读"
                              aria-label="继续朗读"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={playback.stop}
                              className="bg-background/95 rounded-full shadow-sm backdrop-blur"
                              title="停止朗读"
                              aria-label="停止朗读"
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          </>
                        ) : hasContent ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() =>
                              void playback.playSpeech({
                                key: messageKey,
                                text: message.content,
                              })
                            }
                            className="bg-background/95 rounded-full shadow-sm backdrop-blur"
                            title="朗读"
                            aria-label="朗读"
                          >
                            <Volume2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}

          {isGenerating && (
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
          <div ref={bottomRef} aria-hidden="true" />
        </div>
      </ScrollArea>
      {showScrollToBottom ? (
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={() => {
            shouldAutoScrollRef.current = true;
            setShowScrollToBottom(false);
            scrollToBottom();
          }}
          className="bg-background/95 absolute right-5 bottom-5 rounded-full shadow-lg backdrop-blur"
          aria-label="回到底部"
          title="回到底部"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

/**
 * 本文件实现分享会话页面，用于展示公开分享的聊天内容。
 */
import { MessageContent } from '@/app/features/chat/components/MessageContent';
import { cn } from '@/lib/utils';
import { conversationRepository } from '@/server/repositories/conversation.repository';

type SharedMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: unknown;
  createdAt: string;
};

type SharedConversation = {
  title: string;
  sharedAt: string | null;
  createdAt: string;
  owner: {
    name: string | null;
    email: string;
  };
  messages: SharedMessage[];
};

type SharePageProps = {
  params: Promise<{
    shareToken: string;
  }>;
};

/**
 * 读取公开分享会话。
 *
 * @param shareToken 分享 token。
 * @returns 分享会话详情；不存在时返回 `null`。
 */
async function getSharedConversation(
  shareToken: string,
): Promise<SharedConversation | null> {
  // 先读取必要输入，再返回规范化后的查询结果。
  const conversation =
    await conversationRepository.findPublicSharedByToken(shareToken);

  if (!conversation) return null;

  return {
    title: conversation.title,
    sharedAt: conversation.sharedAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString(),
    owner: {
      name: conversation.user.name,
      email: conversation.user.email,
    },
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.content,
      toolCalls: message.toolCalls,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

/**
 * 从消息扩展字段中读取 thinking/reasoning。
 *
 * @param toolCalls 消息扩展 JSON。
 * @returns reasoning 文本或 `null`。
 */
function getReasoning(toolCalls: unknown): string | null {
  // 先读取必要输入，再返回规范化后的查询结果。
  if (!toolCalls || typeof toolCalls !== 'object') {
    return null;
  }

  const record = toolCalls as Record<string, unknown>;
  const reasoning = record.reasoning ?? record.thinking;

  return typeof reasoning === 'string' && reasoning.trim()
    ? reasoning.trim()
    : null;
}

/**
 * 格式化分享页面时间。
 *
 * @param value ISO 时间字符串。
 * @returns 中文日期时间。
 */
function formatDate(value: string | null): string {
  // 先处理边界情况，再返回规范化后的结果。
  if (!value) {
    return '未记录';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default async function SharePage({ params }: SharePageProps) {
  // 先整理组件所需状态，再渲染对应的界面结构。
  const { shareToken } = await params;
  const conversation = await getSharedConversation(shareToken);

  if (!conversation) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="border-border/60 bg-card/80 max-w-md rounded-3xl border p-8 text-center shadow-2xl backdrop-blur-xl">
          <h1 className="text-foreground text-lg font-semibold">
            分享不存在或已失效
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            该链接可能已被取消分享，或分享 token 不正确。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background min-h-dvh">
      <div className="border-border/50 bg-background/85 sticky top-0 z-10 border-b px-4 py-4 backdrop-blur-xl md:px-8">
        <header className="mx-auto flex max-w-4xl flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium">
              公开分享
            </p>
            <h1 className="text-foreground mt-1 truncate text-lg font-semibold tracking-tight md:text-xl">
              {conversation.title}
            </h1>
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>{conversation.owner.name || conversation.owner.email}</span>
            <span>分享于 {formatDate(conversation.sharedAt)}</span>
          </div>
        </header>
      </div>

      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-4xl flex-col px-4 py-6 md:px-6 lg:px-8">
        <section className="flex flex-1 flex-col gap-4">
          {conversation.messages.map((message) => {
            const reasoning = getReasoning(message.toolCalls);
            const isUser = message.role === 'user';

            return (
              <article
                key={message.id}
                className={cn(
                  'flex w-full',
                  isUser ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[88%] rounded-[1.5rem] px-4 py-3 shadow-sm md:max-w-[76%] md:px-5 md:py-4',
                    isUser
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'border-border/60 bg-card/90 text-card-foreground rounded-bl-md border backdrop-blur-xl',
                  )}
                >
                  <div
                    className={cn(
                      'mb-2 flex items-center justify-between gap-3 text-xs',
                      isUser
                        ? 'text-primary-foreground/75'
                        : 'text-muted-foreground',
                    )}
                  >
                    <span>{isUser ? '用户' : '助手'}</span>
                    <span>{formatDate(message.createdAt)}</span>
                  </div>
                  {reasoning ? (
                    <div
                      className={cn(
                        'mb-4 rounded-2xl border px-4 py-3 text-sm',
                        isUser
                          ? 'border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground/85'
                          : 'border-border/60 bg-muted/40 text-muted-foreground',
                      )}
                    >
                      <p className="mb-2 font-medium">Thinking / Reasoning</p>
                      <p className="whitespace-pre-wrap">{reasoning}</p>
                    </div>
                  ) : null}
                  <MessageContent
                    content={message.content}
                    role={message.role}
                  />
                </div>
              </article>
            );
          })}
        </section>
        <p className="text-muted-foreground mt-8 text-center text-xs">
          创建时间：{formatDate(conversation.createdAt)}
        </p>
      </div>
    </main>
  );
}

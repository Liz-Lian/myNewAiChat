import {
  Check,
  Loader2,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ConversationItem {
  id: string;
  title: string;
  updatedAt: string;
  isShared?: boolean;
}

interface ConversationSidebarProps {
  conversations: ConversationItem[];
  activeId?: string;
  loading?: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  loading = false,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
}: ConversationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  /**
   * 格式化会话更新时间。
   *
   * @param value ISO 时间字符串。
   * @returns 适合侧边栏展示的日期文本。
   */
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));

  /**
   * 进入标题编辑状态。
   *
   * @param conversation 当前会话项。
   */
  const startEditing = (conversation: ConversationItem) => {
    setEditingId(conversation.id);
    setDraftTitle(conversation.title);
  };

  /**
   * 提交标题编辑。
   *
   * @param id 会话 ID。
   */
  const submitEditing = (id: string) => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      return;
    }

    onRename(id, nextTitle);
    setEditingId(null);
  };

  return (
    <aside className="border-border/50 bg-sidebar/80 flex h-full w-72 shrink-0 flex-col border-r backdrop-blur-2xl">
      <div className="border-border/50 border-b p-4">
        <div className="mb-4 flex items-center gap-3 px-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 via-blue-500 to-indigo-500 text-sm font-semibold text-white shadow-lg shadow-blue-500/20">
            G
          </div>
          <div>
            <p className="text-sidebar-foreground text-sm font-semibold">
              My AI Chat
            </p>
            <p className="text-muted-foreground text-xs">灵感来自 Gemini</p>
          </div>
        </div>
        <Button
          onClick={onNewChat}
          className="bg-primary text-primary-foreground shadow-primary/15 hover:bg-primary/90 w-full justify-start gap-2 rounded-2xl shadow-lg"
        >
          <Plus className="h-4 w-4" />
          新对话
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2 px-3 py-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载会话
            </div>
          ) : null}
          {!loading && conversations.length === 0 ? (
            <div className="text-muted-foreground px-3 py-8 text-center text-sm">
              暂无历史会话
            </div>
          ) : null}
          {conversations.map((conv) => {
            const isActive = activeId === conv.id;
            const isEditing = editingId === conv.id;

            return (
              <div
                key={conv.id}
                className={cn(
                  'group rounded-2xl border px-3 py-3 text-sm transition-all',
                  isActive
                    ? 'border-border bg-card text-card-foreground shadow-lg shadow-blue-500/5'
                    : 'text-muted-foreground hover:border-border/60 hover:bg-accent/60 hover:text-foreground border-transparent bg-transparent',
                )}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          submitEditing(conv.id);
                        }
                        if (event.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                      className="h-8 rounded-xl"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        aria-label="取消重命名"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => submitEditing(conv.id)}
                        aria-label="保存标题"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(conv.id)}
                      className="min-w-0 flex-1 text-left"
                      title={conv.title}
                    >
                      <div className="truncate leading-5 font-medium">
                        {conv.title}
                      </div>
                      <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                        {conv.isShared ? <Share2 className="h-3 w-3" /> : null}
                        {formatDate(conv.updatedAt)}
                      </div>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="opacity-0 transition-opacity group-hover:opacity-100 aria-expanded:opacity-100"
                          aria-label="会话操作"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startEditing(conv)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          重命名
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(conv.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="border-border/50 space-y-2 border-t p-4">
        <Button
          variant="ghost"
          className="text-muted-foreground hover:bg-accent hover:text-foreground w-full justify-start gap-2 rounded-2xl"
        >
          <Settings className="h-4 w-4" />
          设置
        </Button>
        <Button
          variant="ghost"
          className="text-muted-foreground hover:bg-accent hover:text-foreground w-full justify-start gap-2 rounded-2xl"
        >
          <LogOut className="h-4 w-4" />
          退出
        </Button>
      </div>
    </aside>
  );
}

import { LogOut, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConversationItem {
  id: string;
  title: string;
  date: string;
}

interface ConversationSidebarProps {
  conversations: ConversationItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
}: ConversationSidebarProps) {
  return (
    <aside className="border-border/50 bg-sidebar/80 flex h-screen w-72 shrink-0 flex-col border-r backdrop-blur-2xl">
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
          {conversations.map((conv) => {
            const isActive = activeId === conv.id;

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`group w-full rounded-2xl border px-3 py-3 text-left text-sm transition-all ${
                  isActive
                    ? 'border-border bg-card text-card-foreground shadow-lg shadow-blue-500/5'
                    : 'text-muted-foreground hover:border-border/60 hover:bg-accent/60 hover:text-foreground border-transparent bg-transparent'
                }`}
                title={conv.title}
              >
                <div className="truncate leading-5 font-medium">
                  {conv.title}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {conv.date}
                </div>
              </button>
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

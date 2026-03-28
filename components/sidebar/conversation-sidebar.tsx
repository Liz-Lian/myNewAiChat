import { Plus, LogOut, Settings } from 'lucide-react';
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
    <div className="flex h-screen w-64 flex-col border-r bg-slate-50">
      {/* Header */}
      <div className="border-b p-4">
        <Button
          onClick={onNewChat}
          className="w-full gap-2 bg-slate-900 hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          新对话
        </Button>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                activeId === conv.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title={conv.title}
            >
              <div className="truncate font-medium">{conv.title}</div>
              <div className="text-xs text-slate-400">{conv.date}</div>
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="space-y-2 border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-slate-600"
        >
          <Settings className="h-4 w-4" />
          设置
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-slate-600"
        >
          <LogOut className="h-4 w-4" />
          退出
        </Button>
      </div>
    </div>
  );
}

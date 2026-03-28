import { MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatHeaderProps {
  title?: string;
  onDelete?: () => void;
}

export function ChatHeader({ title = '新对话', onDelete }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
      {/* Left - Title & Avatar */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-blue-400 to-blue-600 font-semibold text-white">
          AI
        </div>
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-400">对话中</p>
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={onDelete}
              className="cursor-pointer text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除对话
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

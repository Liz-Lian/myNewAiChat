'use client';

import { MoreVertical, Trash2 } from 'lucide-react';

import { ModeToggle } from '@/components/mode-toggle';
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
    <div className="border-border/50 bg-background/80 flex items-center justify-between border-b px-5 py-4 shadow-[0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="border-border/60 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-linear-to-br from-sky-500 via-blue-500 to-indigo-500 font-semibold text-white shadow-lg shadow-blue-500/20">
          AI
        </div>
        <div className="min-w-0">
          <h1 className="text-foreground truncate text-sm font-semibold tracking-tight md:text-base">
            {title}
          </h1>
          <p className="text-muted-foreground text-xs">Gemini 风格 · 对话中</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ModeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="更多操作">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive cursor-pointer"
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

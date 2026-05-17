/**
 * 本文件实现聊天页面整体布局组件。
 */
import { ReactNode } from 'react';
import { PanelLeftOpen } from 'lucide-react';

import { ConversationSidebar } from '@/components/sidebar/conversation-sidebar';
import { ChatHeader } from '@/components/header/chat-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  isShared?: boolean;
}

interface ChatLayoutProps {
  children: ReactNode;
  conversations?: Conversation[];
  activeConversationId?: string;
  conversationsLoading?: boolean;
  onSelectConversation?: (id: string) => void;
  onNewChat?: () => void;
  onRenameConversation?: (id: string, title: string) => void;
  onDeleteConversationItem?: (id: string) => void;
  currentTitle?: string;
  onDeleteConversation?: () => void;
  onShareConversation?: () => void;
  onCancelShare?: () => void;
  currentConversationIsShared?: boolean;
  sidebarCollapsed?: boolean;
  searchQuery?: string;
  filteredCount?: number;
  totalCount?: number;
  onToggleSidebar?: () => void;
  onSearchQueryChange?: (query: string) => void;
}

export function ChatLayout({
  children,
  conversations = [],
  activeConversationId,
  conversationsLoading,
  onSelectConversation = () => {},
  onNewChat = () => {},
  onRenameConversation = () => {},
  onDeleteConversationItem = () => {},
  currentTitle,
  onDeleteConversation,
  onShareConversation,
  onCancelShare,
  currentConversationIsShared,
  sidebarCollapsed = false,
  searchQuery = '',
  filteredCount,
  totalCount,
  onToggleSidebar = () => {},
  onSearchQueryChange = () => {},
}: ChatLayoutProps) {
  return (
    <div className="text-foreground flex h-dvh overflow-hidden bg-transparent">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        loading={conversationsLoading}
        collapsed={sidebarCollapsed}
        searchQuery={searchQuery}
        filteredCount={filteredCount}
        totalCount={totalCount}
        onToggleCollapsed={onToggleSidebar}
        onSearchQueryChange={onSearchQueryChange}
        onSelect={onSelectConversation}
        onNewChat={onNewChat}
        onRename={onRenameConversation}
        onDelete={onDeleteConversationItem}
      />

      <div
        className={cn(
          'border-border/40 bg-background/75 flex h-full min-h-0 flex-1 flex-col overflow-hidden border-l shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-2xl',
          'transition-[margin,width] duration-300 ease-out',
        )}
      >
        {sidebarCollapsed ? (
          <div className="border-border/50 bg-background/80 flex items-center border-b px-3 py-2 md:hidden">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={onToggleSidebar}
              aria-label="展开侧边栏"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
        <ChatHeader
          title={currentTitle}
          onDelete={onDeleteConversation}
          onShare={onShareConversation}
          onCancelShare={onCancelShare}
          isShared={currentConversationIsShared}
          hasConversation={Boolean(activeConversationId)}
        />

        {children}
      </div>
    </div>
  );
}

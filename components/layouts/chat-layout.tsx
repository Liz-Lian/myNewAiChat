import { ReactNode } from 'react';
import { ConversationSidebar } from '@/components/sidebar/conversation-sidebar';
import { ChatHeader } from '@/components/header/chat-header';

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
}: ChatLayoutProps) {
  return (
    <div className="text-foreground flex h-dvh overflow-hidden bg-transparent">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        loading={conversationsLoading}
        onSelect={onSelectConversation}
        onNewChat={onNewChat}
        onRename={onRenameConversation}
        onDelete={onDeleteConversationItem}
      />

      <div className="border-border/40 bg-background/75 flex h-full min-h-0 flex-1 flex-col overflow-hidden border-l shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-2xl">
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
